"""
Advanced Data Profiling Engine

Implements comprehensive data profiling including:
- Automatic type inference
- Distribution analysis
- Cardinality analysis
- Pattern detection
- Anomaly identification
- Relationship analysis
"""

import asyncio
import logging
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple, Union
from dataclasses import dataclass, asdict
from enum import Enum
import pandas as pd
import numpy as np
from scipy import stats
import re
from collections import Counter, defaultdict

logger = logging.getLogger(__name__)

class DataType(str, Enum):
    """Inferred data types"""
    INTEGER = "integer"
    FLOAT = "float"
    STRING = "string"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    DATE = "date"
    TIME = "time"
    EMAIL = "email"
    URL = "url"
    PHONE = "phone"
    UUID = "uuid"
    JSON = "json"
    CATEGORICAL = "categorical"
    IDENTIFIER = "identifier"
    UNKNOWN = "unknown"

class PatternType(str, Enum):
    """Common data patterns"""
    NUMERIC = "numeric"
    ALPHABETIC = "alphabetic"
    ALPHANUMERIC = "alphanumeric"
    EMAIL_FORMAT = "email_format"
    URL_FORMAT = "url_format"
    PHONE_FORMAT = "phone_format"
    DATE_FORMAT = "date_format"
    UUID_FORMAT = "uuid_format"
    JSON_FORMAT = "json_format"
    MIXED = "mixed"
    CUSTOM = "custom"

@dataclass
class FieldProfile:
    """Comprehensive field profile"""
    name: str
    inferred_type: DataType
    confidence: float  # 0-1
    total_count: int
    null_count: int
    unique_count: int
    completeness_ratio: float
    uniqueness_ratio: float
    patterns: List[str]
    statistics: Dict[str, Any]
    recommendations: List[str]
    quality_score: float

@dataclass
class DatasetProfile:
    """Complete dataset profile"""
    dataset_id: str
    total_records: int
    total_fields: int
    memory_usage_mb: float
    profiling_duration_seconds: float
    field_profiles: List[FieldProfile]
    relationships: Dict[str, Any]
    anomalies: List[Dict[str, Any]]
    data_lineage: Dict[str, Any]
    quality_summary: Dict[str, Any]
    recommendations: List[str]
    created_at: datetime

