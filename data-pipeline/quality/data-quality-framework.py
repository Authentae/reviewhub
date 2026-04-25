"""
Data Quality Framework for ReviewHub
Comprehensive data profiling, validation, anomaly detection, and lineage tracking
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import json
import logging
import hashlib
from abc import ABC, abstractmethod
from pathlib import Path
import sqlite3
import warnings
warnings.filterwarnings('ignore')

# Statistical and ML libraries
from scipy import stats
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots


class QualityDimension(Enum):
    """Data quality dimensions"""
    COMPLETENESS = "completeness"
    ACCURACY = "accuracy"
    CONSISTENCY = "consistency"
    VALIDITY = "validity"
    UNIQUENESS = "uniqueness"
    TIMELINESS = "timeliness"
    INTEGRITY = "integrity"


class SeverityLevel(Enum):
    """Severity levels for quality issues"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class QualityRule:
    """Definition of a data quality rule"""
    name: str
    dimension: QualityDimension
    description: str
    rule_type: str  # 'threshold', 'pattern', 'custom'
    parameters: Dict[str, Any]
    severity: SeverityLevel
    enabled: bool = True
    tags: List[str] = field(default_factory=list)


@dataclass
class QualityCheck:
    """Individual quality check result"""
    rule_name: str
    dimension: QualityDimension
    passed: bool
    score: float  # 0.0 to 1.0
    message: str
    details: Dict[str, Any]
    severity: SeverityLevel
    timestamp: datetime
    affected_records: int = 0
    sample_failures: List[Any] = field(default_factory=list)


@dataclass
class QualityReport:
    """Comprehensive quality report"""
    dataset_name: str
    timestamp: datetime
    total_records: int
    checks: List[QualityCheck]
    overall_score: float
    dimension_scores: Dict[QualityDimension, float]
    summary_stats: Dict[str, Any]
    anomalies: List[Dict[str, Any]]
    recommendations: List[str]


