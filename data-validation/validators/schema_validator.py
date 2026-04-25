"""
Advanced Schema Validation Engine
JSON Schema generation, type checking, and nested object validation
"""

import json
import jsonschema
from typing import Dict, List, Any, Optional, Union, Type, get_type_hints
from datetime import datetime, date
from enum import Enum
import inspect
import logging
from pathlib import Path
import yaml

from pydantic import BaseModel, ValidationError, create_model
from pydantic.schema import schema
from pydantic.types import SecretStr
from pydantic.fields import Field

from ..core.models import (
    ReviewValidationModel,
    BusinessInfo,
    ReviewerInfo,
    ValidationLevel,
    Platform,
    DataQualityLevel
)


class SchemaValidationError(Exception):
    """Custom exception for schema validation errors"""
    pass


class SchemaRegistry:
    """Central registry for validation schemas"""

    def __init__(self):
        self.schemas: Dict[str, Dict[str, Any]] = {}
        self.models: Dict[str, Type[BaseModel]] = {}
        self.logger = logging.getLogger(self.__class__.__name__)

    def register_model(self, name: str, model_class: Type[BaseModel]):
        """Register a Pydantic model and generate JSON schema"""
        try:
            # Generate JSON schema from Pydantic model
            json_schema = schema([model_class], ref_template='#/definitions/{model}')

            # Store both model and schema
            self.models[name] = model_class
            self.schemas[name] = json_schema

            self.logger.info(f"Registered schema: {name}")

        except Exception as e:
            self.logger.error(f"Failed to register schema {name}: {e}")
            raise SchemaValidationError(f"Schema registration failed: {e}")

    def get_schema(self, name: str) -> Dict[str, Any]:
        """Get JSON schema by name"""
        if name not in self.schemas:
            raise SchemaValidationError(f"Schema '{name}' not found")
        return self.schemas[name]

    def get_model(self, name: str) -> Type[BaseModel]:
        """Get Pydantic model by name"""
        if name not in self.models:
            raise SchemaValidationError(f"Model '{name}' not found")
        return self.models[name]

    def list_schemas(self) -> List[str]:
        """List all registered schema names"""
        return list(self.schemas.keys())

    def export_schema(self, name: str, file_path: str):
        """Export schema to JSON file"""
        schema_data = self.get_schema(name)
        with open(file_path, 'w') as f:
            json.dump(schema_data, f, indent=2)

    def import_schema(self, name: str, file_path: str):
        """Import schema from JSON file"""
        with open(file_path, 'r') as f:
            schema_data = json.load(f)
        self.schemas[name] = schema_data


class TypeInference:
    """Intelligent type inference for data fields"""

    @staticmethod
    def infer_type(value: Any) -> str:
        """Infer the most appropriate type for a value"""
        if value is None:
            return "null"

        if isinstance(value, bool):
            return "boolean"

        if isinstance(value, int):
            return "integer"

        if isinstance(value, float):
            return "number"

        if isinstance(value, str):
            # Check for specific string patterns
            return TypeInference._infer_string_type(value)

        if isinstance(value, (list, tuple)):
            return "array"

        if isinstance(value, dict):
            return "object"

        if isinstance(value, datetime):
            return "datetime"

        if isinstance(value, date):
            return "date"

        return "string"

    @staticmethod
    def _infer_string_type(value: str) -> str:
        """Infer specific string type based on content"""
        import re

        # Email pattern
        if re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value):
            return "email"

        # URL pattern
        if re.match(r'^https?://', value):
            return "url"

        # UUID pattern
        if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', value.lower()):
            return "uuid"

        # Phone number pattern
        if re.match(r'^\+?[\d\s\-\(\)]{10,20}$', value):
            return "phone"

        # Date pattern
        if re.match(r'^\d{4}-\d{2}-\d{2}', value):
            return "date"

        # Datetime pattern
        if re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', value):
            return "datetime"

        return "string"

    @staticmethod
    def generate_schema_from_data(data: List[Dict[str, Any]], name: str = "inferred_schema") -> Dict[str, Any]:
        """Generate JSON schema from sample data"""
        if not data:
            return {"type": "object", "properties": {}}

        # Analyze all records to infer schema
        properties = {}
        required_fields = set()

        for record in data:
            for field, value in record.items():
                if field not in properties:
                    properties[field] = {
                        "type": TypeInference.infer_type(value),
                        "examples": []
                    }

                # Track field presence for required determination
                if value is not None:
                    required_fields.add(field)

                # Collect examples
                if len(properties[field]["examples"]) < 3 and value is not None:
                    properties[field]["examples"].append(value)

        # Fields present in >90% of records are considered required
        total_records = len(data)
        field_counts = {}
        for record in data:
            for field in record:
                field_counts[field] = field_counts.get(field, 0) + 1

        required = [
            field for field, count in field_counts.items()
            if count / total_records > 0.9
        ]

        return {
            "type": "object",
            "title": name,
            "properties": properties,
            "required": required,
            "additionalProperties": False
        }