class TypeInferenceEngine:
    """Intelligent type inference for data fields"""

    def __init__(self):
        self.type_patterns = self._initialize_type_patterns()
        self.confidence_weights = self._initialize_confidence_weights()

    def _initialize_type_patterns(self) -> Dict[DataType, Dict[str, Any]]:
        """Initialize patterns for type detection"""
        return {
            DataType.EMAIL: {
                'regex': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
                'confidence_base': 0.95
            },
            DataType.URL: {
                'regex': r'^https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?$',
                'confidence_base': 0.95
            },
            DataType.PHONE: {
                'regex': r'^\+?[\d\-\(\)\s\.]{7,20}$',
                'confidence_base': 0.85
            },
            DataType.UUID: {
                'regex': r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
                'confidence_base': 0.98
            },
            DataType.JSON: {
                'validators': [self._is_json_string],
                'confidence_base': 0.90
            }
        }

    def _initialize_confidence_weights(self) -> Dict[str, float]:
        """Initialize weights for confidence calculation"""
        return {
            'pattern_match_ratio': 0.4,
            'data_consistency': 0.3,
            'statistical_evidence': 0.2,
            'domain_knowledge': 0.1
        }

    async def infer_type(self, series: pd.Series, sample_size: int = 1000) -> Tuple[DataType, float]:
        """
        Infer data type with confidence score

        Args:
            series: Data series to analyze
            sample_size: Sample size for analysis

        Returns:
            Tuple of (inferred_type, confidence_score)
        """
        # Handle empty or all-null series
        clean_series = series.dropna()
        if len(clean_series) == 0:
            return DataType.UNKNOWN, 0.0

        # Sample for performance with large datasets
        if len(clean_series) > sample_size:
            clean_series = clean_series.sample(n=sample_size, random_state=42)

        # Convert to strings for pattern matching
        string_series = clean_series.astype(str)

        # Type inference priority order
        type_checks = [
            (DataType.BOOLEAN, self._check_boolean),
            (DataType.INTEGER, self._check_integer),
            (DataType.FLOAT, self._check_float),
            (DataType.DATETIME, self._check_datetime),
            (DataType.DATE, self._check_date),
            (DataType.TIME, self._check_time),
            (DataType.EMAIL, self._check_email),
            (DataType.URL, self._check_url),
            (DataType.PHONE, self._check_phone),
            (DataType.UUID, self._check_uuid),
            (DataType.JSON, self._check_json),
            (DataType.CATEGORICAL, self._check_categorical),
            (DataType.IDENTIFIER, self._check_identifier),
            (DataType.STRING, self._check_string)
        ]

        best_type = DataType.UNKNOWN
        best_confidence = 0.0

        for data_type, check_function in type_checks:
            confidence = check_function(series, string_series)
            if confidence > best_confidence:
                best_type = data_type
                best_confidence = confidence

        return best_type, best_confidence

    def _check_boolean(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents boolean data"""
        unique_values = set(string_series.str.lower().unique())
        boolean_patterns = [
            {'true', 'false'},
            {'1', '0'},
            {'yes', 'no'},
            {'y', 'n'},
            {'on', 'off'},
            {'enabled', 'disabled'},
            {'active', 'inactive'}
        ]

        for pattern in boolean_patterns:
            if unique_values.issubset(pattern) or pattern.issubset(unique_values):
                return 0.95

        return 0.0

    def _check_integer(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents integer data"""
        try:
            numeric_series = pd.to_numeric(series, errors='coerce')
            if numeric_series.isnull().sum() > len(series) * 0.1:  # More than 10% conversion failures
                return 0.0

            # Check if all values are integers
            integer_mask = numeric_series == numeric_series.astype('int64', errors='ignore')
            integer_ratio = integer_mask.sum() / len(numeric_series.dropna())

            return min(integer_ratio, 0.95)

        except:
            return 0.0

    def _check_float(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents float data"""
        try:
            numeric_series = pd.to_numeric(series, errors='coerce')
            if numeric_series.isnull().sum() > len(series) * 0.1:
                return 0.0

            # Check if any values are actually floats (not integers)
            has_decimals = (numeric_series % 1 != 0).any()
            conversion_success = len(numeric_series.dropna()) / len(series)

            if has_decimals:
                return min(conversion_success, 0.90)
            else:
                return min(conversion_success * 0.5, 0.45)  # Lower confidence if all integers

        except:
            return 0.0

    def _check_datetime(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents datetime data"""
        try:
            datetime_series = pd.to_datetime(series, errors='coerce', infer_datetime_format=True)
            conversion_success = len(datetime_series.dropna()) / len(series)

            # Additional checks for datetime patterns
            datetime_patterns = [
                r'\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}',  # ISO format
                r'\d{2}/\d{2}/\d{4}\s\d{2}:\d{2}:\d{2}',     # US format with time
                r'\d{2}-\d{2}-\d{4}\s\d{2}:\d{2}:\d{2}'      # European format with time
            ]

            pattern_matches = 0
            for pattern in datetime_patterns:
                matches = string_series.str.contains(pattern, case=False, na=False).sum()
                pattern_matches += matches

            pattern_ratio = pattern_matches / len(series)

            return min(conversion_success * 0.7 + pattern_ratio * 0.3, 0.95)

        except:
            return 0.0

    def _check_date(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents date data"""
        try:
            date_series = pd.to_datetime(series, errors='coerce')
            conversion_success = len(date_series.dropna()) / len(series)

            # Check if all times are midnight (indicating date-only data)
            if conversion_success > 0.8:
                midnight_ratio = (date_series.dt.time == pd.Timestamp('00:00:00').time()).sum() / len(date_series.dropna())
                if midnight_ratio > 0.9:
                    return min(conversion_success, 0.90)

            date_patterns = [
                r'^\d{4}-\d{2}-\d{2}$',     # YYYY-MM-DD
                r'^\d{2}/\d{2}/\d{4}$',     # MM/DD/YYYY
                r'^\d{2}-\d{2}-\d{4}$'      # DD-MM-YYYY
            ]

            pattern_matches = 0
            for pattern in date_patterns:
                matches = string_series.str.match(pattern).sum()
                pattern_matches += matches

            pattern_ratio = pattern_matches / len(series)
            return min(pattern_ratio, 0.90)

        except:
            return 0.0

    def _check_time(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents time data"""
        time_patterns = [
            r'^\d{2}:\d{2}:\d{2}$',      # HH:MM:SS
            r'^\d{2}:\d{2}$',            # HH:MM
            r'^\d{1,2}:\d{2}\s?(AM|PM)$' # 12-hour format
        ]

        total_matches = 0
        for pattern in time_patterns:
            matches = string_series.str.match(pattern, case=False).sum()
            total_matches += matches

        match_ratio = total_matches / len(series)
        return min(match_ratio, 0.90)

    def _check_email(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents email addresses"""
        pattern = self.type_patterns[DataType.EMAIL]['regex']
        matches = string_series.str.match(pattern, case=False).sum()
        match_ratio = matches / len(series)

        return min(match_ratio * self.type_patterns[DataType.EMAIL]['confidence_base'], 0.95)

    def _check_url(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents URLs"""
        pattern = self.type_patterns[DataType.URL]['regex']
        matches = string_series.str.match(pattern, case=False).sum()
        match_ratio = matches / len(series)

        return min(match_ratio * self.type_patterns[DataType.URL]['confidence_base'], 0.95)

    def _check_phone(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents phone numbers"""
        pattern = self.type_patterns[DataType.PHONE]['regex']
        matches = string_series.str.match(pattern).sum()
        match_ratio = matches / len(series)

        return min(match_ratio * self.type_patterns[DataType.PHONE]['confidence_base'], 0.95)

    def _check_uuid(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents UUIDs"""
        pattern = self.type_patterns[DataType.UUID]['regex']
        matches = string_series.str.match(pattern, case=False).sum()
        match_ratio = matches / len(series)

        return min(match_ratio * self.type_patterns[DataType.UUID]['confidence_base'], 0.98)

    def _check_json(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents JSON strings"""
        json_count = 0
        for value in string_series:
            if self._is_json_string(value):
                json_count += 1

        json_ratio = json_count / len(series)
        return min(json_ratio * self.type_patterns[DataType.JSON]['confidence_base'], 0.95)

    def _check_categorical(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents categorical data"""
        unique_count = series.nunique()
        total_count = len(series)

        # Categorical if low cardinality and reasonable repetition
        uniqueness_ratio = unique_count / total_count

        if uniqueness_ratio < 0.1 and unique_count > 1:  # Less than 10% unique values
            return 0.85
        elif uniqueness_ratio < 0.5 and unique_count < 50:  # Medium cardinality with reasonable count
            return 0.60
        else:
            return 0.0

    def _check_identifier(self, series: pd.Series, string_series: pd.Series) -> float:
        """Check if series represents identifier data"""
        unique_count = series.nunique()
        total_count = len(series)

        uniqueness_ratio = unique_count / total_count

        # High uniqueness suggests identifier
        if uniqueness_ratio > 0.95:
            # Additional checks for identifier patterns
            has_prefix_pattern = string_series.str.contains(r'^[A-Z]+[0-9]+$', case=False).sum() > total_count * 0.5
            has_sequential = self._check_sequential_pattern(string_series)

            confidence = 0.80
            if has_prefix_pattern:
                confidence += 0.10
            if has_sequential:
                confidence += 0.10

            return min(confidence, 0.95)

        return 0.0

    def _check_string(self, series: pd.Series, string_series: pd.Series) -> float:
        """Default string type check"""
        # String is the fallback type, always has some confidence
        return 0.50

    def _is_json_string(self, value: str) -> bool:
        """Check if string is valid JSON"""
        try:
            json.loads(value)
            return True
        except (json.JSONDecodeError, TypeError):
            return False

    def _check_sequential_pattern(self, string_series: pd.Series) -> bool:
        """Check if series has sequential pattern (like IDs)"""
        try:
            # Extract numeric parts
            numeric_parts = string_series.str.extract(r'(\d+)$')[0]
            numeric_values = pd.to_numeric(numeric_parts, errors='coerce').dropna()

            if len(numeric_values) < 3:
                return False

            # Check if mostly sequential
            sorted_values = numeric_values.sort_values()
            differences = sorted_values.diff().dropna()

            # Most differences should be 1 for sequential data
            sequential_ratio = (differences == 1).sum() / len(differences)
            return sequential_ratio > 0.7

        except:
            return False

class PatternAnalyzer:
    """Analyze patterns in data fields"""

    def __init__(self):
        self.common_patterns = self._initialize_common_patterns()

    def _initialize_common_patterns(self) -> Dict[str, str]:
        """Initialize common regex patterns"""
        return {
            'credit_card': r'^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$',
            'ssn': r'^\d{3}-\d{2}-\d{4}$',
            'ip_address': r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$',
            'mac_address': r'^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$',
            'postal_code_us': r'^\d{5}(-\d{4})?$',
            'postal_code_canada': r'^[A-Za-z]\d[A-Za-z][\s\-]?\d[A-Za-z]\d$',
            'iban': r'^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$'
        }

    async def analyze_patterns(self, series: pd.Series) -> Dict[str, Any]:
        """
        Analyze patterns in a data series

        Args:
            series: Data series to analyze

        Returns:
            Pattern analysis results
        """
        string_series = series.astype(str)

        pattern_analysis = {
            'detected_patterns': [],
            'length_patterns': self._analyze_length_patterns(string_series),
            'character_patterns': self._analyze_character_patterns(string_series),
            'format_consistency': self._analyze_format_consistency(string_series),
            'custom_patterns': self._detect_custom_patterns(string_series)
        }

        # Check against common patterns
        for pattern_name, pattern_regex in self.common_patterns.items():
            matches = string_series.str.contains(pattern_regex, case=False, na=False).sum()
            match_ratio = matches / len(series)

            if match_ratio > 0.8:  # High confidence threshold
                pattern_analysis['detected_patterns'].append({
                    'name': pattern_name,
                    'match_ratio': match_ratio,
                    'confidence': 'high'
                })
            elif match_ratio > 0.5:  # Medium confidence
                pattern_analysis['detected_patterns'].append({
                    'name': pattern_name,
                    'match_ratio': match_ratio,
                    'confidence': 'medium'
                })

        return pattern_analysis

    def _analyze_length_patterns(self, string_series: pd.Series) -> Dict[str, Any]:
        """Analyze string length patterns"""
        lengths = string_series.str.len()

        return {
            'min_length': int(lengths.min()),
            'max_length': int(lengths.max()),
            'avg_length': float(lengths.mean()),
            'std_length': float(lengths.std()),
            'fixed_length': lengths.nunique() == 1,
            'common_lengths': lengths.value_counts().head(5).to_dict()
        }

    def _analyze_character_patterns(self, string_series: pd.Series) -> Dict[str, Any]:
        """Analyze character composition patterns"""
        total_count = len(string_series)

        return {
            'all_numeric': (string_series.str.isnumeric()).sum() / total_count,
            'all_alpha': (string_series.str.isalpha()).sum() / total_count,
            'all_alphanumeric': (string_series.str.isalnum()).sum() / total_count,
            'has_special_chars': (string_series.str.contains(r'[^a-zA-Z0-9]', na=False)).sum() / total_count,
            'has_uppercase': (string_series.str.contains(r'[A-Z]', na=False)).sum() / total_count,
            'has_lowercase': (string_series.str.contains(r'[a-z]', na=False)).sum() / total_count,
            'has_digits': (string_series.str.contains(r'\d', na=False)).sum() / total_count
        }

    def _analyze_format_consistency(self, string_series: pd.Series) -> Dict[str, Any]:
        """Analyze format consistency"""
        # Create simple format signatures
        format_signatures = []

        for value in string_series:
            signature = ""
            for char in value:
                if char.isdigit():
                    signature += "D"
                elif char.isalpha():
                    signature += "A"
                elif char.isspace():
                    signature += "S"
                else:
                    signature += "X"
            format_signatures.append(signature)

        signature_counts = Counter(format_signatures)

        return {
            'unique_formats': len(signature_counts),
            'most_common_format': signature_counts.most_common(1)[0] if signature_counts else None,
            'format_consistency_ratio': signature_counts.most_common(1)[0][1] / len(string_series) if signature_counts else 0,
            'format_distribution': dict(signature_counts.most_common(10))
        }

    def _detect_custom_patterns(self, string_series: pd.Series) -> List[Dict[str, Any]]:
        """Detect custom patterns in the data"""
        custom_patterns = []

        # Look for common separators
        separators = ['-', '_', '.', ':', '/', '\\', '|', ',', ';']

        for separator in separators:
            has_separator = string_series.str.contains(re.escape(separator), na=False).sum()
            if has_separator > len(string_series) * 0.8:  # 80% of values have this separator
                custom_patterns.append({
                    'type': 'separator_pattern',
                    'separator': separator,
                    'frequency': has_separator / len(string_series),
                    'description': f"Uses '{separator}' as separator"
                })

        # Look for prefix patterns
        common_prefixes = defaultdict(int)
        for value in string_series:
            if len(value) >= 2:
                prefix = value[:2]
                common_prefixes[prefix] += 1

        for prefix, count in common_prefixes.items():
            if count > len(string_series) * 0.5:  # 50% share same prefix
                custom_patterns.append({
                    'type': 'prefix_pattern',
                    'prefix': prefix,
                    'frequency': count / len(string_series),
                    'description': f"Common prefix '{prefix}'"
                })

        return custom_patterns

class AnomalyDetector:
    """Detect anomalies in data fields"""

    def __init__(self):
        self.detection_methods = [
            'statistical_outliers',
            'pattern_anomalies',
            'domain_anomalies',
            'temporal_anomalies'
        ]

    async def detect_anomalies(self, df: pd.DataFrame, field_profiles: List[FieldProfile]) -> List[Dict[str, Any]]:
        """
        Detect various types of anomalies in the dataset

        Args:
            df: DataFrame to analyze
            field_profiles: Field profiles for context

        Returns:
            List of detected anomalies
        """
        anomalies = []

        for column in df.columns:
            field_profile = next((fp for fp in field_profiles if fp.name == column), None)

            if field_profile:
                # Statistical outliers (for numeric data)
                if field_profile.inferred_type in [DataType.INTEGER, DataType.FLOAT]:
                    stat_anomalies = await self._detect_statistical_outliers(df[column], column)
                    anomalies.extend(stat_anomalies)

                # Pattern anomalies (for string data)
                if field_profile.inferred_type == DataType.STRING:
                    pattern_anomalies = await self._detect_pattern_anomalies(df[column], column)
                    anomalies.extend(pattern_anomalies)

                # Domain anomalies (based on expected values)
                domain_anomalies = await self._detect_domain_anomalies(df[column], column, field_profile)
                anomalies.extend(domain_anomalies)

        # Cross-field anomalies
        cross_field_anomalies = await self._detect_cross_field_anomalies(df)
        anomalies.extend(cross_field_anomalies)

        return anomalies

    async def _detect_statistical_outliers(self, series: pd.Series, field_name: str) -> List[Dict[str, Any]]:
        """Detect statistical outliers using multiple methods"""
        anomalies = []
        clean_series = pd.to_numeric(series, errors='coerce').dropna()

        if len(clean_series) < 10:
            return anomalies

        # Z-score method
        z_scores = np.abs(stats.zscore(clean_series))
        z_outliers = clean_series[z_scores > 3]

        if len(z_outliers) > 0:
            anomalies.append({
                'type': 'statistical_outlier',
                'method': 'z_score',
                'field': field_name,
                'severity': 'medium',
                'count': len(z_outliers),
                'values': z_outliers.tolist()[:10],  # First 10 outliers
                'description': f'Found {len(z_outliers)} statistical outliers using Z-score method'
            })

        # IQR method
        Q1 = clean_series.quantile(0.25)
        Q3 = clean_series.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR

        iqr_outliers = clean_series[(clean_series < lower_bound) | (clean_series > upper_bound)]

        if len(iqr_outliers) > 0:
            anomalies.append({
                'type': 'statistical_outlier',
                'method': 'iqr',
                'field': field_name,
                'severity': 'medium',
                'count': len(iqr_outliers),
                'bounds': {'lower': float(lower_bound), 'upper': float(upper_bound)},
                'values': iqr_outliers.tolist()[:10],
                'description': f'Found {len(iqr_outliers)} outliers outside IQR bounds'
            })

        return anomalies

    async def _detect_pattern_anomalies(self, series: pd.Series, field_name: str) -> List[Dict[str, Any]]:
        """Detect pattern anomalies in string data"""
        anomalies = []
        string_series = series.astype(str)

        # Detect length anomalies
        lengths = string_series.str.len()
        length_mean = lengths.mean()
        length_std = lengths.std()

        if length_std > 0:
            length_z_scores = np.abs((lengths - length_mean) / length_std)
            length_outliers = lengths[length_z_scores > 2]

            if len(length_outliers) > 0:
                anomalies.append({
                    'type': 'pattern_anomaly',
                    'method': 'length_outlier',
                    'field': field_name,
                    'severity': 'low',
                    'count': len(length_outliers),
                    'description': f'Found {len(length_outliers)} values with unusual lengths'
                })

        # Detect character encoding anomalies
        encoding_issues = []
        for i, value in enumerate(string_series):
            try:
                value.encode('utf-8')
            except UnicodeEncodeError:
                encoding_issues.append(i)

        if encoding_issues:
            anomalies.append({
                'type': 'pattern_anomaly',
                'method': 'encoding_issue',
                'field': field_name,
                'severity': 'high',
                'count': len(encoding_issues),
                'description': f'Found {len(encoding_issues)} values with encoding issues'
            })

        return anomalies

    async def _detect_domain_anomalies(self, series: pd.Series, field_name: str, field_profile: FieldProfile) -> List[Dict[str, Any]]:
        """Detect domain-specific anomalies"""
        anomalies = []

        # Email domain anomalies
        if field_profile.inferred_type == DataType.EMAIL:
            email_series = series.astype(str)
            domains = email_series.str.extract(r'@(.+)$')[0]
            domain_counts = domains.value_counts()

            # Flag domains used only once (potential typos)
            single_use_domains = domain_counts[domain_counts == 1]
            if len(single_use_domains) > len(domain_counts) * 0.3:  # More than 30% single-use domains
                anomalies.append({
                    'type': 'domain_anomaly',
                    'method': 'single_use_domains',
                    'field': field_name,
                    'severity': 'medium',
                    'count': len(single_use_domains),
                    'description': f'High number of single-use email domains: {len(single_use_domains)}'
                })

        # Date anomalies
        if field_profile.inferred_type in [DataType.DATE, DataType.DATETIME]:
            try:
                date_series = pd.to_datetime(series, errors='coerce').dropna()

                # Future dates
                future_dates = date_series[date_series > datetime.now()]
                if len(future_dates) > 0:
                    anomalies.append({
                        'type': 'domain_anomaly',
                        'method': 'future_dates',
                        'field': field_name,
                        'severity': 'high',
                        'count': len(future_dates),
                        'description': f'Found {len(future_dates)} future dates'
                    })

                # Very old dates
                very_old = date_series[date_series < datetime(1900, 1, 1)]
                if len(very_old) > 0:
                    anomalies.append({
                        'type': 'domain_anomaly',
                        'method': 'very_old_dates',
                        'field': field_name,
                        'severity': 'medium',
                        'count': len(very_old),
                        'description': f'Found {len(very_old)} suspiciously old dates'
                    })

            except:
                pass

        return anomalies

    async def _detect_cross_field_anomalies(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Detect anomalies across multiple fields"""
        anomalies = []

        # Check for impossible combinations
        # Example: end_date before start_date
        date_columns = []
        for column in df.columns:
            if 'date' in column.lower() or 'time' in column.lower():
                try:
                    pd.to_datetime(df[column].dropna().iloc[0])
                    date_columns.append(column)
                except:
                    pass

        # Look for start/end date pairs
        for i, col1 in enumerate(date_columns):
            for col2 in date_columns[i+1:]:
                if ('start' in col1.lower() and 'end' in col2.lower()) or \
                   ('begin' in col1.lower() and 'end' in col2.lower()):

                    try:
                        date1 = pd.to_datetime(df[col1], errors='coerce')
                        date2 = pd.to_datetime(df[col2], errors='coerce')

                        invalid_ranges = ((date1 > date2) & date1.notna() & date2.notna()).sum()

                        if invalid_ranges > 0:
                            anomalies.append({
                                'type': 'cross_field_anomaly',
                                'method': 'invalid_date_range',
                                'fields': [col1, col2],
                                'severity': 'high',
                                'count': invalid_ranges,
                                'description': f'{invalid_ranges} records where {col1} > {col2}'
                            })
                    except:
                        pass

        return anomalies

class ComprehensiveProfiler:
    """Main profiling orchestrator"""

    def __init__(self):
        self.type_inference = TypeInferenceEngine()
        self.pattern_analyzer = PatternAnalyzer()
        self.anomaly_detector = AnomalyDetector()

    async def profile_dataset(self, data: Union[List[Dict[str, Any]], pd.DataFrame],
                            dataset_id: str = None,
                            sample_size: Optional[int] = None) -> DatasetProfile:
        """
        Generate comprehensive dataset profile

        Args:
            data: Dataset to profile (list of dicts or DataFrame)
            dataset_id: Unique identifier for the dataset
            sample_size: Sample size for large datasets

        Returns:
            Comprehensive dataset profile
        """
        start_time = datetime.now()

        # Convert to DataFrame if needed
        if isinstance(data, list):
            df = pd.DataFrame(data)
        else:
            df = data.copy()

        # Generate dataset ID if not provided
        if dataset_id is None:
            dataset_id = self._generate_dataset_id(df)

        # Sample for performance if needed
        original_size = len(df)
        if sample_size and len(df) > sample_size:
            df = df.sample(n=sample_size, random_state=42)

        logger.info(f"Profiling dataset {dataset_id}: {len(df)} records, {len(df.columns)} fields")

        # Profile each field
        field_profiles = []
        for column in df.columns:
            field_profile = await self._profile_field(df[column], column)
            field_profiles.append(field_profile)

        # Analyze relationships
        relationships = await self._analyze_relationships(df, field_profiles)

        # Detect anomalies
        anomalies = await self.anomaly_detector.detect_anomalies(df, field_profiles)

        # Generate data lineage info
        data_lineage = self._generate_data_lineage(df, dataset_id)

        # Calculate quality summary
        quality_summary = self._calculate_quality_summary(field_profiles, anomalies)

        # Generate recommendations
        recommendations = self._generate_recommendations(field_profiles, anomalies, quality_summary)

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        return DatasetProfile(
            dataset_id=dataset_id,
            total_records=original_size,
            total_fields=len(df.columns),
            memory_usage_mb=df.memory_usage(deep=True).sum() / 1024 / 1024,
            profiling_duration_seconds=duration,
            field_profiles=field_profiles,
            relationships=relationships,
            anomalies=anomalies,
            data_lineage=data_lineage,
            quality_summary=quality_summary,
            recommendations=recommendations,
            created_at=start_time
        )

    async def _profile_field(self, series: pd.Series, field_name: str) -> FieldProfile:
        """Profile a single field comprehensively"""
        # Basic statistics
        total_count = len(series)
        null_count = series.isnull().sum()
        unique_count = series.nunique()
        completeness_ratio = (total_count - null_count) / total_count if total_count > 0 else 0
        uniqueness_ratio = unique_count / total_count if total_count > 0 else 0

        # Type inference
        inferred_type, type_confidence = await self.type_inference.infer_type(series)

        # Pattern analysis
        patterns = await self.pattern_analyzer.analyze_patterns(series)

        # Type-specific statistics
        statistics = {}
        if inferred_type in [DataType.INTEGER, DataType.FLOAT]:
            statistics = self._calculate_numeric_statistics(series)
        elif inferred_type == DataType.STRING:
            statistics = self._calculate_string_statistics(series)
        elif inferred_type in [DataType.DATE, DataType.DATETIME]:
            statistics = self._calculate_datetime_statistics(series)

        # Calculate quality score
        quality_score = self._calculate_field_quality_score(
            completeness_ratio, uniqueness_ratio, type_confidence, patterns
        )

        # Generate recommendations
        recommendations = self._generate_field_recommendations(
            field_name, inferred_type, completeness_ratio, uniqueness_ratio, patterns
        )

        return FieldProfile(
            name=field_name,
            inferred_type=inferred_type,
            confidence=type_confidence,
            total_count=total_count,
            null_count=null_count,
            unique_count=unique_count,
            completeness_ratio=completeness_ratio,
            uniqueness_ratio=uniqueness_ratio,
            patterns=patterns.get('detected_patterns', []),
            statistics=statistics,
            recommendations=recommendations,
            quality_score=quality_score
        )

    def _calculate_numeric_statistics(self, series: pd.Series) -> Dict[str, Any]:
        """Calculate statistics for numeric fields"""
        numeric_series = pd.to_numeric(series, errors='coerce').dropna()

        if len(numeric_series) == 0:
            return {}

        return {
            'mean': float(numeric_series.mean()),
            'median': float(numeric_series.median()),
            'mode': float(numeric_series.mode().iloc[0]) if len(numeric_series.mode()) > 0 else None,
            'std': float(numeric_series.std()),
            'variance': float(numeric_series.var()),
            'min': float(numeric_series.min()),
            'max': float(numeric_series.max()),
            'range': float(numeric_series.max() - numeric_series.min()),
            'q25': float(numeric_series.quantile(0.25)),
            'q75': float(numeric_series.quantile(0.75)),
            'skewness': float(numeric_series.skew()),
            'kurtosis': float(numeric_series.kurtosis()),
            'zeros_count': int((numeric_series == 0).sum()),
            'negative_count': int((numeric_series < 0).sum()),
            'positive_count': int((numeric_series > 0).sum())
        }

    def _calculate_string_statistics(self, series: pd.Series) -> Dict[str, Any]:
        """Calculate statistics for string fields"""
        string_series = series.dropna().astype(str)

        if len(string_series) == 0:
            return {}

        lengths = string_series.str.len()

        return {
            'avg_length': float(lengths.mean()),
            'min_length': int(lengths.min()),
            'max_length': int(lengths.max()),
            'std_length': float(lengths.std()),
            'empty_count': int((string_series == '').sum()),
            'whitespace_only_count': int(string_series.str.strip().eq('').sum()),
            'most_common_value': string_series.mode().iloc[0] if len(string_series.mode()) > 0 else None,
            'unique_words': len(set(' '.join(string_series).split())),
            'special_chars_count': int(string_series.str.contains(r'[^a-zA-Z0-9\s]', na=False).sum())
        }

    def _calculate_datetime_statistics(self, series: pd.Series) -> Dict[str, Any]:
        """Calculate statistics for datetime fields"""
        try:
            datetime_series = pd.to_datetime(series, errors='coerce').dropna()

            if len(datetime_series) == 0:
                return {}

            return {
                'earliest': datetime_series.min().isoformat(),
                'latest': datetime_series.max().isoformat(),
                'range_days': (datetime_series.max() - datetime_series.min()).days,
                'most_common_year': int(datetime_series.dt.year.mode().iloc[0]) if len(datetime_series) > 0 else None,
                'most_common_month': int(datetime_series.dt.month.mode().iloc[0]) if len(datetime_series) > 0 else None,
                'most_common_day_of_week': int(datetime_series.dt.dayofweek.mode().iloc[0]) if len(datetime_series) > 0 else None,
                'weekend_count': int(datetime_series.dt.dayofweek.isin([5, 6]).sum()),
                'business_hours_count': int(datetime_series.dt.hour.between(9, 17).sum())
            }
        except:
            return {}

    def _calculate_field_quality_score(self, completeness_ratio: float, uniqueness_ratio: float,
                                     type_confidence: float, patterns: Dict[str, Any]) -> float:
        """Calculate overall quality score for a field"""
        # Weighted scoring
        scores = {
            'completeness': completeness_ratio * 0.3,
            'type_confidence': type_confidence * 0.3,
            'pattern_consistency': self._calculate_pattern_consistency_score(patterns) * 0.2,
            'uniqueness_appropriateness': self._calculate_uniqueness_score(uniqueness_ratio) * 0.2
        }

        return sum(scores.values())

    def _calculate_pattern_consistency_score(self, patterns: Dict[str, Any]) -> float:
        """Calculate pattern consistency score"""
        format_consistency = patterns.get('format_consistency', {})
        consistency_ratio = format_consistency.get('format_consistency_ratio', 0)
        return min(consistency_ratio, 1.0)

    def _calculate_uniqueness_score(self, uniqueness_ratio: float) -> float:
        """Calculate appropriateness of uniqueness ratio"""
        # Good uniqueness is context-dependent
        # High uniqueness is good for IDs, low for categories
        if 0.1 <= uniqueness_ratio <= 0.9:  # Reasonable range
            return 1.0
        elif uniqueness_ratio < 0.05:  # Very low uniqueness (potentially categorical)
            return 0.8
        elif uniqueness_ratio > 0.95:  # Very high uniqueness (potentially identifier)
            return 0.8
        else:
            return 0.6

    def _generate_field_recommendations(self, field_name: str, inferred_type: DataType,
                                      completeness_ratio: float, uniqueness_ratio: float,
                                      patterns: Dict[str, Any]) -> List[str]:
        """Generate field-specific recommendations"""
        recommendations = []

        # Completeness recommendations
        if completeness_ratio < 0.8:
            recommendations.append(f"Improve data collection for {field_name} (only {completeness_ratio:.1%} complete)")

        # Type-specific recommendations
        if inferred_type == DataType.STRING and uniqueness_ratio > 0.95:
            recommendations.append(f"Consider if {field_name} should be treated as an identifier")

        if inferred_type == DataType.CATEGORICAL and uniqueness_ratio > 0.5:
            recommendations.append(f"High cardinality in {field_name} - consider grouping categories")

        # Pattern recommendations
        format_consistency = patterns.get('format_consistency', {})
        if format_consistency.get('unique_formats', 0) > 5:
            recommendations.append(f"Inconsistent formats in {field_name} - consider standardization")

        return recommendations

    async def _analyze_relationships(self, df: pd.DataFrame, field_profiles: List[FieldProfile]) -> Dict[str, Any]:
        """Analyze relationships between fields"""
        relationships = {
            'correlations': {},
            'functional_dependencies': [],
            'inclusion_dependencies': []
        }

        # Numeric correlations
        numeric_columns = [fp.name for fp in field_profiles if fp.inferred_type in [DataType.INTEGER, DataType.FLOAT]]
        if len(numeric_columns) > 1:
            numeric_df = df[numeric_columns].apply(pd.to_numeric, errors='coerce')
            correlations = numeric_df.corr()

            # Store significant correlations
            for i, col1 in enumerate(numeric_columns):
                for j, col2 in enumerate(numeric_columns[i+1:], i+1):
                    corr_value = correlations.iloc[i, j]
                    if abs(corr_value) > 0.7:  # Strong correlation threshold
                        relationships['correlations'][f"{col1}__{col2}"] = {
                            'correlation': float(corr_value),
                            'strength': 'strong' if abs(corr_value) > 0.9 else 'moderate'
                        }

        # Functional dependencies (simple heuristic)
        for fp1 in field_profiles:
            for fp2 in field_profiles:
                if fp1.name != fp2.name and fp1.uniqueness_ratio > 0.9:  # Potential key
                    # Check if fp1 determines fp2
                    grouped = df.groupby(fp1.name)[fp2.name].nunique()
                    if (grouped == 1).all():  # Perfect functional dependency
                        relationships['functional_dependencies'].append({
                            'determinant': fp1.name,
                            'dependent': fp2.name,
                            'confidence': 1.0
                        })

        return relationships

    def _generate_dataset_id(self, df: pd.DataFrame) -> str:
        """Generate unique dataset identifier"""
        content_hash = hashlib.md5(
            f"{df.shape[0]}_{df.shape[1]}_{list(df.columns)}".encode()
        ).hexdigest()[:8]
        return f"dataset_{content_hash}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def _generate_data_lineage(self, df: pd.DataFrame, dataset_id: str) -> Dict[str, Any]:
        """Generate data lineage information"""
        return {
            'dataset_id': dataset_id,
            'source': 'profiling_session',
            'created_at': datetime.now().isoformat(),
            'schema_version': '1.0',
            'transformations': [],  # Would be populated in real pipeline
            'dependencies': []       # Would include upstream datasets
        }

    def _calculate_quality_summary(self, field_profiles: List[FieldProfile], anomalies: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate overall dataset quality summary"""
        if not field_profiles:
            return {}

        avg_completeness = sum(fp.completeness_ratio for fp in field_profiles) / len(field_profiles)
        avg_quality_score = sum(fp.quality_score for fp in field_profiles) / len(field_profiles)

        high_severity_anomalies = sum(1 for a in anomalies if a.get('severity') == 'high')
        medium_severity_anomalies = sum(1 for a in anomalies if a.get('severity') == 'medium')

        return {
            'overall_quality_score': avg_quality_score,
            'completeness_score': avg_completeness,
            'anomaly_count': len(anomalies),
            'high_severity_issues': high_severity_anomalies,
            'medium_severity_issues': medium_severity_anomalies,
            'fields_with_issues': len([fp for fp in field_profiles if fp.quality_score < 0.7]),
            'total_fields_profiled': len(field_profiles)
        }

    def _generate_recommendations(self, field_profiles: List[FieldProfile], anomalies: List[Dict[str, Any]],
                                quality_summary: Dict[str, Any]) -> List[str]:
        """Generate dataset-level recommendations"""
        recommendations = []

        # Quality-based recommendations
        if quality_summary.get('overall_quality_score', 0) < 0.7:
            recommendations.append("🔴 Overall data quality needs improvement")

        if quality_summary.get('high_severity_issues', 0) > 0:
            recommendations.append("🚨 Address high-severity anomalies immediately")

        if quality_summary.get('completeness_score', 0) < 0.8:
            recommendations.append("📊 Improve data collection processes to reduce missing values")

        # Field-specific aggregated recommendations
        identifier_fields = [fp for fp in field_profiles if fp.inferred_type == DataType.IDENTIFIER]
        if len(identifier_fields) > 3:
            recommendations.append("🔑 Multiple identifier fields detected - consider normalizing data model")

        categorical_fields = [fp for fp in field_profiles if fp.inferred_type == DataType.CATEGORICAL]
        high_cardinality_categorical = [fp for fp in categorical_fields if fp.uniqueness_ratio > 0.3]
        if high_cardinality_categorical:
            recommendations.append("📈 Some categorical fields have high cardinality - consider grouping")

        # Performance recommendations
        if quality_summary.get('total_fields_profiled', 0) > 50:
            recommendations.append("⚡ Large number of fields - consider implementing field-level monitoring")

        return recommendations