"""
Integration API for data validation system

Provides REST endpoints, real-time validation, webhooks,
and integration with external systems for comprehensive
data validation workflows.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, validator
import uvicorn
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

from ..core.models import ReviewValidationModel, ValidationLevel
from ..validators.schema_validator import SchemaValidator
from ..quality.quality_checker import DataQualityChecker, QualityReport
from ..profiling.profiler import ComprehensiveProfiler, DatasetProfile
from ..performance.validator_cache import PerformanceOptimizer, ValidationCache

logger = logging.getLogger(__name__)

# API Models
class ValidationRequest(BaseModel):
    """Request model for validation operations"""
    data: List[Dict[str, Any]]
    validation_level: ValidationLevel = ValidationLevel.STANDARD
    schema_name: Optional[str] = None
    enable_caching: bool = True
    async_processing: bool = False

class ValidationResponse(BaseModel):
    """Response model for validation results"""
    validation_id: str
    total_records: int
    valid_records: int
    invalid_records: int
    validation_level: ValidationLevel
    processing_time_ms: float
    results: List[Dict[str, Any]]
    quality_summary: Optional[Dict[str, Any]] = None
    performance_metrics: Optional[Dict[str, Any]] = None

class QualityCheckRequest(BaseModel):
    """Request model for quality checking"""
    data: List[Dict[str, Any]]
    include_profiling: bool = False
    sample_size: Optional[int] = None

class ProfilingRequest(BaseModel):
    """Request model for data profiling"""
    data: Union[List[Dict[str, Any]], str]  # Data or dataset_id
    dataset_id: Optional[str] = None
    sample_size: Optional[int] = None
    include_recommendations: bool = True

class WebhookConfig(BaseModel):
    """Webhook configuration"""
    url: str
    events: List[str]
    secret: Optional[str] = None
    retries: int = 3
    timeout: int = 30

class ValidationJob(BaseModel):
    """Background validation job"""
    job_id: str
    status: str  # 'pending', 'running', 'completed', 'failed'
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: int = 0  # 0-100
    total_records: int = 0
    processed_records: int = 0
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# Middleware
class ValidationMiddleware(BaseHTTPMiddleware):
    """Custom middleware for validation API"""

    async def dispatch(self, request: Request, call_next):
        start_time = datetime.now()

        # Add request ID for tracking
        request_id = f"req_{int(start_time.timestamp() * 1000)}"
        request.state.request_id = request_id

        # Log request
        logger.info(f"Request {request_id}: {request.method} {request.url.path}")

        try:
            response = await call_next(request)

            # Add performance headers
            process_time = (datetime.now() - start_time).total_seconds() * 1000
            response.headers["X-Process-Time"] = str(process_time)
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            logger.error(f"Request {request_id} failed: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal server error",
                    "request_id": request_id,
                    "timestamp": datetime.now().isoformat()
                }
            )

# Application context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Data Validation API")

    # Initialize components
    app.state.performance_optimizer = PerformanceOptimizer()
    await app.state.performance_optimizer.initialize()

    app.state.schema_validator = SchemaValidator()
    app.state.quality_checker = DataQualityChecker()
    app.state.profiler = ComprehensiveProfiler()

    # Job management
    app.state.active_jobs = {}
    app.state.job_results = {}

    yield

    # Shutdown
    logger.info("Shutting down Data Validation API")
    await app.state.performance_optimizer.cleanup()

# Create FastAPI app
app = FastAPI(
    title="Data Validation API",
    description="Comprehensive data validation, quality checking, and profiling API",
    version="1.0.0",
    lifespan=lifespan
)

# Add middleware
app.add_middleware(ValidationMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependencies
def get_performance_optimizer() -> PerformanceOptimizer:
    """Get performance optimizer instance"""
    return app.state.performance_optimizer

def get_schema_validator() -> SchemaValidator:
    """Get schema validator instance"""
    return app.state.schema_validator

def get_quality_checker() -> DataQualityChecker:
    """Get quality checker instance"""
    return app.state.quality_checker

def get_profiler() -> ComprehensiveProfiler:
    """Get profiler instance"""
    return app.state.profiler

# API Endpoints

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.post("/validate", response_model=ValidationResponse)
async def validate_data(
    request: ValidationRequest,
    background_tasks: BackgroundTasks,
    optimizer: PerformanceOptimizer = Depends(get_performance_optimizer),
    validator: SchemaValidator = Depends(get_schema_validator)
):
    """
    Validate data against schema and business rules

    Args:
        request: Validation request with data and parameters
        background_tasks: FastAPI background tasks
        optimizer: Performance optimizer instance
        validator: Schema validator instance

    Returns:
        Validation results with performance metrics
    """
    try:
        start_time = datetime.now()
        validation_id = f"val_{int(start_time.timestamp() * 1000)}"

        logger.info(f"Starting validation {validation_id} for {len(request.data)} records")

        if request.async_processing and len(request.data) > 1000:
            # Large dataset - process asynchronously
            job_id = f"job_{validation_id}"
            job = ValidationJob(
                job_id=job_id,
                status="pending",
                created_at=start_time,
                total_records=len(request.data)
            )

            app.state.active_jobs[job_id] = job

            # Start background processing
            background_tasks.add_task(
                process_validation_job,
                job_id,
                request.data,
                request.validation_level,
                validator
            )

            return ValidationResponse(
                validation_id=validation_id,
                total_records=len(request.data),
                valid_records=0,
                invalid_records=0,
                validation_level=request.validation_level,
                processing_time_ms=0,
                results=[],
                quality_summary={"message": f"Processing asynchronously. Check job status: /jobs/{job_id}"}
            )

        else:
            # Synchronous processing
            def validation_func(record):
                try:
                    if request.schema_name:
                        return validator.validate_against_schema(record, request.schema_name)
                    else:
                        # Use default validation
                        validated = ReviewValidationModel(**record)
                        return {"valid": True, "record": validated.dict(), "errors": []}
                except Exception as e:
                    return {"valid": False, "record": record, "errors": [str(e)]}

            # Use optimizer for performance
            optimization_result = await optimizer.optimize_validation(
                request.data,
                validation_func,
                'auto'
            )

            results = optimization_result['results']
            valid_count = len([r for r in results if r.get('valid', False)])
            invalid_count = len(results) - valid_count

            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000

            return ValidationResponse(
                validation_id=validation_id,
                total_records=len(request.data),
                valid_records=valid_count,
                invalid_records=invalid_count,
                validation_level=request.validation_level,
                processing_time_ms=processing_time,
                results=results,
                performance_metrics=optimization_result['metrics']
            )

    except Exception as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}"
        )

@app.post("/quality-check")
async def check_data_quality(
    request: QualityCheckRequest,
    quality_checker: DataQualityChecker = Depends(get_quality_checker),
    profiler: ComprehensiveProfiler = Depends(get_profiler)
):
    """
    Perform comprehensive data quality assessment

    Args:
        request: Quality check request
        quality_checker: Quality checker instance
        profiler: Profiler instance for additional analysis

    Returns:
        Detailed quality report
    """
    try:
        start_time = datetime.now()

        logger.info(f"Starting quality check for {len(request.data)} records")

        # Perform quality check
        quality_report = await quality_checker.check_data_quality(request.data)

        result = {
            "quality_report": {
                "total_records": quality_report.total_records,
                "valid_records": quality_report.valid_records,
                "invalid_records": quality_report.invalid_records,
                "completeness_score": quality_report.completeness_score,
                "accuracy_score": quality_report.accuracy_score,
                "consistency_score": quality_report.consistency_score,
                "overall_score": quality_report.overall_score,
                "issues_count": len(quality_report.issues),
                "recommendations": quality_report.recommendations,
                "timestamp": quality_report.timestamp.isoformat()
            },
            "issues": [
                {
                    "type": issue.issue_type.value,
                    "severity": issue.severity.value,
                    "field": issue.field_name,
                    "message": issue.message,
                    "suggestion": issue.suggestion
                }
                for issue in quality_report.issues
            ],
            "field_statistics": quality_report.field_statistics
        }

        # Add profiling if requested
        if request.include_profiling:
            profile = await profiler.profile_dataset(
                request.data,
                sample_size=request.sample_size
            )

            result["profiling"] = {
                "dataset_info": {
                    "total_records": profile.total_records,
                    "total_fields": profile.total_fields,
                    "memory_usage_mb": profile.memory_usage_mb,
                    "profiling_duration": profile.profiling_duration_seconds
                },
                "field_profiles": [
                    {
                        "name": fp.name,
                        "inferred_type": fp.inferred_type.value,
                        "confidence": fp.confidence,
                        "completeness_ratio": fp.completeness_ratio,
                        "uniqueness_ratio": fp.uniqueness_ratio,
                        "quality_score": fp.quality_score,
                        "recommendations": fp.recommendations
                    }
                    for fp in profile.field_profiles
                ],
                "relationships": profile.relationships,
                "anomalies": profile.anomalies,
                "recommendations": profile.recommendations
            }

        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        result["processing_time_ms"] = processing_time

        return result

    except Exception as e:
        logger.error(f"Quality check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quality check failed: {str(e)}"
        )

@app.post("/profile")
async def profile_dataset(
    request: ProfilingRequest,
    profiler: ComprehensiveProfiler = Depends(get_profiler)
):
    """
    Generate comprehensive data profile

    Args:
        request: Profiling request
        profiler: Profiler instance

    Returns:
        Detailed dataset profile
    """
    try:
        start_time = datetime.now()

        if isinstance(request.data, str):
            # Dataset ID provided - would load from storage
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Dataset ID lookup not implemented yet"
            )

        logger.info(f"Starting profiling for {len(request.data)} records")

        profile = await profiler.profile_dataset(
            request.data,
            sample_size=request.sample_size
        )

        result = {
            "dataset_id": profile.dataset_id,
            "dataset_info": {
                "total_records": profile.total_records,
                "total_fields": profile.total_fields,
                "memory_usage_mb": profile.memory_usage_mb,
                "profiling_duration_seconds": profile.profiling_duration_seconds,
                "created_at": profile.created_at.isoformat()
            },
            "field_profiles": [
                {
                    "name": fp.name,
                    "inferred_type": fp.inferred_type.value,
                    "confidence": fp.confidence,
                    "total_count": fp.total_count,
                    "null_count": fp.null_count,
                    "unique_count": fp.unique_count,
                    "completeness_ratio": fp.completeness_ratio,
                    "uniqueness_ratio": fp.uniqueness_ratio,
                    "patterns": fp.patterns,
                    "statistics": fp.statistics,
                    "quality_score": fp.quality_score,
                    "recommendations": fp.recommendations if request.include_recommendations else []
                }
                for fp in profile.field_profiles
            ],
            "relationships": profile.relationships,
            "anomalies": profile.anomalies,
            "data_lineage": profile.data_lineage,
            "quality_summary": profile.quality_summary
        }

        if request.include_recommendations:
            result["recommendations"] = profile.recommendations

        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        result["processing_time_ms"] = processing_time

        return result

    except Exception as e:
        logger.error(f"Profiling error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profiling failed: {str(e)}"
        )

@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get status of background validation job"""
    if job_id not in app.state.active_jobs and job_id not in app.state.job_results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    if job_id in app.state.active_jobs:
        job = app.state.active_jobs[job_id]
        return {
            "job_id": job.job_id,
            "status": job.status,
            "progress": job.progress,
            "total_records": job.total_records,
            "processed_records": job.processed_records,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "error": job.error
        }
    else:
        # Job completed - return result
        return app.state.job_results[job_id]