class DataProfiler:
    """Statistical profiling of datasets"""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    def profile_dataset(self, df: pd.DataFrame, dataset_name: str = None) -> Dict[str, Any]:
        """Generate comprehensive data profile"""
        profile = {
            'dataset_name': dataset_name,
            'profiling_timestamp': datetime.utcnow().isoformat(),
            'basic_stats': self._basic_statistics(df),
            'column_profiles': self._profile_columns(df),
            'correlation_analysis': self._correlation_analysis(df),
            'data_types': self._analyze_data_types(df),
            'missing_patterns': self._analyze_missing_patterns(df),
            'outlier_analysis': self._detect_outliers(df),
            'distribution_analysis': self._analyze_distributions(df)
        }

        return profile

    def _basic_statistics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Basic dataset statistics"""
        return {
            'total_records': len(df),
            'total_columns': len(df.columns),
            'memory_usage_mb': df.memory_usage(deep=True).sum() / 1024 / 1024,
            'duplicated_records': df.duplicated().sum(),
            'duplicate_rate': df.duplicated().sum() / len(df),
            'missing_cells': df.isnull().sum().sum(),
            'missing_rate': df.isnull().sum().sum() / (len(df) * len(df.columns))
        }

    def _profile_columns(self, df: pd.DataFrame) -> Dict[str, Dict]:
        """Profile individual columns"""
        profiles = {}

        for column in df.columns:
            col_data = df[column]
            dtype = str(col_data.dtype)

            profile = {
                'data_type': dtype,
                'non_null_count': col_data.count(),
                'null_count': col_data.isnull().sum(),
                'null_percentage': (col_data.isnull().sum() / len(df)) * 100,
                'unique_count': col_data.nunique(),
                'unique_percentage': (col_data.nunique() / col_data.count()) * 100 if col_data.count() > 0 else 0
            }

            if pd.api.types.is_numeric_dtype(col_data):
                profile.update(self._numeric_profile(col_data))
            elif pd.api.types.is_string_dtype(col_data) or dtype == 'object':
                profile.update(self._text_profile(col_data))
            elif pd.api.types.is_datetime64_any_dtype(col_data):
                profile.update(self._datetime_profile(col_data))

            profiles[column] = profile

        return profiles

    def _numeric_profile(self, series: pd.Series) -> Dict[str, Any]:
        """Profile numeric columns"""
        numeric_data = series.dropna()

        if len(numeric_data) == 0:
            return {'stats': 'no_data'}

        return {
            'min': float(numeric_data.min()),
            'max': float(numeric_data.max()),
            'mean': float(numeric_data.mean()),
            'median': float(numeric_data.median()),
            'std': float(numeric_data.std()),
            'q25': float(numeric_data.quantile(0.25)),
            'q75': float(numeric_data.quantile(0.75)),
            'iqr': float(numeric_data.quantile(0.75) - numeric_data.quantile(0.25)),
            'skewness': float(stats.skew(numeric_data)),
            'kurtosis': float(stats.kurtosis(numeric_data)),
            'zeros_count': int((numeric_data == 0).sum()),
            'zeros_percentage': float((numeric_data == 0).sum() / len(numeric_data) * 100),
            'negative_count': int((numeric_data < 0).sum()),
            'negative_percentage': float((numeric_data < 0).sum() / len(numeric_data) * 100)
        }

    def _text_profile(self, series: pd.Series) -> Dict[str, Any]:
        """Profile text columns"""
        text_data = series.dropna().astype(str)

        if len(text_data) == 0:
            return {'stats': 'no_data'}

        lengths = text_data.str.len()
        word_counts = text_data.str.split().str.len()

        # Most common values
        value_counts = series.value_counts().head(10)

        return {
            'avg_length': float(lengths.mean()),
            'min_length': int(lengths.min()),
            'max_length': int(lengths.max()),
            'avg_words': float(word_counts.mean()),
            'empty_strings': int((text_data == '').sum()),
            'whitespace_only': int(text_data.str.isspace().sum()),
            'numeric_strings': int(text_data.str.isnumeric().sum()),
            'common_values': value_counts.to_dict(),
            'pattern_analysis': self._analyze_text_patterns(text_data)
        }

    def _datetime_profile(self, series: pd.Series) -> Dict[str, Any]:
        """Profile datetime columns"""
        dt_data = series.dropna()

        if len(dt_data) == 0:
            return {'stats': 'no_data'}

        return {
            'min_date': dt_data.min().isoformat(),
            'max_date': dt_data.max().isoformat(),
            'date_range_days': (dt_data.max() - dt_data.min()).days,
            'future_dates': int((dt_data > datetime.now()).sum()),
            'weekend_dates': int(dt_data.dt.weekday.isin([5, 6]).sum()),
            'hour_distribution': dt_data.dt.hour.value_counts().to_dict() if hasattr(dt_data.dt, 'hour') else {},
            'day_of_week_distribution': dt_data.dt.day_name().value_counts().to_dict()
        }

    def _analyze_text_patterns(self, text_data: pd.Series) -> Dict[str, Any]:
        """Analyze common patterns in text data"""
        import re

        patterns = {
            'email_like': r'\S+@\S+\.\S+',
            'url_like': r'https?://\S+',
            'phone_like': r'\d{3}-\d{3}-\d{4}|\(\d{3}\)\s*\d{3}-\d{4}',
            'numeric_only': r'^\d+$',
            'alphanumeric': r'^[a-zA-Z0-9]+$',
            'contains_special_chars': r'[!@#$%^&*(),.?":{}|<>]'
        }

        pattern_matches = {}
        for pattern_name, pattern in patterns.items():
            matches = text_data.str.contains(pattern, regex=True, na=False)
            pattern_matches[pattern_name] = {
                'count': int(matches.sum()),
                'percentage': float(matches.sum() / len(text_data) * 100)
            }

        return pattern_matches

    def _correlation_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze correlations between numeric columns"""
        numeric_cols = df.select_dtypes(include=[np.number]).columns

        if len(numeric_cols) < 2:
            return {'message': 'insufficient_numeric_columns'}

        correlation_matrix = df[numeric_cols].corr()

        # Find high correlations
        high_correlations = []
        for i in range(len(correlation_matrix.columns)):
            for j in range(i + 1, len(correlation_matrix.columns)):
                corr_value = correlation_matrix.iloc[i, j]
                if abs(corr_value) > 0.7:  # High correlation threshold
                    high_correlations.append({
                        'column1': correlation_matrix.columns[i],
                        'column2': correlation_matrix.columns[j],
                        'correlation': float(corr_value)
                    })

        return {
            'correlation_matrix': correlation_matrix.to_dict(),
            'high_correlations': high_correlations,
            'avg_correlation': float(correlation_matrix.values[np.triu_indices_from(correlation_matrix.values, 1)].mean())
        }

    def _analyze_data_types(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze data type consistency and potential issues"""
        type_analysis = {}

        for column in df.columns:
            col_data = df[column].dropna()

            if len(col_data) == 0:
                continue

            # Try to infer optimal data type
            inferred_type = self._infer_optimal_type(col_data)
            current_type = str(col_data.dtype)

            type_analysis[column] = {
                'current_type': current_type,
                'inferred_type': inferred_type,
                'type_mismatch': inferred_type != current_type,
                'mixed_types': self._detect_mixed_types(col_data)
            }

        return type_analysis

    def _infer_optimal_type(self, series: pd.Series) -> str:
        """Infer optimal data type for a series"""
        # Try to convert to numeric
        try:
            pd.to_numeric(series)
            return 'numeric'
        except (ValueError, TypeError):
            pass

        # Try to convert to datetime
        try:
            pd.to_datetime(series, infer_datetime_format=True)
            return 'datetime'
        except (ValueError, TypeError):
            pass

        # Check if boolean
        unique_vals = set(series.astype(str).str.lower().unique())
        if unique_vals.issubset({'true', 'false', '1', '0', 'yes', 'no'}):
            return 'boolean'

        return 'string'

    def _detect_mixed_types(self, series: pd.Series) -> Dict[str, Any]:
        """Detect mixed data types within a column"""
        type_counts = {}

        for value in series.sample(min(1000, len(series))):  # Sample for performance
            value_type = type(value).__name__
            type_counts[value_type] = type_counts.get(value_type, 0) + 1

        return {
            'type_distribution': type_counts,
            'has_mixed_types': len(type_counts) > 1
        }

    def _analyze_missing_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze patterns in missing data"""
        missing_matrix = df.isnull()

        # Missing data by column
        missing_by_column = missing_matrix.sum().sort_values(ascending=False)

        # Missing data combinations
        missing_combinations = missing_matrix.value_counts().head(10)

        # Consecutive missing values
        consecutive_missing = {}
        for column in df.columns:
            col_missing = df[column].isnull()
            if col_missing.any():
                # Find runs of consecutive True values
                runs = []
                current_run = 0
                for is_missing in col_missing:
                    if is_missing:
                        current_run += 1
                    else:
                        if current_run > 0:
                            runs.append(current_run)
                        current_run = 0
                if current_run > 0:
                    runs.append(current_run)

                consecutive_missing[column] = {
                    'max_consecutive': max(runs) if runs else 0,
                    'avg_consecutive': sum(runs) / len(runs) if runs else 0,
                    'total_runs': len(runs)
                }

        return {
            'missing_by_column': missing_by_column.to_dict(),
            'missing_combinations': missing_combinations.to_dict(),
            'consecutive_missing': consecutive_missing,
            'completely_missing_columns': missing_by_column[missing_by_column == len(df)].index.tolist()
        }

    def _detect_outliers(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Detect outliers using multiple methods"""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        outlier_analysis = {}

        for column in numeric_cols:
            col_data = df[column].dropna()

            if len(col_data) < 10:  # Skip if too few data points
                continue

            # IQR method
            q1 = col_data.quantile(0.25)
            q3 = col_data.quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr

            iqr_outliers = ((col_data < lower_bound) | (col_data > upper_bound))

            # Z-score method
            z_scores = np.abs(stats.zscore(col_data))
            zscore_outliers = z_scores > 3

            # Isolation Forest method
            if len(col_data) > 50:  # Only for sufficient data
                iso_forest = IsolationForest(contamination=0.1, random_state=42)
                outlier_preds = iso_forest.fit_predict(col_data.values.reshape(-1, 1))
                iso_outliers = outlier_preds == -1
            else:
                iso_outliers = np.zeros(len(col_data), dtype=bool)

            outlier_analysis[column] = {
                'iqr_outliers': {
                    'count': int(iqr_outliers.sum()),
                    'percentage': float(iqr_outliers.sum() / len(col_data) * 100),
                    'bounds': {'lower': float(lower_bound), 'upper': float(upper_bound)}
                },
                'zscore_outliers': {
                    'count': int(zscore_outliers.sum()),
                    'percentage': float(zscore_outliers.sum() / len(col_data) * 100)
                },
                'isolation_forest': {
                    'count': int(iso_outliers.sum()),
                    'percentage': float(iso_outliers.sum() / len(col_data) * 100)
                } if len(col_data) > 50 else None
            }

        return outlier_analysis

    def _analyze_distributions(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze distributions of numeric columns"""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        distribution_analysis = {}

        for column in numeric_cols:
            col_data = df[column].dropna()

            if len(col_data) < 10:
                continue

            # Normality tests
            _, shapiro_p = stats.shapiro(col_data.sample(min(5000, len(col_data))))
            _, ks_p = stats.kstest(col_data, 'norm')

            # Distribution fitting
            distributions = ['norm', 'lognorm', 'gamma', 'beta']
            best_distribution = None
            best_p_value = 0

            for dist_name in distributions:
                try:
                    distribution = getattr(stats, dist_name)
                    params = distribution.fit(col_data)
                    _, p_value = stats.kstest(col_data, lambda x: distribution.cdf(x, *params))

                    if p_value > best_p_value:
                        best_p_value = p_value
                        best_distribution = dist_name
                except:
                    pass

            distribution_analysis[column] = {
                'shapiro_p_value': float(shapiro_p),
                'is_normal': shapiro_p > 0.05,
                'ks_p_value': float(ks_p),
                'best_fit_distribution': best_distribution,
                'best_fit_p_value': float(best_p_value),
                'distribution_score': float(best_p_value)
            }

        return distribution_analysis


class QualityValidator:
    """Validates data against quality rules"""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.rules: List[QualityRule] = []

    def add_rule(self, rule: QualityRule):
        """Add a quality rule"""
        self.rules.append(rule)

    def add_standard_rules(self, dataset_type: str = 'reviews'):
        """Add standard quality rules for review data"""
        if dataset_type == 'reviews':
            self._add_review_rules()

    def _add_review_rules(self):
        """Add standard rules for review data"""
        rules = [
            # Completeness rules
            QualityRule(
                name="platform_not_null",
                dimension=QualityDimension.COMPLETENESS,
                description="Platform must be specified",
                rule_type="not_null",
                parameters={"column": "platform"},
                severity=SeverityLevel.CRITICAL
            ),
            QualityRule(
                name="business_id_not_null",
                dimension=QualityDimension.COMPLETENESS,
                description="Business ID must be specified",
                rule_type="not_null",
                parameters={"column": "business_id"},
                severity=SeverityLevel.CRITICAL
            ),
            QualityRule(
                name="rating_not_null",
                dimension=QualityDimension.COMPLETENESS,
                description="Rating must be specified",
                rule_type="not_null",
                parameters={"column": "rating"},
                severity=SeverityLevel.HIGH
            ),

            # Validity rules
            QualityRule(
                name="rating_range",
                dimension=QualityDimension.VALIDITY,
                description="Rating must be between 0 and 5",
                rule_type="range",
                parameters={"column": "rating", "min": 0, "max": 5},
                severity=SeverityLevel.HIGH
            ),
            QualityRule(
                name="valid_platforms",
                dimension=QualityDimension.VALIDITY,
                description="Platform must be from approved list",
                rule_type="allowed_values",
                parameters={
                    "column": "platform",
                    "allowed_values": ["google", "yelp", "facebook", "tripadvisor", "trustpilot", "wongnai"]
                },
                severity=SeverityLevel.HIGH
            ),

            # Consistency rules
            QualityRule(
                name="email_format",
                dimension=QualityDimension.VALIDITY,
                description="Email must follow valid format",
                rule_type="pattern",
                parameters={
                    "column": "reviewer_email",
                    "pattern": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                },
                severity=SeverityLevel.MEDIUM
            ),

            # Timeliness rules
            QualityRule(
                name="review_date_not_future",
                dimension=QualityDimension.TIMELINESS,
                description="Review date cannot be in the future",
                rule_type="date_range",
                parameters={
                    "column": "review_date",
                    "max_date": "now"
                },
                severity=SeverityLevel.HIGH
            ),

            # Uniqueness rules
            QualityRule(
                name="unique_review_id",
                dimension=QualityDimension.UNIQUENESS,
                description="Review IDs must be unique",
                rule_type="unique",
                parameters={"column": "platform_review_id"},
                severity=SeverityLevel.CRITICAL
            ),

            # Text quality rules
            QualityRule(
                name="review_text_length",
                dimension=QualityDimension.VALIDITY,
                description="Review text should be reasonable length",
                rule_type="length_range",
                parameters={
                    "column": "review_text",
                    "min_length": 1,
                    "max_length": 10000
                },
                severity=SeverityLevel.MEDIUM
            )
        ]

        for rule in rules:
            self.add_rule(rule)

    def validate_dataset(self, df: pd.DataFrame, dataset_name: str = None) -> QualityReport:
        """Validate dataset against all rules"""
        checks = []
        dimension_scores = defaultdict(list)

        for rule in self.rules:
            if not rule.enabled:
                continue

            try:
                check = self._execute_rule(df, rule)
                checks.append(check)
                dimension_scores[rule.dimension].append(check.score)

            except Exception as e:
                self.logger.error(f"Failed to execute rule {rule.name}: {e}")
                checks.append(QualityCheck(
                    rule_name=rule.name,
                    dimension=rule.dimension,
                    passed=False,
                    score=0.0,
                    message=f"Rule execution failed: {e}",
                    details={"error": str(e)},
                    severity=rule.severity,
                    timestamp=datetime.utcnow()
                ))

        # Calculate dimension scores
        dim_scores = {}
        for dim, scores in dimension_scores.items():
            dim_scores[dim] = sum(scores) / len(scores) if scores else 0.0

        # Calculate overall score
        overall_score = sum(check.score for check in checks) / len(checks) if checks else 0.0

        # Generate recommendations
        recommendations = self._generate_recommendations(checks)

        return QualityReport(
            dataset_name=dataset_name or "unknown",
            timestamp=datetime.utcnow(),
            total_records=len(df),
            checks=checks,
            overall_score=overall_score,
            dimension_scores=dim_scores,
            summary_stats=self._calculate_summary_stats(checks),
            anomalies=[],  # Will be filled by anomaly detector
            recommendations=recommendations
        )

    def _execute_rule(self, df: pd.DataFrame, rule: QualityRule) -> QualityCheck:
        """Execute a single quality rule"""
        rule_type = rule.rule_type
        params = rule.parameters

        if rule_type == "not_null":
            return self._check_not_null(df, rule, params)
        elif rule_type == "range":
            return self._check_range(df, rule, params)
        elif rule_type == "allowed_values":
            return self._check_allowed_values(df, rule, params)
        elif rule_type == "pattern":
            return self._check_pattern(df, rule, params)
        elif rule_type == "unique":
            return self._check_unique(df, rule, params)
        elif rule_type == "length_range":
            return self._check_length_range(df, rule, params)
        elif rule_type == "date_range":
            return self._check_date_range(df, rule, params)
        else:
            raise ValueError(f"Unknown rule type: {rule_type}")

    def _check_not_null(self, df: pd.DataFrame, rule: QualityRule, params: Dict) -> QualityCheck:
        """Check for null values"""
        column = params["column"]

        if column not in df.columns:
            return self._create_check(rule, False, 0.0, f"Column {column} not found", {"missing_column": True})

        null_count = df[column].isnull().sum()
        total_count = len(df)
        null_rate = null_count / total_count if total_count > 0 else 0

        passed = null_count == 0
        score = 1.0 - null_rate

        message = f"Found {null_count} null values ({null_rate:.1%})"
        details = {"null_count": null_count, "null_rate": null_rate}

        return self._create_check(rule, passed, score, message, details, null_count)

    def _check_range(self, df: pd.DataFrame, rule: QualityRule, params: Dict) -> QualityCheck:
        """Check if values are within specified range"""
        column = params["column"]
        min_val = params.get("min")
        max_val = params.get("max")

        if column not in df.columns:
            return self._create_check(rule, False, 0.0, f"Column {column} not found", {"missing_column": True})

        valid_data = df[column].dropna()
        if len(valid_data) == 0:
            return self._create_check(rule, True, 1.0, "No data to validate", {"no_data": True})

        violations = pd.Series(dtype=bool)

        if min_val is not None:
            violations = violations | (valid_data < min_val)
        if max_val is not None:
            violations = violations | (valid_data > max_val)

        violation_count = violations.sum() if len(violations) > 0 else 0
        violation_rate = violation_count / len(valid_data)

        passed = violation_count == 0
        score = 1.0 - violation_rate

        message = f"Found {violation_count} range violations ({violation_rate:.1%})"
        details = {
            "violation_count": violation_count,
            "violation_rate": violation_rate,
            "range": {"min": min_val, "max": max_val}
        }

        return self._create_check(rule, passed, score, message, details, violation_count)

    def _check_allowed_values(self, df: pd.DataFrame, rule: QualityRule, params: Dict) -> QualityCheck:
        """Check if values are in allowed list"""
        column = params["column"]
        allowed_values = set(params["allowed_values"])

        if column not in df.columns:
            return self._create_check(rule, False, 0.0, f"Column {column} not found", {"missing_column": True})

        valid_data = df[column].dropna()
        if len(valid_data) == 0:
            return self._create_check(rule, True, 1.0, "No data to validate", {"no_data": True})

        invalid_mask = ~valid_data.isin(allowed_values)
        invalid_count = invalid_mask.sum()
        invalid_rate = invalid_count / len(valid_data)

        passed = invalid_count == 0
        score = 1.0 - invalid_rate

        # Get sample of invalid values
        sample_invalid = valid_data[invalid_mask].unique()[:5].tolist()

        message = f"Found {invalid_count} invalid values ({invalid_rate:.1%})"
        details = {
            "invalid_count": invalid_count,
            "invalid_rate": invalid_rate,
            "allowed_values": list(allowed_values),
            "sample_invalid": sample_invalid
        }

        return self._create_check(rule, passed, score, message, details, invalid_count, sample_invalid)

    def _check_pattern(self, df: pd.DataFrame, rule: QualityRule, params: Dict) -> QualityCheck:
        """Check if values match specified pattern"""
        import re

        column = params["column"]
        pattern = params["pattern"]

        if column not in df.columns:
            return self._create_check(rule, False, 0.0, f"Column {column} not found", {"missing_column": True})

        valid_data = df[column].dropna().astype(str)
        if len(valid_data) == 0:
            return self._create_check(rule, True, 1.0, "No data to validate", {"no_data": True})

        matches = valid_data.str.match(pattern, na=False)
        mismatch_count = (~matches).sum()
        mismatch_rate = mismatch_count / len(valid_data)

        passed = mismatch_count == 0
        score = 1.0 - mismatch_rate

        # Get sample of mismatched values
        sample_mismatches = valid_data[~matches].head(5).tolist()

        message = f"Found {mismatch_count} pattern mismatches ({mismatch_rate:.1%})"
        details = {
            "mismatch_count": mismatch_count,
            "mismatch_rate": mismatch_rate,
            "pattern": pattern,
            "sample_mismatches": sample_mismatches
        }

        return self._create_check(rule, passed, score, message, details, mismatch_count, sample_mismatches)

    def _check_unique(self, df: pd.DataFrame, rule: QualityRule, params: Dict) -> QualityCheck:
        """Check for duplicate values"""
        column = params["column"]

        if column not in df.columns:
            return self._create_check(rule, False, 0.0, f"Column {column} not found", {"missing_column": True})

        valid_data = df[column].dropna()
        if len(valid_data) == 0:
            return self._create_check(rule, True, 1.0, "No data to validate", {"no_data": True})

        duplicate_count = valid_data.duplicated().sum()
        duplicate_rate = duplicate_count / len(valid_data)

        passed = duplicate_count == 0
        score = 1.0 - duplicate_rate

        # Get sample of duplicate values
        sample_duplicates = valid_data[valid_data.duplicated()].head(5).tolist()

        message = f"Found {duplicate_count} duplicate values ({duplicate_rate:.1%})"
        details = {
            "duplicate_count": duplicate_count,
            "duplicate_rate": duplicate_rate,
            "unique_count": valid_data.nunique(),
            "sample_duplicates": sample_duplicates
        }

        return self._create_check(rule, passed, score, message, details, duplicate_count, sample_duplicates)

    def _check_length_range(self, df: pd.DataFrame, rule: QualityRule, params: Dict) -> QualityCheck:
        """Check if text length is within range"""
        column = params["column"]
        min_length = params.get("min_length", 0)
        max_length = params.get("max_length", float('inf'))

        if column not in df.columns:
            return self._create_check(rule, False, 0.0, f"Column {column} not found", {"missing_column": True})

        valid_data = df[column].dropna().astype(str)
        if len(valid_data) == 0:
            return self._create_check(rule, True, 1.0, "No data to validate", {"no_data": True})

        lengths = valid_data.str.len()
        violations = (lengths < min_length) | (lengths > max_length)
        violation_count = violations.sum()
        violation_rate = violation_count / len(valid_data)

        passed = violation_count == 0
        score = 1.0 - violation_rate

        message = f"Found {violation_count} length violations ({violation_rate:.1%})"
        details = {
            "violation_count": violation_count,
            "violation_rate": violation_rate,
            "length_range": {"min": min_length, "max": max_length},
            "avg_length": float(lengths.mean()),
            "length_std": float(lengths.std())
        }

        return self._create_check(rule, passed, score, message, details, violation_count)

    def _check_date_range(self, df: pd.DataFrame, rule: QualityRule, params: Dict) -> QualityCheck:
        """Check if dates are within specified range"""
        column = params["column"]
        min_date = params.get("min_date")
        max_date = params.get("max_date")

        if column not in df.columns:
            return self._create_check(rule, False, 0.0, f"Column {column} not found", {"missing_column": True})

        try:
            valid_data = pd.to_datetime(df[column], errors='coerce').dropna()
        except:
            return self._create_check(rule, False, 0.0, f"Cannot parse {column} as dates", {"parse_error": True})

        if len(valid_data) == 0:
            return self._create_check(rule, True, 1.0, "No data to validate", {"no_data": True})

        violations = pd.Series(False, index=valid_data.index)

        if min_date:
            min_dt = pd.to_datetime(min_date) if min_date != "now" else datetime.now()
            violations = violations | (valid_data < min_dt)

        if max_date:
            max_dt = pd.to_datetime(max_date) if max_date != "now" else datetime.now()
            violations = violations | (valid_data > max_dt)

        violation_count = violations.sum()
        violation_rate = violation_count / len(valid_data)

        passed = violation_count == 0
        score = 1.0 - violation_rate

        message = f"Found {violation_count} date range violations ({violation_rate:.1%})"
        details = {
            "violation_count": violation_count,
            "violation_rate": violation_rate,
            "date_range": {"min": str(min_date), "max": str(max_date)}
        }

        return self._create_check(rule, passed, score, message, details, violation_count)

    def _create_check(
        self,
        rule: QualityRule,
        passed: bool,
        score: float,
        message: str,
        details: Dict[str, Any],
        affected_records: int = 0,
        sample_failures: List[Any] = None
    ) -> QualityCheck:
        """Create a QualityCheck result"""
        return QualityCheck(
            rule_name=rule.name,
            dimension=rule.dimension,
            passed=passed,
            score=score,
            message=message,
            details=details,
            severity=rule.severity,
            timestamp=datetime.utcnow(),
            affected_records=affected_records,
            sample_failures=sample_failures or []
        )

    def _calculate_summary_stats(self, checks: List[QualityCheck]) -> Dict[str, Any]:
        """Calculate summary statistics from checks"""
        total_checks = len(checks)
        passed_checks = sum(1 for check in checks if check.passed)

        severity_counts = {}
        for severity in SeverityLevel:
            severity_counts[severity.value] = sum(
                1 for check in checks
                if check.severity == severity
            )

        dimension_stats = {}
        for dimension in QualityDimension:
            dim_checks = [check for check in checks if check.dimension == dimension]
            if dim_checks:
                dimension_stats[dimension.value] = {
                    "total_checks": len(dim_checks),
                    "passed_checks": sum(1 for check in dim_checks if check.passed),
                    "avg_score": sum(check.score for check in dim_checks) / len(dim_checks)
                }

        return {
            "total_checks": total_checks,
            "passed_checks": passed_checks,
            "pass_rate": passed_checks / total_checks if total_checks > 0 else 0,
            "severity_distribution": severity_counts,
            "dimension_statistics": dimension_stats
        }

    def _generate_recommendations(self, checks: List[QualityCheck]) -> List[str]:
        """Generate recommendations based on failed checks"""
        recommendations = []

        # Group failed checks by dimension
        failed_by_dimension = {}
        for check in checks:
            if not check.passed:
                dim = check.dimension
                if dim not in failed_by_dimension:
                    failed_by_dimension[dim] = []
                failed_by_dimension[dim].append(check)

        # Generate dimension-specific recommendations
        if QualityDimension.COMPLETENESS in failed_by_dimension:
            recommendations.append(
                "Address missing data issues by implementing data validation at ingestion points"
            )

        if QualityDimension.VALIDITY in failed_by_dimension:
            recommendations.append(
                "Implement stricter input validation and data type constraints"
            )

        if QualityDimension.UNIQUENESS in failed_by_dimension:
            recommendations.append(
                "Review data deduplication processes and implement unique constraints"
            )

        if QualityDimension.CONSISTENCY in failed_by_dimension:
            recommendations.append(
                "Standardize data formats and implement consistent transformation rules"
            )

        # Critical issues
        critical_checks = [check for check in checks if check.severity == SeverityLevel.CRITICAL and not check.passed]
        if critical_checks:
            recommendations.append(
                f"URGENT: Address {len(critical_checks)} critical data quality issues immediately"
            )

        return recommendations


# Example usage and testing
def example_usage():
    """Example of using the data quality framework"""

    # Create sample review data
    sample_data = pd.DataFrame({
        'platform': ['google', 'yelp', 'facebook', 'invalid_platform', 'google', None],
        'platform_review_id': ['rev_1', 'rev_2', 'rev_3', 'rev_4', 'rev_1', 'rev_6'],  # Duplicate
        'business_id': ['biz_1', 'biz_2', 'biz_3', 'biz_4', 'biz_5', 'biz_6'],
        'rating': [4.5, 3.0, 5.0, 6.0, 2.5, None],  # Invalid rating
        'review_text': ['Great place!', '', 'Excellent service and food', 'A' * 15000, 'Good', None],
        'review_date': [
            '2024-01-15', '2024-02-20', '2024-03-10',
            '2025-12-25', '2024-04-05', '2024-05-15'  # Future date
        ],
        'reviewer_email': ['user@test.com', 'invalid-email', 'user2@test.com', None, 'user3@test.com', 'user4@test.com']
    })

    # Initialize components
    profiler = DataProfiler()
    validator = QualityValidator()
    validator.add_standard_rules('reviews')

    # Profile the data
    print("=== DATA PROFILING ===")
    profile = profiler.profile_dataset(sample_data, "sample_reviews")
    print(f"Dataset: {profile['basic_stats']}")

    # Validate data quality
    print("\n=== DATA QUALITY VALIDATION ===")
    quality_report = validator.validate_dataset(sample_data, "sample_reviews")

    print(f"Overall Score: {quality_report.overall_score:.2f}")
    print(f"Total Checks: {len(quality_report.checks)}")
    print(f"Passed: {sum(1 for c in quality_report.checks if c.passed)}")

    print("\nFailed Checks:")
    for check in quality_report.checks:
        if not check.passed:
            print(f"- {check.rule_name}: {check.message} (Score: {check.score:.2f})")

    print(f"\nRecommendations:")
    for rec in quality_report.recommendations:
        print(f"- {rec}")

    return profile, quality_report


if __name__ == "__main__":
    profile, quality_report = example_usage()