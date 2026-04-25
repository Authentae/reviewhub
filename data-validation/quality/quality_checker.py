"""
Advanced Data Quality Checking Engine

Implements comprehensive quality validation including:
- Null/missing value analysis
- Outlier detection using statistical methods
- Business rule enforcement
- Referential integrity validation
- Statistical validation and distribution analysis
"""

import asyncio
import logging
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass
from enum import Enum
import pandas as pd
import numpy as np
from scipy import stats
from pydantic import BaseModel, ValidationError

from ..core.models import (
    ReviewValidationModel, BusinessInfo, ReviewerInfo,
    QualityMetrics, ValidationLevel, Platform
)

logger = logging.getLogger(__name__)

class QualityIssueType(str, Enum):
    """Types of data quality issues"""
    MISSING_DATA = "missing_data"
    DUPLICATE_DATA = "duplicate_data"
    OUTLIER_DETECTED = "outlier_detected"
    INVALID_FORMAT = "invalid_format"
    REFERENTIAL_INTEGRITY = "referential_integrity"
    BUSINESS_RULE_VIOLATION = "business_rule_violation"
    STATISTICAL_ANOMALY = "statistical_anomaly"
    TEMPORAL_INCONSISTENCY = "temporal_inconsistency"

class QualityIssueSeverity(str, Enum):
    """Severity levels for quality issues"""
    CRITICAL = "critical"  # Data corruption, security issues
    HIGH = "high"         # Business logic violations
    MEDIUM = "medium"     # Data quality degradation
    LOW = "low"          # Minor inconsistencies
    INFO = "info"        # Statistical observations

@dataclass
class QualityIssue:
    """Represents a data quality issue"""
    issue_type: QualityIssueType
    severity: QualityIssueSeverity
    field_name: str
    message: str
    value: Any = None
    expected_value: Any = None
    suggestion: Optional[str] = None
    metadata: Dict[str, Any] = None

@dataclass
class QualityReport:
    """Data quality assessment report"""
    total_records: int
    valid_records: int
    invalid_records: int
    completeness_score: float  # 0-1
    accuracy_score: float      # 0-1
    consistency_score: float   # 0-1
    overall_score: float       # 0-1
    issues: List[QualityIssue]
    field_statistics: Dict[str, Any]
    recommendations: List[str]
    timestamp: datetime