@app.get("/performance/stats")
async def get_performance_stats(
    optimizer: PerformanceOptimizer = Depends(get_performance_optimizer)
):
    """Get comprehensive performance statistics"""
    return optimizer.get_performance_summary()

@app.post("/validate/stream")
async def validate_stream(
    request: Request,
    validator: SchemaValidator = Depends(get_schema_validator)
):
    """
    Stream validation endpoint for real-time processing

    Accepts streaming JSON data and returns validation results
    """
    async def generate_validation_results():
        async for chunk in request.stream():
            try:
                # Parse JSON chunk
                data = json.loads(chunk.decode())

                # Validate record
                try:
                    validated = ReviewValidationModel(**data)
                    result = {
                        "valid": True,
                        "record": validated.dict(),
                        "errors": [],
                        "timestamp": datetime.now().isoformat()
                    }
                except Exception as e:
                    result = {
                        "valid": False,
                        "record": data,
                        "errors": [str(e)],
                        "timestamp": datetime.now().isoformat()
                    }

                yield f"data: {json.dumps(result)}\n\n"

            except Exception as e:
                error_result = {
                    "valid": False,
                    "error": f"Parse error: {str(e)}",
                    "timestamp": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(error_result)}\n\n"

    return StreamingResponse(
        generate_validation_results(),
        media_type="text/plain"
    )

