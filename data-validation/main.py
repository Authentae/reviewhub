"""
Main entry point for the comprehensive data validation system

Provides unified interface to all validation, quality checking,
profiling, and integration capabilities.
"""

import asyncio
import logging
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional
import json
import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('data-validation.log')
    ]
)

logger = logging.getLogger(__name__)

# Import all validation components
from core.models import ReviewValidationModel, ValidationLevel
from validators.schema_validator import SchemaValidator
from quality.quality_checker import DataQualityChecker
from profiling.profiler import ComprehensiveProfiler
from performance.validator_cache import PerformanceOptimizer
from integration.api import app as api_app

class DataValidationSystem:
    """
    Comprehensive data validation system

    Provides unified interface to all validation capabilities:
    - Schema validation
    - Data quality checking
    - Data profiling
    - Performance optimization
    - API integration
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or self._load_default_config()

        # Initialize components
        self.schema_validator = SchemaValidator()
        self.quality_checker = DataQualityChecker()
        self.profiler = ComprehensiveProfiler()
        self.performance_optimizer = None

        # Initialize performance optimizer if caching is enabled
        if self.config.get('caching', {}).get('enabled', True):
            redis_url = self.config.get('caching', {}).get('redis_url')
            self.performance_optimizer = PerformanceOptimizer(redis_url=redis_url)

        logger.info("Data validation system initialized")

    def _load_default_config(self) -> Dict[str, Any]:
        """Load default configuration"""
        return {
            'validation': {
                'default_level': 'standard',
                'strict_mode': False,
                'cache_results': True
            },
            'quality': {
                'enable_outlier_detection': True,
                'enable_pattern_analysis': True,
                'missing_data_threshold': 0.05
            },
            'profiling': {
                'default_sample_size': 10000,
                'include_recommendations': True,
                'detect_relationships': True
            },
            'performance': {
                'batch_size': 1000,
                'max_workers': None,
                'enable_streaming': True
            },
            'caching': {
                'enabled': True,
                'redis_url': None,
                'local_cache_size': 10000
            },
            'api': {
                'host': '0.0.0.0',
                'port': 8000,
                'enable_cors': True,
                'log_level': 'info'
            }
        }

    async def initialize(self):
        """Initialize async components"""
        if self.performance_optimizer:
            await self.performance_optimizer.initialize()
        logger.info("Async components initialized")

    async def validate_data(self, data: List[Dict[str, Any]],
                          validation_level: ValidationLevel = ValidationLevel.STANDARD,
                          schema_name: Optional[str] = None,
                          enable_optimization: bool = True) -> Dict[str, Any]:
        """
        Validate data with full system capabilities

        Args:
            data: Data to validate
            validation_level: Validation strictness level
            schema_name: Optional schema name for validation
            enable_optimization: Use performance optimization

        Returns:
            Comprehensive validation results
        """
        logger.info(f"Starting validation for {len(data)} records")

        if enable_optimization and self.performance_optimizer:
            # Use optimized validation
            def validation_func(record):
                try:
                    if schema_name:
                        return self.schema_validator.validate_against_schema(record, schema_name)
                    else:
                        validated = ReviewValidationModel(**record)
                        return {"valid": True, "record": validated.dict(), "errors": []}
                except Exception as e:
                    return {"valid": False, "record": record, "errors": [str(e)]}

            result = await self.performance_optimizer.optimize_validation(
                data, validation_func, 'auto'
            )

            # Add validation summary
            valid_count = len([r for r in result['results'] if r.get('valid', False)])
            result['summary'] = {
                'total_records': len(data),
                'valid_records': valid_count,
                'invalid_records': len(data) - valid_count,
                'validation_level': validation_level.value
            }

            return result

        else:
            # Standard validation
            results = []
            for record in data:
                try:
                    if schema_name:
                        result = self.schema_validator.validate_against_schema(record, schema_name)
                    else:
                        validated = ReviewValidationModel(**record)
                        result = {"valid": True, "record": validated.dict(), "errors": []}
                    results.append(result)
                except Exception as e:
                    results.append({"valid": False, "record": record, "errors": [str(e)]})

            valid_count = len([r for r in results if r.get('valid', False)])

            return {
                'results': results,
                'summary': {
                    'total_records': len(data),
                    'valid_records': valid_count,
                    'invalid_records': len(data) - valid_count,
                    'validation_level': validation_level.value
                }
            }

    async def check_quality(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Perform comprehensive data quality check

        Args:
            data: Data to check

        Returns:
            Quality assessment results
        """
        logger.info(f"Starting quality check for {len(data)} records")

        quality_report = await self.quality_checker.check_data_quality(data)

        return {
            'quality_score': quality_report.overall_score,
            'completeness_score': quality_report.completeness_score,
            'accuracy_score': quality_report.accuracy_score,
            'consistency_score': quality_report.consistency_score,
            'total_issues': len(quality_report.issues),
            'issues': [
                {
                    'type': issue.issue_type.value,
                    'severity': issue.severity.value,
                    'field': issue.field_name,
                    'message': issue.message,
                    'suggestion': issue.suggestion
                }
                for issue in quality_report.issues
            ],
            'field_statistics': quality_report.field_statistics,
            'recommendations': quality_report.recommendations
        }

    async def profile_data(self, data: List[Dict[str, Any]],
                          dataset_id: Optional[str] = None,
                          sample_size: Optional[int] = None) -> Dict[str, Any]:
        """
        Generate comprehensive data profile

        Args:
            data: Data to profile
            dataset_id: Optional dataset identifier
            sample_size: Sample size for large datasets

        Returns:
            Comprehensive data profile
        """
        logger.info(f"Starting data profiling for {len(data)} records")

        profile = await self.profiler.profile_dataset(
            data,
            dataset_id=dataset_id,
            sample_size=sample_size
        )

        return {
            'dataset_id': profile.dataset_id,
            'total_records': profile.total_records,
            'total_fields': profile.total_fields,
            'profiling_duration': profile.profiling_duration_seconds,
            'field_profiles': [
                {
                    'name': fp.name,
                    'type': fp.inferred_type.value,
                    'confidence': fp.confidence,
                    'completeness': fp.completeness_ratio,
                    'uniqueness': fp.uniqueness_ratio,
                    'quality_score': fp.quality_score,
                    'statistics': fp.statistics,
                    'recommendations': fp.recommendations
                }
                for fp in profile.field_profiles
            ],
            'relationships': profile.relationships,
            'anomalies': profile.anomalies,
            'quality_summary': profile.quality_summary,
            'recommendations': profile.recommendations
        }

    async def full_analysis(self, data: List[Dict[str, Any]],
                          validation_level: ValidationLevel = ValidationLevel.COMPREHENSIVE,
                          include_profiling: bool = True) -> Dict[str, Any]:
        """
        Perform full analysis: validation + quality + profiling

        Args:
            data: Data to analyze
            validation_level: Validation level to use
            include_profiling: Include data profiling

        Returns:
            Complete analysis results
        """
        logger.info(f"Starting full analysis for {len(data)} records")

        results = {}

        # Validation
        validation_results = await self.validate_data(data, validation_level)
        results['validation'] = validation_results

        # Quality check
        quality_results = await self.check_quality(data)
        results['quality'] = quality_results

        # Profiling (optional)
        if include_profiling:
            profiling_results = await self.profile_data(data)
            results['profiling'] = profiling_results

        # Overall summary
        results['summary'] = {
            'total_records': len(data),
            'validation_passed': validation_results['summary']['valid_records'],
            'quality_score': quality_results['quality_score'],
            'analysis_level': validation_level.value,
            'included_profiling': include_profiling
        }

        return results

    def run_api_server(self, host: str = None, port: int = None):
        """Run the API server"""
        import uvicorn

        host = host or self.config['api']['host']
        port = port or self.config['api']['port']
        log_level = self.config['api']['log_level']

        logger.info(f"Starting API server on {host}:{port}")

        uvicorn.run(
            api_app,
            host=host,
            port=port,
            log_level=log_level
        )

    async def cleanup(self):
        """Cleanup system resources"""
        if self.performance_optimizer:
            await self.performance_optimizer.cleanup()
        logger.info("Data validation system cleanup completed")

# CLI interface
def load_data_from_file(file_path: str) -> List[Dict[str, Any]]:
    """Load data from file (JSON, CSV, etc.)"""
    file_path = Path(file_path)

    if file_path.suffix.lower() == '.json':
        with open(file_path, 'r') as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            else:
                return [data]

    elif file_path.suffix.lower() == '.csv':
        df = pd.read_csv(file_path)
        return df.to_dict('records')

    elif file_path.suffix.lower() in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path)
        return df.to_dict('records')

    else:
        raise ValueError(f"Unsupported file format: {file_path.suffix}")

async def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(description='Comprehensive Data Validation System')
    parser.add_argument('command', choices=['validate', 'quality', 'profile', 'analyze', 'api'],
                       help='Command to execute')
    parser.add_argument('--file', '-f', type=str, help='Input data file')
    parser.add_argument('--output', '-o', type=str, help='Output file for results')
    parser.add_argument('--validation-level', choices=['basic', 'standard', 'comprehensive'],
                       default='standard', help='Validation level')
    parser.add_argument('--sample-size', type=int, help='Sample size for large datasets')
    parser.add_argument('--host', default='0.0.0.0', help='API server host')
    parser.add_argument('--port', type=int, default=8000, help='API server port')
    parser.add_argument('--config', type=str, help='Configuration file path')

    args = parser.parse_args()

    # Load configuration
    config = None
    if args.config:
        with open(args.config, 'r') as f:
            config = json.load(f)

    # Initialize system
    system = DataValidationSystem(config)
    await system.initialize()

    try:
        if args.command == 'api':
            # Run API server
            system.run_api_server(args.host, args.port)

        else:
            # Load data
            if not args.file:
                print("Error: --file argument is required for this command")
                return

            data = load_data_from_file(args.file)
            print(f"Loaded {len(data)} records from {args.file}")

            # Convert validation level
            validation_level_map = {
                'basic': ValidationLevel.BASIC,
                'standard': ValidationLevel.STANDARD,
                'comprehensive': ValidationLevel.COMPREHENSIVE
            }
            validation_level = validation_level_map[args.validation_level]

            # Execute command
            if args.command == 'validate':
                results = await system.validate_data(data, validation_level)

            elif args.command == 'quality':
                results = await system.check_quality(data)

            elif args.command == 'profile':
                results = await system.profile_data(data, sample_size=args.sample_size)

            elif args.command == 'analyze':
                results = await system.full_analysis(data, validation_level)

            # Output results
            if args.output:
                with open(args.output, 'w') as f:
                    json.dump(results, f, indent=2, default=str)
                print(f"Results saved to {args.output}")
            else:
                print(json.dumps(results, indent=2, default=str))

    finally:
        await system.cleanup()

if __name__ == "__main__":
    asyncio.run(main())

# Example usage functions
def create_example_usage():
    """Create example usage scenarios"""
    examples = {
        "basic_validation": """
# Basic validation example
import asyncio
from data_validation import DataValidationSystem

async def example():
    system = DataValidationSystem()
    await system.initialize()

    # Sample data
    data = [
        {
            "review_id": "rev_001",
            "rating": 4.5,
            "review_text": "Great restaurant with excellent food!",
            "business_id": "bus_001",
            "reviewer_id": "user_001"
        }
    ]

    # Validate
    results = await system.validate_data(data)
    print(f"Validation passed: {results['summary']['valid_records']}/{results['summary']['total_records']}")

    await system.cleanup()

# Run example
asyncio.run(example())
        """,

        "quality_analysis": """
# Quality analysis example
import asyncio
from data_validation import DataValidationSystem

async def quality_example():
    system = DataValidationSystem()
    await system.initialize()

    # Load your data
    data = load_your_data()  # Implement this function

    # Check quality
    quality_results = await system.check_quality(data)

    print(f"Overall quality score: {quality_results['quality_score']:.2f}")
    print(f"Issues found: {quality_results['total_issues']}")

    for issue in quality_results['issues'][:5]:  # Top 5 issues
        print(f"- {issue['severity']}: {issue['message']}")

    await system.cleanup()

asyncio.run(quality_example())
        """,

        "full_analysis": """
# Full analysis example
import asyncio
from data_validation import DataValidationSystem, ValidationLevel

async def full_analysis_example():
    system = DataValidationSystem()
    await system.initialize()

    # Load data from file
    import pandas as pd
    df = pd.read_csv('your_data.csv')
    data = df.to_dict('records')

    # Run complete analysis
    results = await system.full_analysis(
        data,
        validation_level=ValidationLevel.COMPREHENSIVE,
        include_profiling=True
    )

    # Print summary
    summary = results['summary']
    print(f"Analysis Results:")
    print(f"- Total records: {summary['total_records']}")
    print(f"- Valid records: {summary['validation_passed']}")
    print(f"- Quality score: {summary['quality_score']:.2f}")

    # Save detailed results
    import json
    with open('analysis_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)

    await system.cleanup()

asyncio.run(full_analysis_example())
        """,

        "api_usage": """
# Using the REST API
import requests
import json

# Start the API server first:
# python -m data_validation api

# Validate data via API
data = [{"rating": 5, "review_text": "Excellent!"}]

response = requests.post(
    'http://localhost:8000/validate',
    json={
        'data': data,
        'validation_level': 'standard',
        'enable_caching': True
    }
)

results = response.json()
print(f"API validation: {results['valid_records']}/{results['total_records']} valid")
        """
    }

    return examples

# Export main classes for easy importing
__all__ = [
    'DataValidationSystem',
    'ValidationLevel',
    'SchemaValidator',
    'DataQualityChecker',
    'ComprehensiveProfiler',
    'PerformanceOptimizer'
]