class SchemaValidator:
    """Advanced schema validation engine"""

    def __init__(self, registry: SchemaRegistry):
        self.registry = registry
        self.logger = logging.getLogger(self.__class__.__name__)

    def validate_against_schema(self, data: Dict[str, Any], schema_name: str) -> Dict[str, Any]:
        """Validate data against registered schema"""
        try:
            # Get the Pydantic model
            model_class = self.registry.get_model(schema_name)

            # Validate using Pydantic
            validated_instance = model_class(**data)

            return {
                "valid": True,
                "data": validated_instance.dict(),
                "errors": [],
                "warnings": []
            }

        except ValidationError as e:
            return {
                "valid": False,
                "data": None,
                "errors": [
                    {
                        "field": ".".join(str(x) for x in error["loc"]),
                        "message": error["msg"],
                        "type": error["type"],
                        "input": error.get("input")
                    }
                    for error in e.errors()
                ],
                "warnings": []
            }

        except Exception as e:
            self.logger.error(f"Schema validation error: {e}")
            return {
                "valid": False,
                "data": None,
                "errors": [{"field": "root", "message": str(e), "type": "unknown"}],
                "warnings": []
            }

    def validate_json_schema(self, data: Dict[str, Any], json_schema: Dict[str, Any]) -> Dict[str, Any]:
        """Validate data against JSON schema directly"""
        try:
            jsonschema.validate(instance=data, schema=json_schema)
            return {
                "valid": True,
                "data": data,
                "errors": [],
                "warnings": []
            }

        except jsonschema.ValidationError as e:
            return {
                "valid": False,
                "data": None,
                "errors": [
                    {
                        "field": ".".join(str(x) for x in e.absolute_path),
                        "message": e.message,
                        "type": "json_schema_error",
                        "schema_path": ".".join(str(x) for x in e.schema_path)
                    }
                ],
                "warnings": []
            }

    def validate_nested_structure(self, data: Any, expected_structure: Dict[str, Any]) -> List[str]:
        """Validate nested object structure"""
        errors = []

        def _validate_recursive(obj: Any, structure: Any, path: str = ""):
            if isinstance(structure, dict):
                if not isinstance(obj, dict):
                    errors.append(f"{path}: Expected object, got {type(obj).__name__}")
                    return

                for key, expected_type in structure.items():
                    current_path = f"{path}.{key}" if path else key

                    if key not in obj:
                        errors.append(f"{current_path}: Missing required field")
                        continue

                    _validate_recursive(obj[key], expected_type, current_path)

            elif isinstance(structure, list):
                if not isinstance(obj, list):
                    errors.append(f"{path}: Expected array, got {type(obj).__name__}")
                    return

                if len(structure) > 0:
                    expected_item_type = structure[0]
                    for i, item in enumerate(obj):
                        _validate_recursive(item, expected_item_type, f"{path}[{i}]")

            elif isinstance(structure, type):
                if not isinstance(obj, structure):
                    errors.append(f"{path}: Expected {structure.__name__}, got {type(obj).__name__}")

        _validate_recursive(data, expected_structure)
        return errors

    def create_dynamic_model(self, schema_name: str, fields: Dict[str, Any]) -> Type[BaseModel]:
        """Create a Pydantic model dynamically from field definitions"""
        try:
            # Convert field definitions to Pydantic fields
            model_fields = {}

            for field_name, field_config in fields.items():
                field_type = field_config.get('type', str)
                required = field_config.get('required', True)
                default = field_config.get('default', ... if required else None)

                # Handle field constraints
                constraints = {}
                if 'min_length' in field_config:
                    constraints['min_length'] = field_config['min_length']
                if 'max_length' in field_config:
                    constraints['max_length'] = field_config['max_length']
                if 'regex' in field_config:
                    constraints['regex'] = field_config['regex']

                # Create Field with constraints
                if constraints:
                    model_fields[field_name] = (field_type, Field(default=default, **constraints))
                else:
                    model_fields[field_name] = (field_type, default)

            # Create the dynamic model
            dynamic_model = create_model(schema_name, **model_fields)

            # Register the model
            self.registry.register_model(schema_name, dynamic_model)

            return dynamic_model

        except Exception as e:
            self.logger.error(f"Failed to create dynamic model: {e}")
            raise SchemaValidationError(f"Dynamic model creation failed: {e}")


class SchemaEvolution:
    """Handle schema evolution and migration"""

    def __init__(self, registry: SchemaRegistry):
        self.registry = registry
        self.logger = logging.getLogger(self.__class__.__name__)

    def compare_schemas(self, schema1: Dict[str, Any], schema2: Dict[str, Any]) -> Dict[str, Any]:
        """Compare two schemas and identify differences"""
        differences = {
            "added_fields": [],
            "removed_fields": [],
            "modified_fields": [],
            "type_changes": [],
            "breaking_changes": False
        }

        props1 = schema1.get("properties", {})
        props2 = schema2.get("properties", {})
        required1 = set(schema1.get("required", []))
        required2 = set(schema2.get("required", []))

        # Find added fields
        for field in props2.keys() - props1.keys():
            differences["added_fields"].append(field)
            if field in required2:
                differences["breaking_changes"] = True

        # Find removed fields
        for field in props1.keys() - props2.keys():
            differences["removed_fields"].append(field)
            if field in required1:
                differences["breaking_changes"] = True

        # Find modified fields
        for field in props1.keys() & props2.keys():
            prop1 = props1[field]
            prop2 = props2[field]

            if prop1.get("type") != prop2.get("type"):
                differences["type_changes"].append({
                    "field": field,
                    "old_type": prop1.get("type"),
                    "new_type": prop2.get("type")
                })
                differences["breaking_changes"] = True

            # Check for other modifications
            if prop1 != prop2:
                differences["modified_fields"].append({
                    "field": field,
                    "old": prop1,
                    "new": prop2
                })

        return differences

    def migrate_data(self, data: Dict[str, Any], migration_rules: Dict[str, Any]) -> Dict[str, Any]:
        """Migrate data according to schema changes"""
        migrated = data.copy()

        # Field renames
        for old_name, new_name in migration_rules.get("field_renames", {}).items():
            if old_name in migrated:
                migrated[new_name] = migrated.pop(old_name)

        # Type conversions
        for field, conversion in migration_rules.get("type_conversions", {}).items():
            if field in migrated:
                try:
                    if conversion == "string_to_int":
                        migrated[field] = int(migrated[field])
                    elif conversion == "string_to_float":
                        migrated[field] = float(migrated[field])
                    elif conversion == "int_to_string":
                        migrated[field] = str(migrated[field])
                    # Add more conversions as needed
                except (ValueError, TypeError) as e:
                    self.logger.warning(f"Type conversion failed for {field}: {e}")

        # Default values for new required fields
        for field, default in migration_rules.get("default_values", {}).items():
            if field not in migrated:
                migrated[field] = default

        return migrated

    def validate_schema_compatibility(self, old_schema: Dict[str, Any], new_schema: Dict[str, Any]) -> bool:
        """Check if new schema is backwards compatible"""
        differences = self.compare_schemas(old_schema, new_schema)
        return not differences["breaking_changes"]


class ConfigurableValidator:
    """Validator with configurable rules from external configuration"""

    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path) if config_path else {}
        self.registry = SchemaRegistry()
        self.validator = SchemaValidator(self.registry)
        self.logger = logging.getLogger(self.__class__.__name__)

        # Register default models
        self._register_default_models()

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load validation configuration from file"""
        config_file = Path(config_path)

        if not config_file.exists():
            self.logger.warning(f"Config file not found: {config_path}")
            return {}

        with open(config_file, 'r') as f:
            if config_path.endswith('.yaml') or config_path.endswith('.yml'):
                return yaml.safe_load(f)
            else:
                return json.load(f)

    def _register_default_models(self):
        """Register default validation models"""
        self.registry.register_model("review", ReviewValidationModel)
        self.registry.register_model("business", BusinessInfo)
        self.registry.register_model("reviewer", ReviewerInfo)

    def validate_with_config(self, data: Dict[str, Any], entity_type: str) -> Dict[str, Any]:
        """Validate data using configuration-driven rules"""
        # Get validation rules for entity type
        rules = self.config.get("validation_rules", {}).get(entity_type, {})

        # Base validation against schema
        result = self.validator.validate_against_schema(data, entity_type)

        # Apply additional configuration-driven validations
        if result["valid"] and rules:
            additional_errors = self._apply_config_rules(data, rules)
            if additional_errors:
                result["valid"] = False
                result["errors"].extend(additional_errors)

        return result

    def _apply_config_rules(self, data: Dict[str, Any], rules: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Apply configuration-defined validation rules"""
        errors = []

        # Range validations
        for field, range_rule in rules.get("ranges", {}).items():
            if field in data:
                value = data[field]
                if isinstance(value, (int, float)):
                    min_val = range_rule.get("min")
                    max_val = range_rule.get("max")

                    if min_val is not None and value < min_val:
                        errors.append({
                            "field": field,
                            "message": f"Value {value} is below minimum {min_val}",
                            "type": "range_error"
                        })

                    if max_val is not None and value > max_val:
                        errors.append({
                            "field": field,
                            "message": f"Value {value} exceeds maximum {max_val}",
                            "type": "range_error"
                        })

        # Pattern validations
        for field, pattern in rules.get("patterns", {}).items():
            if field in data:
                import re
                if not re.match(pattern, str(data[field])):
                    errors.append({
                        "field": field,
                        "message": f"Value does not match required pattern: {pattern}",
                        "type": "pattern_error"
                    })

        # Custom validations
        for validation in rules.get("custom", []):
            try:
                # Execute custom validation logic
                condition = validation.get("condition")
                if condition and not self._evaluate_condition(data, condition):
                    errors.append({
                        "field": validation.get("field", "root"),
                        "message": validation.get("message", "Custom validation failed"),
                        "type": "custom_error"
                    })
            except Exception as e:
                self.logger.error(f"Custom validation error: {e}")

        return errors

    def _evaluate_condition(self, data: Dict[str, Any], condition: str) -> bool:
        """Safely evaluate a condition string"""
        try:
            # Create a safe namespace for evaluation
            namespace = {
                'data': data,
                'len': len,
                'abs': abs,
                'min': min,
                'max': max,
                'sum': sum
            }

            # Evaluate the condition
            return bool(eval(condition, {"__builtins__": {}}, namespace))

        except Exception as e:
            self.logger.error(f"Condition evaluation error: {e}")
            return False


# Example usage and testing
if __name__ == "__main__":
    # Initialize the validation system
    registry = SchemaRegistry()
    registry.register_model("review", ReviewValidationModel)

    validator = SchemaValidator(registry)

    # Test schema validation
    test_data = {
        "platform_review_id": "test_123",
        "platform": "google",
        "business": {
            "business_id": "biz_123",
            "name": "Test Restaurant"
        },
        "reviewer": {
            "reviewer_id": "user_456",
            "display_name": "Test User"
        },
        "rating": 4.5,
        "review_date": "2024-01-15T10:30:00Z",
        "metadata": {
            "ingestion_timestamp": "2024-01-15T10:35:00Z",
            "source_system": "api",
            "processing_version": "1.0.0",
            "pipeline_id": "550e8400-e29b-41d4-a716-446655440000",
            "content_hash": "abc123def456789012345678901234567890123456789012345678901234567"
        }
    }

    result = validator.validate_against_schema(test_data, "review")
    print(f"Validation result: {result['valid']}")
    if not result['valid']:
        for error in result['errors']:
            print(f"Error: {error}")