@app.post("/schemas")
async def create_schema(
    schema_definition: Dict[str, Any],
    validator: SchemaValidator = Depends(get_schema_validator)
):
    """Create or update a validation schema"""
    try:
        schema_name = schema_definition.get('name')
        if not schema_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Schema name is required"
            )

        # Register schema
        validator.register_schema(schema_name, schema_definition.get('schema', {}))

        return {
            "message": f"Schema '{schema_name}' registered successfully",
            "schema_name": schema_name,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Schema creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Schema creation failed: {str(e)}"
        )

@app.get("/schemas")
async def list_schemas(
    validator: SchemaValidator = Depends(get_schema_validator)
):
    """List all registered schemas"""
    return {
        "schemas": list(validator.schemas.keys()),
        "count": len(validator.schemas),
        "timestamp": datetime.now().isoformat()
    }

@app.delete("/schemas/{schema_name}")
async def delete_schema(
    schema_name: str,
    validator: SchemaValidator = Depends(get_schema_validator)
):
    """Delete a schema"""
    if schema_name not in validator.schemas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not found"
        )

    del validator.schemas[schema_name]

    return {
        "message": f"Schema '{schema_name}' deleted successfully",
        "timestamp": datetime.now().isoformat()
    }

# Background task functions
async def process_validation_job(
    job_id: str,
    data: List[Dict[str, Any]],
    validation_level: ValidationLevel,
    validator: SchemaValidator
):
    """Process validation job in background"""
    try:
        # Update job status
        job = app.state.active_jobs[job_id]
        job.status = "running"
        job.started_at = datetime.now()

        # Create validation function
        def validation_func(record):
            try:
                validated = ReviewValidationModel(**record)
                return {"valid": True, "record": validated.dict(), "errors": []}
            except Exception as e:
                return {"valid": False, "record": record, "errors": [str(e)]}

        # Process in batches with progress updates
        batch_size = 1000
        all_results = []
        processed = 0

        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]

            # Process batch
            batch_results = []
            for record in batch:
                result = validation_func(record)
                batch_results.append(result)
                processed += 1

                # Update progress
                job.progress = int((processed / len(data)) * 100)
                job.processed_records = processed

            all_results.extend(batch_results)

            # Small delay to prevent overwhelming the system
            await asyncio.sleep(0.1)

        # Calculate final results
        valid_count = len([r for r in all_results if r.get('valid', False)])
        invalid_count = len(all_results) - valid_count

        # Store result
        result = {
            "job_id": job_id,
            "status": "completed",
            "total_records": len(data),
            "valid_records": valid_count,
            "invalid_records": invalid_count,
            "validation_level": validation_level.value,
            "results": all_results,
            "completed_at": datetime.now().isoformat()
        }

        # Move from active jobs to completed results
        app.state.job_results[job_id] = result
        del app.state.active_jobs[job_id]

        logger.info(f"Validation job {job_id} completed successfully")

    except Exception as e:
        # Handle job failure
        logger.error(f"Validation job {job_id} failed: {e}")

        if job_id in app.state.active_jobs:
            job = app.state.active_jobs[job_id]
            job.status = "failed"
            job.error = str(e)
            job.completed_at = datetime.now()

