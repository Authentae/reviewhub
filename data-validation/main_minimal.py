"""
Minimal Data Validation System - Core functionality without heavy dependencies
"""

import asyncio
import logging
import sys
import argparse
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import csv

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

class ValidationLevel:
    """Simple validation levels"""
    BASIC = "basic"
    STANDARD = "standard"
    COMPREHENSIVE = "comprehensive"
    CUSTOM = "custom"

class SimpleValidator:
    """Simple validation without external dependencies"""

    def validate_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Basic validation of a single record"""
        errors = []

        # Basic required fields check
        required_fields = ['review_id', 'rating']
        for field in required_fields:
            if field not in record or record[field] is None:
                errors.append(f"Missing required field: {field}")

        # Type validations
        if 'rating' in record:
            try:
                rating = float(record['rating'])
                if rating < 0 or rating > 5:
                    errors.append("Rating must be between 0 and 5")
            except (TypeError, ValueError):
                errors.append("Rating must be a number")

        if 'review_text' in record and record['review_text']:
            if len(record['review_text']) > 10000:
                errors.append("Review text too long (max 10000 chars)")

        return {
            "valid": len(errors) == 0,
            "record": record,
            "errors": errors
        }

class SimpleQualityChecker:
    """Simple data quality checker"""

    def check_quality(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Basic quality assessment"""
        total_records = len(data)
        if total_records == 0:
            return {"quality_score": 0.0, "issues": [], "summary": "No data"}

        issues = []
        field_completeness = {}

        # Check completeness
        all_fields = set()
        for record in data:
            all_fields.update(record.keys())

        for field in all_fields:
            non_null_count = sum(1 for record in data if record.get(field) is not None)
            completeness = non_null_count / total_records
            field_completeness[field] = completeness

            if completeness < 0.8:  # 80% threshold
                issues.append(f"Low completeness for {field}: {completeness:.1%}")

        # Calculate overall quality score
        avg_completeness = sum(field_completeness.values()) / len(field_completeness) if field_completeness else 0
        quality_score = avg_completeness * 100

        return {
            "quality_score": quality_score,
            "completeness_scores": field_completeness,
            "issues": issues,
            "total_records": total_records,
            "total_fields": len(all_fields)
        }

class SimpleProfiler:
    """Simple data profiler"""

    def profile_data(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Basic data profiling"""
        if not data:
            return {"error": "No data to profile"}

        all_fields = set()
        for record in data:
            all_fields.update(record.keys())

        field_profiles = {}
        for field in all_fields:
            values = [record.get(field) for record in data if field in record]
            non_null_values = [v for v in values if v is not None]

            profile = {
                "field": field,
                "total_count": len(values),
                "non_null_count": len(non_null_values),
                "null_count": len(values) - len(non_null_values),
                "completeness": len(non_null_values) / len(values) if values else 0
            }

            # Basic type inference
            if non_null_values:
                types = set(type(v).__name__ for v in non_null_values)
                profile["inferred_types"] = list(types)
                profile["unique_values"] = len(set(non_null_values))

                # Sample values
                profile["sample_values"] = list(set(non_null_values))[:5]

            field_profiles[field] = profile

        return {
            "total_records": len(data),
            "total_fields": len(all_fields),
            "field_profiles": field_profiles
        }

class SimpleDataValidationSystem:
    """Lightweight data validation system"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.validator = SimpleValidator()
        self.quality_checker = SimpleQualityChecker()
        self.profiler = SimpleProfiler()
        logger.info("Simple data validation system initialized")

    async def initialize(self):
        """Initialize async components"""
        logger.info("System initialized")

    async def validate_data(self, data: List[Dict[str, Any]],
                          validation_level: str = ValidationLevel.STANDARD) -> Dict[str, Any]:
        """Validate data"""
        logger.info(f"Validating {len(data)} records at {validation_level} level")

        results = []
        for record in data:
            result = self.validator.validate_record(record)
            results.append(result)

        valid_count = sum(1 for r in results if r["valid"])

        return {
            "results": results,
            "summary": {
                "total_records": len(data),
                "valid_records": valid_count,
                "invalid_records": len(data) - valid_count,
                "validation_level": validation_level,
                "success_rate": valid_count / len(data) if data else 0
            }
        }

    async def check_quality(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Check data quality"""
        logger.info(f"Checking quality for {len(data)} records")
        return self.quality_checker.check_quality(data)

    async def profile_data(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Profile data"""
        logger.info(f"Profiling {len(data)} records")
        return self.profiler.profile_data(data)

    async def full_analysis(self, data: List[Dict[str, Any]],
                          validation_level: str = ValidationLevel.COMPREHENSIVE) -> Dict[str, Any]:
        """Perform full analysis"""
        logger.info(f"Running full analysis on {len(data)} records")

        validation_results = await self.validate_data(data, validation_level)
        quality_results = await self.check_quality(data)
        profile_results = await self.profile_data(data)

        return {
            "validation": validation_results,
            "quality": quality_results,
            "profiling": profile_results,
            "summary": {
                "total_records": len(data),
                "validation_passed": validation_results["summary"]["valid_records"],
                "quality_score": quality_results["quality_score"],
                "analysis_level": validation_level
            }
        }

    async def cleanup(self):
        """Cleanup resources"""
        logger.info("Cleanup completed")

def load_data_from_file(file_path: str) -> List[Dict[str, Any]]:
    """Load data from file using built-in libraries"""
    file_path = Path(file_path)

    if file_path.suffix.lower() == '.json':
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else [data]

    elif file_path.suffix.lower() == '.csv':
        data = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Convert numeric strings to numbers where possible
                for key, value in row.items():
                    try:
                        if '.' in value:
                            row[key] = float(value)
                        else:
                            row[key] = int(value)
                    except (ValueError, AttributeError):
                        pass  # Keep as string
                data.append(row)
        return data

    else:
        raise ValueError(f"Unsupported file format: {file_path.suffix}")

async def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(description='Simple Data Validation System')
    parser.add_argument('command', choices=['validate', 'quality', 'profile', 'analyze'],
                       help='Command to execute')
    parser.add_argument('--file', '-f', type=str, required=True, help='Input data file')
    parser.add_argument('--output', '-o', type=str, help='Output file for results')
    parser.add_argument('--validation-level', choices=['basic', 'standard', 'comprehensive'],
                       default='standard', help='Validation level')

    args = parser.parse_args()

    # Initialize system
    system = SimpleDataValidationSystem()
    await system.initialize()

    try:
        # Load data
        print(f"Loading data from {args.file}...")
        data = load_data_from_file(args.file)
        print(f"Loaded {len(data)} records")

        # Execute command
        if args.command == 'validate':
            results = await system.validate_data(data, args.validation_level)
        elif args.command == 'quality':
            results = await system.check_quality(data)
        elif args.command == 'profile':
            results = await system.profile_data(data)
        elif args.command == 'analyze':
            results = await system.full_analysis(data, args.validation_level)

        # Output results
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, default=str)
            print(f"Results saved to {args.output}")
        else:
            print("Results:")
            print(json.dumps(results, indent=2, default=str))

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await system.cleanup()

if __name__ == "__main__":
    asyncio.run(main())