class DataQualityChecker:
    """Advanced data quality validation engine"""

    def __init__(self, validation_level: ValidationLevel = ValidationLevel.STANDARD):
        self.validation_level = validation_level
        self.business_rules = self._initialize_business_rules()
        self.statistical_thresholds = self._initialize_statistical_thresholds()
        self.reference_data = self._initialize_reference_data()

    def _initialize_business_rules(self) -> Dict[str, Any]:
        """Initialize business validation rules"""
        return {
            'review_rating_range': (1, 5),
            'review_text_min_length': 10,
            'review_text_max_length': 5000,
            'business_phone_formats': [
                r'^\+?\d{10,15}$',  # International format
                r'^\(\d{3}\)\s?\d{3}-\d{4}$',  # US format
                r'^\d{2}-\d{4}-\d{4}$'  # Thai format
            ],
            'email_domains_whitelist': None,  # None means all domains allowed
            'max_reviews_per_user_per_day': 50,
            'min_time_between_reviews_same_business': timedelta(hours=1),
            'suspicious_rating_patterns': {
                'all_same_rating': 0.95,  # >95% same rating is suspicious
                'too_many_extremes': 0.8   # >80% 1s or 5s is suspicious
            }
        }

    def _initialize_statistical_thresholds(self) -> Dict[str, float]:
        """Initialize statistical validation thresholds"""
        return {
            'outlier_z_score_threshold': 3.0,
            'outlier_iqr_multiplier': 1.5,
            'missing_data_threshold': 0.05,  # 5% missing data triggers warning
            'duplicate_threshold': 0.02,     # 2% duplicates triggers warning
            'correlation_threshold': 0.9,    # High correlation threshold
            'variance_threshold': 0.001      # Low variance threshold
        }

    def _initialize_reference_data(self) -> Dict[str, Set[str]]:
        """Initialize reference data for validation"""
        return {
            'valid_currencies': {'USD', 'THB', 'EUR', 'GBP', 'JPY'},
            'valid_languages': {'en', 'th', 'zh', 'es', 'fr'},
            'valid_countries': {'US', 'TH', 'CN', 'GB', 'FR', 'DE'},
            'business_categories': {
                'restaurant', 'hotel', 'retail', 'service', 'entertainment',
                'healthcare', 'education', 'automotive', 'beauty', 'fitness'
            }
        }

    async def check_data_quality(self, data: List[Dict[str, Any]]) -> QualityReport:
        """
        Comprehensive data quality assessment

        Args:
            data: List of data records to validate

        Returns:
            QualityReport with detailed assessment
        """
        logger.info(f"Starting quality check for {len(data)} records")

        # Convert to DataFrame for statistical analysis
        df = pd.DataFrame(data)

        issues: List[QualityIssue] = []
        field_stats = {}

        # Run all quality checks
        completeness_issues, completeness_score = await self._check_completeness(df)
        accuracy_issues, accuracy_score = await self._check_accuracy(data, df)
        consistency_issues, consistency_score = await self._check_consistency(df)
        outlier_issues = await self._detect_outliers(df)
        business_rule_issues = await self._validate_business_rules(data)
        referential_issues = await self._check_referential_integrity(data)
        temporal_issues = await self._check_temporal_consistency(data)

        # Combine all issues
        all_issues = (
            completeness_issues + accuracy_issues + consistency_issues +
            outlier_issues + business_rule_issues + referential_issues + temporal_issues
        )

        # Calculate field statistics
        field_stats = self._calculate_field_statistics(df)

        # Calculate overall scores
        valid_count = len(data) - len([i for i in all_issues if i.severity in [QualityIssueSeverity.CRITICAL, QualityIssueSeverity.HIGH]])
        overall_score = (completeness_score + accuracy_score + consistency_score) / 3

        # Generate recommendations
        recommendations = self._generate_recommendations(all_issues, field_stats)

        report = QualityReport(
            total_records=len(data),
            valid_records=valid_count,
            invalid_records=len(data) - valid_count,
            completeness_score=completeness_score,
            accuracy_score=accuracy_score,
            consistency_score=consistency_score,
            overall_score=overall_score,
            issues=all_issues,
            field_statistics=field_stats,
            recommendations=recommendations,
            timestamp=datetime.now()
        )

        logger.info(f"Quality check complete. Overall score: {overall_score:.2f}")
        return report

    async def _check_completeness(self, df: pd.DataFrame) -> Tuple[List[QualityIssue], float]:
        """Check data completeness (missing values)"""
        issues = []

        missing_stats = df.isnull().sum()
        total_records = len(df)

        completeness_scores = []

        for column in df.columns:
            missing_count = missing_stats[column]
            missing_ratio = missing_count / total_records if total_records > 0 else 0
            completeness_scores.append(1 - missing_ratio)

            if missing_ratio > self.statistical_thresholds['missing_data_threshold']:
                severity = QualityIssueSeverity.HIGH if missing_ratio > 0.2 else QualityIssueSeverity.MEDIUM

                issues.append(QualityIssue(
                    issue_type=QualityIssueType.MISSING_DATA,
                    severity=severity,
                    field_name=column,
                    message=f"High missing data rate: {missing_ratio:.1%} ({missing_count}/{total_records})",
                    suggestion=f"Investigate data source for {column} field",
                    metadata={'missing_count': missing_count, 'missing_ratio': missing_ratio}
                ))

        overall_completeness = statistics.mean(completeness_scores) if completeness_scores else 0
        return issues, overall_completeness

    async def _check_accuracy(self, data: List[Dict[str, Any]], df: pd.DataFrame) -> Tuple[List[QualityIssue], float]:
        """Check data accuracy using validation models"""
        issues = []
        valid_count = 0

        for i, record in enumerate(data):
            try:
                # Validate against Pydantic model
                if 'rating' in record:  # Assume review data
                    ReviewValidationModel(**record)
                elif 'business_name' in record:  # Assume business data
                    BusinessInfo(**record)
                elif 'reviewer_id' in record:  # Assume reviewer data
                    ReviewerInfo(**record)

                valid_count += 1

            except ValidationError as e:
                for error in e.errors():
                    field_name = '.'.join(str(loc) for loc in error['loc'])
                    issues.append(QualityIssue(
                        issue_type=QualityIssueType.INVALID_FORMAT,
                        severity=QualityIssueSeverity.HIGH,
                        field_name=field_name,
                        message=f"Validation error: {error['msg']}",
                        value=error.get('input'),
                        suggestion=f"Fix {field_name} format or value",
                        metadata={'record_index': i, 'error_type': error['type']}
                    ))

        accuracy_score = valid_count / len(data) if data else 0
        return issues, accuracy_score

    async def _check_consistency(self, df: pd.DataFrame) -> Tuple[List[QualityIssue], float]:
        """Check data consistency across fields and records"""
        issues = []
        consistency_scores = []

        # Check duplicate records
        if len(df) > 1:
            duplicates = df.duplicated()
            duplicate_count = duplicates.sum()
            duplicate_ratio = duplicate_count / len(df)

            if duplicate_ratio > self.statistical_thresholds['duplicate_threshold']:
                issues.append(QualityIssue(
                    issue_type=QualityIssueType.DUPLICATE_DATA,
                    severity=QualityIssueSeverity.MEDIUM,
                    field_name="all_fields",
                    message=f"High duplicate rate: {duplicate_ratio:.1%} ({duplicate_count} duplicates)",
                    suggestion="Remove duplicates or investigate data source",
                    metadata={'duplicate_count': duplicate_count}
                ))

            consistency_scores.append(1 - duplicate_ratio)

        # Check field format consistency
        for column in df.select_dtypes(include=['object']).columns:
            if column in df.columns:
                # Check for mixed formats in same field
                unique_patterns = set()
                for value in df[column].dropna():
                    if isinstance(value, str):
                        # Simple pattern detection
                        pattern = self._detect_string_pattern(value)
                        unique_patterns.add(pattern)

                if len(unique_patterns) > 3:  # Too many different patterns
                    issues.append(QualityIssue(
                        issue_type=QualityIssueType.INVALID_FORMAT,
                        severity=QualityIssueSeverity.MEDIUM,
                        field_name=column,
                        message=f"Inconsistent formats detected: {len(unique_patterns)} patterns",
                        suggestion=f"Standardize {column} format",
                        metadata={'patterns': list(unique_patterns)}
                    ))
                    consistency_scores.append(0.7)
                else:
                    consistency_scores.append(1.0)

        overall_consistency = statistics.mean(consistency_scores) if consistency_scores else 1.0
        return issues, overall_consistency

    async def _detect_outliers(self, df: pd.DataFrame) -> List[QualityIssue]:
        """Detect statistical outliers in numeric data"""
        issues = []

        numeric_columns = df.select_dtypes(include=[np.number]).columns

        for column in numeric_columns:
            data_series = df[column].dropna()

            if len(data_series) < 10:  # Need sufficient data for outlier detection
                continue

            # Z-score method
            z_scores = np.abs(stats.zscore(data_series))
            outlier_indices = np.where(z_scores > self.statistical_thresholds['outlier_z_score_threshold'])[0]

            # IQR method
            Q1 = data_series.quantile(0.25)
            Q3 = data_series.quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - self.statistical_thresholds['outlier_iqr_multiplier'] * IQR
            upper_bound = Q3 + self.statistical_thresholds['outlier_iqr_multiplier'] * IQR

            iqr_outliers = data_series[(data_series < lower_bound) | (data_series > upper_bound)]

            # Combine outlier detection methods
            if len(outlier_indices) > 0 or len(iqr_outliers) > 0:
                outlier_count = max(len(outlier_indices), len(iqr_outliers))
                outlier_ratio = outlier_count / len(data_series)

                severity = QualityIssueSeverity.HIGH if outlier_ratio > 0.1 else QualityIssueSeverity.MEDIUM

                issues.append(QualityIssue(
                    issue_type=QualityIssueType.OUTLIER_DETECTED,
                    severity=severity,
                    field_name=column,
                    message=f"Statistical outliers detected: {outlier_count} values ({outlier_ratio:.1%})",
                    suggestion=f"Review outlier values in {column} field",
                    metadata={
                        'outlier_count': outlier_count,
                        'mean': float(data_series.mean()),
                        'std': float(data_series.std()),
                        'bounds': {'lower': float(lower_bound), 'upper': float(upper_bound)}
                    }
                ))

        return issues

    async def _validate_business_rules(self, data: List[Dict[str, Any]]) -> List[QualityIssue]:
        """Validate business-specific rules"""
        issues = []

        for i, record in enumerate(data):
            # Rating range validation
            if 'rating' in record:
                rating = record['rating']
                min_rating, max_rating = self.business_rules['review_rating_range']

                if not (min_rating <= rating <= max_rating):
                    issues.append(QualityIssue(
                        issue_type=QualityIssueType.BUSINESS_RULE_VIOLATION,
                        severity=QualityIssueSeverity.HIGH,
                        field_name="rating",
                        message=f"Rating {rating} outside valid range [{min_rating}-{max_rating}]",
                        value=rating,
                        expected_value=f"[{min_rating}-{max_rating}]",
                        metadata={'record_index': i}
                    ))

            # Review text length validation
            if 'review_text' in record:
                text = record.get('review_text', '')
                min_len = self.business_rules['review_text_min_length']
                max_len = self.business_rules['review_text_max_length']

                if len(text) < min_len:
                    issues.append(QualityIssue(
                        issue_type=QualityIssueType.BUSINESS_RULE_VIOLATION,
                        severity=QualityIssueSeverity.MEDIUM,
                        field_name="review_text",
                        message=f"Review text too short: {len(text)} chars (min: {min_len})",
                        suggestion="Encourage more detailed reviews",
                        metadata={'record_index': i, 'text_length': len(text)}
                    ))

                elif len(text) > max_len:
                    issues.append(QualityIssue(
                        issue_type=QualityIssueType.BUSINESS_RULE_VIOLATION,
                        severity=QualityIssueSeverity.MEDIUM,
                        field_name="review_text",
                        message=f"Review text too long: {len(text)} chars (max: {max_len})",
                        suggestion="Implement text truncation or pagination",
                        metadata={'record_index': i, 'text_length': len(text)}
                    ))

            # Business category validation
            if 'category' in record:
                category = record['category']
                valid_categories = self.reference_data['business_categories']

                if category not in valid_categories:
                    issues.append(QualityIssue(
                        issue_type=QualityIssueType.BUSINESS_RULE_VIOLATION,
                        severity=QualityIssueSeverity.MEDIUM,
                        field_name="category",
                        message=f"Unknown business category: {category}",
                        value=category,
                        suggestion="Add to category whitelist or standardize categories",
                        metadata={'record_index': i, 'valid_categories': list(valid_categories)}
                    ))

        return issues

    async def _check_referential_integrity(self, data: List[Dict[str, Any]]) -> List[QualityIssue]:
        """Check referential integrity between related fields"""
        issues = []

        # Extract IDs for cross-referencing
        business_ids = set()
        reviewer_ids = set()
        review_business_refs = []
        review_reviewer_refs = []

        for i, record in enumerate(data):
            if 'business_id' in record:
                if record.get('business_name'):  # This is a business record
                    business_ids.add(record['business_id'])
                else:  # This is a review referencing a business
                    review_business_refs.append((i, record['business_id']))

            if 'reviewer_id' in record:
                if record.get('reviewer_name'):  # This is a reviewer record
                    reviewer_ids.add(record['reviewer_id'])
                else:  # This is a review referencing a reviewer
                    review_reviewer_refs.append((i, record['reviewer_id']))

        # Check business references
        for record_index, business_id in review_business_refs:
            if business_id not in business_ids:
                issues.append(QualityIssue(
                    issue_type=QualityIssueType.REFERENTIAL_INTEGRITY,
                    severity=QualityIssueSeverity.HIGH,
                    field_name="business_id",
                    message=f"Review references non-existent business: {business_id}",
                    value=business_id,
                    suggestion="Ensure business data is loaded before reviews",
                    metadata={'record_index': record_index}
                ))

        # Check reviewer references
        for record_index, reviewer_id in review_reviewer_refs:
            if reviewer_id not in reviewer_ids:
                issues.append(QualityIssue(
                    issue_type=QualityIssueType.REFERENTIAL_INTEGRITY,
                    severity=QualityIssueSeverity.HIGH,
                    field_name="reviewer_id",
                    message=f"Review references non-existent reviewer: {reviewer_id}",
                    value=reviewer_id,
                    suggestion="Ensure reviewer data is loaded before reviews",
                    metadata={'record_index': record_index}
                ))

        return issues

    async def _check_temporal_consistency(self, data: List[Dict[str, Any]]) -> List[QualityIssue]:
        """Check temporal consistency in timestamp fields"""
        issues = []

        # Collect timestamps for analysis
        review_times = []

        for i, record in enumerate(data):
            if 'created_at' in record:
                try:
                    if isinstance(record['created_at'], str):
                        timestamp = datetime.fromisoformat(record['created_at'].replace('Z', '+00:00'))
                    else:
                        timestamp = record['created_at']

                    review_times.append((i, timestamp))

                    # Check for future dates
                    if timestamp > datetime.now():
                        issues.append(QualityIssue(
                            issue_type=QualityIssueType.TEMPORAL_INCONSISTENCY,
                            severity=QualityIssueSeverity.HIGH,
                            field_name="created_at",
                            message=f"Future timestamp detected: {timestamp}",
                            value=timestamp.isoformat(),
                            suggestion="Verify system clock and data source timestamps",
                            metadata={'record_index': i}
                        ))

                    # Check for very old dates (likely data errors)
                    if timestamp < datetime(2000, 1, 1):
                        issues.append(QualityIssue(
                            issue_type=QualityIssueType.TEMPORAL_INCONSISTENCY,
                            severity=QualityIssueSeverity.MEDIUM,
                            field_name="created_at",
                            message=f"Suspiciously old timestamp: {timestamp}",
                            value=timestamp.isoformat(),
                            suggestion="Verify timestamp format and data migration",
                            metadata={'record_index': i}
                        ))

                except (ValueError, TypeError) as e:
                    issues.append(QualityIssue(
                        issue_type=QualityIssueType.INVALID_FORMAT,
                        severity=QualityIssueSeverity.HIGH,
                        field_name="created_at",
                        message=f"Invalid timestamp format: {record['created_at']}",
                        value=record['created_at'],
                        suggestion="Standardize timestamp format (ISO 8601)",
                        metadata={'record_index': i, 'error': str(e)}
                    ))

        # Check for temporal ordering issues
        review_times.sort(key=lambda x: x[1])  # Sort by timestamp

        # Detect suspicious burst patterns (many reviews in short time)
        if len(review_times) > 1:
            time_gaps = []
            for j in range(1, len(review_times)):
                gap = (review_times[j][1] - review_times[j-1][1]).total_seconds()
                time_gaps.append(gap)

            # Check for suspiciously fast review submissions
            very_short_gaps = [gap for gap in time_gaps if gap < 10]  # Less than 10 seconds
            if len(very_short_gaps) > len(time_gaps) * 0.1:  # More than 10% very short gaps
                issues.append(QualityIssue(
                    issue_type=QualityIssueType.TEMPORAL_INCONSISTENCY,
                    severity=QualityIssueSeverity.MEDIUM,
                    field_name="created_at",
                    message=f"Suspicious review burst pattern: {len(very_short_gaps)} reviews within 10 seconds",
                    suggestion="Investigate potential bot activity or data import issues",
                    metadata={'short_gaps_count': len(very_short_gaps), 'total_gaps': len(time_gaps)}
                ))

        return issues

    def _detect_string_pattern(self, text: str) -> str:
        """Detect pattern in string for consistency checking"""
        if not text:
            return "empty"

        # Simple pattern detection
        if text.isdigit():
            return "numeric"
        elif '@' in text and '.' in text:
            return "email"
        elif text.startswith(('http://', 'https://')):
            return "url"
        elif len(text) == 36 and text.count('-') == 4:
            return "uuid"
        elif all(c.isalpha() or c.isspace() for c in text):
            return "alphabetic"
        else:
            return "mixed"

    def _calculate_field_statistics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate comprehensive field statistics"""
        stats = {}

        for column in df.columns:
            col_stats = {
                'data_type': str(df[column].dtype),
                'total_count': len(df[column]),
                'null_count': df[column].isnull().sum(),
                'unique_count': df[column].nunique(),
                'completeness_ratio': (len(df[column]) - df[column].isnull().sum()) / len(df[column])
            }

            if df[column].dtype in ['int64', 'float64']:
                # Numeric statistics
                col_stats.update({
                    'mean': float(df[column].mean()),
                    'median': float(df[column].median()),
                    'std': float(df[column].std()),
                    'min': float(df[column].min()),
                    'max': float(df[column].max()),
                    'q25': float(df[column].quantile(0.25)),
                    'q75': float(df[column].quantile(0.75))
                })

            elif df[column].dtype == 'object':
                # String statistics
                text_lengths = df[column].dropna().astype(str).str.len()
                col_stats.update({
                    'avg_length': float(text_lengths.mean()) if len(text_lengths) > 0 else 0,
                    'min_length': int(text_lengths.min()) if len(text_lengths) > 0 else 0,
                    'max_length': int(text_lengths.max()) if len(text_lengths) > 0 else 0,
                    'most_common': df[column].mode().iloc[0] if len(df[column].mode()) > 0 else None
                })

            stats[column] = col_stats

        return stats

    def _generate_recommendations(self, issues: List[QualityIssue], field_stats: Dict[str, Any]) -> List[str]:
        """Generate actionable recommendations based on quality issues"""
        recommendations = []

        # Group issues by type
        issue_counts = {}
        for issue in issues:
            issue_type = issue.issue_type
            severity = issue.severity
            key = f"{issue_type}_{severity}"
            issue_counts[key] = issue_counts.get(key, 0) + 1

        # High-priority recommendations
        if issue_counts.get('referential_integrity_high', 0) > 0:
            recommendations.append(
                "🔴 Critical: Fix referential integrity violations before processing data"
            )

        if issue_counts.get('missing_data_high', 0) > 0:
            recommendations.append(
                "🟡 Implement data collection improvements to reduce missing values"
            )

        if issue_counts.get('business_rule_violation_high', 0) > 0:
            recommendations.append(
                "🟡 Strengthen input validation at data entry points"
            )

        # Performance recommendations
        total_issues = sum(issue_counts.values())
        if total_issues > len(field_stats) * 2:  # More than 2 issues per field on average
            recommendations.append(
                "⚡ Consider implementing real-time validation to catch issues earlier"
            )

        # Data governance recommendations
        if issue_counts.get('duplicate_data_medium', 0) > 0:
            recommendations.append(
                "📋 Implement deduplication process in data pipeline"
            )

        if issue_counts.get('outlier_detected_medium', 0) > 0:
            recommendations.append(
                "📊 Set up automated outlier monitoring and alerting"
            )

        # Default recommendation if no issues
        if not recommendations:
            recommendations.append(
                "✅ Data quality looks good! Consider setting up monitoring for ongoing validation"
            )

        return recommendations

class QualityProfiler:
    """Data profiling for quality assessment"""

    def __init__(self):
        self.profile_cache = {}

    async def profile_dataset(self, data: List[Dict[str, Any]],
                            sample_size: Optional[int] = None) -> Dict[str, Any]:
        """
        Generate comprehensive data profile

        Args:
            data: Dataset to profile
            sample_size: Optional sampling for large datasets

        Returns:
            Comprehensive data profile
        """
        if sample_size and len(data) > sample_size:
            import random
            data = random.sample(data, sample_size)

        df = pd.DataFrame(data)

        profile = {
            'dataset_info': {
                'total_records': len(df),
                'total_fields': len(df.columns),
                'memory_usage_mb': df.memory_usage(deep=True).sum() / 1024 / 1024,
                'profiling_timestamp': datetime.now().isoformat()
            },
            'field_profiles': {},
            'correlations': {},
            'data_patterns': {},
            'recommendations': []
        }

        # Profile each field
        for column in df.columns:
            profile['field_profiles'][column] = await self._profile_field(df[column])

        # Calculate correlations for numeric fields
        numeric_df = df.select_dtypes(include=[np.number])
        if len(numeric_df.columns) > 1:
            profile['correlations'] = numeric_df.corr().to_dict()

        # Detect patterns
        profile['data_patterns'] = self._detect_data_patterns(df)

        # Generate profiling recommendations
        profile['recommendations'] = self._generate_profiling_recommendations(profile)

        return profile

    async def _profile_field(self, series: pd.Series) -> Dict[str, Any]:
        """Generate detailed profile for a single field"""
        profile = {
            'name': series.name,
            'data_type': str(series.dtype),
            'total_count': len(series),
            'null_count': series.isnull().sum(),
            'unique_count': series.nunique(),
            'completeness_ratio': (len(series) - series.isnull().sum()) / len(series),
            'uniqueness_ratio': series.nunique() / len(series) if len(series) > 0 else 0
        }

        # Type-specific profiling
        if series.dtype in ['int64', 'float64']:
            profile.update(self._profile_numeric_field(series))
        elif series.dtype == 'object':
            profile.update(self._profile_text_field(series))
        elif series.dtype == 'datetime64[ns]':
            profile.update(self._profile_datetime_field(series))

        return profile

    def _profile_numeric_field(self, series: pd.Series) -> Dict[str, Any]:
        """Profile numeric field"""
        clean_series = series.dropna()

        if len(clean_series) == 0:
            return {'profile_type': 'numeric', 'statistics': {}}

        return {
            'profile_type': 'numeric',
            'statistics': {
                'mean': float(clean_series.mean()),
                'median': float(clean_series.median()),
                'mode': float(clean_series.mode().iloc[0]) if len(clean_series.mode()) > 0 else None,
                'std': float(clean_series.std()),
                'variance': float(clean_series.var()),
                'skewness': float(clean_series.skew()),
                'kurtosis': float(clean_series.kurtosis()),
                'min': float(clean_series.min()),
                'max': float(clean_series.max()),
                'range': float(clean_series.max() - clean_series.min()),
                'q25': float(clean_series.quantile(0.25)),
                'q50': float(clean_series.quantile(0.5)),
                'q75': float(clean_series.quantile(0.75)),
                'iqr': float(clean_series.quantile(0.75) - clean_series.quantile(0.25))
            },
            'distribution': {
                'histogram': self._create_histogram(clean_series),
                'is_normal': self._test_normality(clean_series)
            }
        }

    def _profile_text_field(self, series: pd.Series) -> Dict[str, Any]:
        """Profile text field"""
        clean_series = series.dropna().astype(str)

        if len(clean_series) == 0:
            return {'profile_type': 'text', 'statistics': {}}

        lengths = clean_series.str.len()

        return {
            'profile_type': 'text',
            'statistics': {
                'avg_length': float(lengths.mean()),
                'min_length': int(lengths.min()),
                'max_length': int(lengths.max()),
                'std_length': float(lengths.std()),
                'empty_strings': int((clean_series == '').sum()),
                'most_common': clean_series.mode().iloc[0] if len(clean_series.mode()) > 0 else None,
                'least_common': clean_series.value_counts().tail(1).index[0] if len(clean_series) > 0 else None
            },
            'patterns': {
                'contains_numbers': int(clean_series.str.contains(r'\d').sum()),
                'contains_special_chars': int(clean_series.str.contains(r'[^a-zA-Z0-9\s]').sum()),
                'all_uppercase': int(clean_series.str.isupper().sum()),
                'all_lowercase': int(clean_series.str.islower().sum()),
                'title_case': int(clean_series.str.istitle().sum())
            },
            'top_values': clean_series.value_counts().head(10).to_dict()
        }

    def _profile_datetime_field(self, series: pd.Series) -> Dict[str, Any]:
        """Profile datetime field"""
        clean_series = series.dropna()

        if len(clean_series) == 0:
            return {'profile_type': 'datetime', 'statistics': {}}

        return {
            'profile_type': 'datetime',
            'statistics': {
                'min_date': clean_series.min().isoformat(),
                'max_date': clean_series.max().isoformat(),
                'date_range_days': (clean_series.max() - clean_series.min()).days,
                'most_common_hour': int(clean_series.dt.hour.mode().iloc[0]) if len(clean_series) > 0 else None,
                'most_common_day': int(clean_series.dt.day_of_week.mode().iloc[0]) if len(clean_series) > 0 else None,
                'most_common_month': int(clean_series.dt.month.mode().iloc[0]) if len(clean_series) > 0 else None
            },
            'patterns': {
                'weekend_count': int(clean_series.dt.day_of_week.isin([5, 6]).sum()),
                'business_hours_count': int(clean_series.dt.hour.between(9, 17).sum()),
                'recent_data_ratio': float((clean_series >= clean_series.max() - timedelta(days=30)).sum() / len(clean_series))
            }
        }

    def _create_histogram(self, series: pd.Series, bins: int = 20) -> Dict[str, List]:
        """Create histogram data for visualization"""
        hist, bin_edges = np.histogram(series, bins=bins)
        return {
            'counts': hist.tolist(),
            'bin_edges': bin_edges.tolist()
        }

    def _test_normality(self, series: pd.Series) -> Dict[str, Any]:
        """Test if data follows normal distribution"""
        try:
            statistic, p_value = stats.normaltest(series.dropna())
            return {
                'is_normal': p_value > 0.05,
                'p_value': float(p_value),
                'statistic': float(statistic)
            }
        except:
            return {'is_normal': None, 'error': 'Could not perform normality test'}

    def _detect_data_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Detect common data patterns across the dataset"""
        patterns = {
            'potential_identifiers': [],
            'categorical_fields': [],
            'high_cardinality_fields': [],
            'constant_fields': [],
            'nearly_unique_fields': []
        }

        for column in df.columns:
            uniqueness_ratio = df[column].nunique() / len(df) if len(df) > 0 else 0

            # Potential identifier fields (high uniqueness)
            if uniqueness_ratio > 0.95:
                patterns['potential_identifiers'].append(column)

            # Nearly unique fields (might be identifiers)
            elif uniqueness_ratio > 0.8:
                patterns['nearly_unique_fields'].append(column)

            # Categorical fields (low uniqueness but not constant)
            elif uniqueness_ratio < 0.1 and df[column].nunique() > 1:
                patterns['categorical_fields'].append(column)

            # High cardinality fields (many unique values)
            elif df[column].nunique() > len(df) * 0.5:
                patterns['high_cardinality_fields'].append(column)

            # Constant fields
            elif df[column].nunique() <= 1:
                patterns['constant_fields'].append(column)

        return patterns

    def _generate_profiling_recommendations(self, profile: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on data profile"""
        recommendations = []

        # Check for potential data issues
        patterns = profile['data_patterns']

        if patterns['constant_fields']:
            recommendations.append(
                f"🗂️ Consider removing constant fields: {', '.join(patterns['constant_fields'])}"
            )

        if patterns['high_cardinality_fields']:
            recommendations.append(
                f"📊 High cardinality fields may need indexing: {', '.join(patterns['high_cardinality_fields'])}"
            )

        if patterns['potential_identifiers']:
            recommendations.append(
                f"🔑 Potential identifier fields detected: {', '.join(patterns['potential_identifiers'])}"
            )

        # Check field quality
        low_completeness_fields = [
            field for field, profile_data in profile['field_profiles'].items()
            if profile_data['completeness_ratio'] < 0.8
        ]

        if low_completeness_fields:
            recommendations.append(
                f"⚠️ Low completeness fields need attention: {', '.join(low_completeness_fields)}"
            )

        return recommendations