# WebSocket endpoint for real-time validation
from fastapi import WebSocket, WebSocketDisconnect
import json

@app.websocket("/ws/validate")
async def websocket_validate(
    websocket: WebSocket,
    validator: SchemaValidator = Depends(get_schema_validator)
):
    """WebSocket endpoint for real-time validation"""
    await websocket.accept()

    try:
        while True:
            # Receive data
            data = await websocket.receive_text()

            try:
                # Parse JSON
                record = json.loads(data)

                # Validate
                try:
                    validated = ReviewValidationModel(**record)
                    result = {
                        "valid": True,
                        "record": validated.dict(),
                        "errors": [],
                        "timestamp": datetime.now().isoformat()
                    }
                except Exception as e:
                    result = {
                        "valid": False,
                        "record": record,
                        "errors": [str(e)],
                        "timestamp": datetime.now().isoformat()
                    }

                # Send result
                await websocket.send_text(json.dumps(result))

            except json.JSONDecodeError:
                error_result = {
                    "valid": False,
                    "error": "Invalid JSON format",
                    "timestamp": datetime.now().isoformat()
                }
                await websocket.send_text(json.dumps(error_result))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.now().isoformat(),
            "path": str(request.url.path)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
            "timestamp": datetime.now().isoformat(),
            "path": str(request.url.path)
        }
    )

# Main application entry point
if __name__ == "__main__":
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )