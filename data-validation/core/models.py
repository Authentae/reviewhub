"""
Core Pydantic Models for Data Validation
Comprehensive schema definitions with custom validators and business rules
"""

from typing import Dict, List, Any, Optional, Union, Literal, Annotated
from datetime import datetime, date, timezone
from enum import Enum
from decimal import Decimal
import re
import uuid
import hashlib
from urllib.parse import urlparse

from pydantic import (
    BaseModel,
    Field,
    validator,
    root_validator,
    EmailStr,
    HttpUrl,
    ValidationError,
    constr,
    confloat,
    conint,
    SecretStr
)
from pydantic.types import UUID4, Json
from pydantic.validators import datetime_validator


class ValidationLevel(str, Enum):
    """Validation strictness levels"""
    BASIC = "basic"
    STANDARD = "standard"
    COMPREHENSIVE = "comprehensive"
    CUSTOM = "custom"


class Platform(str, Enum):
    """Supported review platforms"""
    GOOGLE = "google"
    YELP = "yelp"
    FACEBOOK = "facebook"
    TRIPADVISOR = "tripadvisor"
    TRUSTPILOT = "trustpilot"
    WONGNAI = "wongnai"


class Language(str, Enum):
    """Supported languages"""
    EN = "en"
    TH = "th"
    ES = "es"
    FR = "fr"
    DE = "de"
    IT = "it"
    PT = "pt"
    JA = "ja"
    KO = "ko"
    ZH = "zh"


class DataQualityLevel(str, Enum):
    """Data quality levels"""
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    INVALID = "invalid"


# Custom types with validation
PhoneNumber = Annotated[str, Field(regex=r'^\+?[\d\s\-\(\)]{10,20}$')]
ReviewText = Annotated[str, Field(min_length=1, max_length=10000)]
BusinessName = Annotated[str, Field(min_length=1, max_length=200)]
Rating = Annotated[float, Field(ge=0.0, le=5.0)]
Percentage = Annotated[float, Field(ge=0.0, le=100.0)]


class BaseValidationModel(BaseModel):
    """Base model with common validation features"""

    class Config:
        # Enable validation on assignment
        validate_assignment = True
        # Use enum values in JSON
        use_enum_values = True
        # Allow population by field name or alias
        allow_population_by_field_name = True
        # JSON encoders for custom types
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat(),
            Decimal: lambda v: float(v),
            UUID4: lambda v: str(v),
        }
        # Additional validation settings
        anystr_strip_whitespace = True
        min_anystr_length = 0
        max_anystr_length = 100000

    @root_validator
    def validate_timestamps(cls, values):
        """Ensure timestamp consistency across fields"""
        created_at = values.get('created_at')
        updated_at = values.get('updated_at')

        if created_at and updated_at:
            if updated_at < created_at:
                raise ValueError('updated_at cannot be before created_at')

        return values


class GeoLocation(BaseValidationModel):
    """Geographic location with validation"""
    latitude: confloat(ge=-90.0, le=90.0)
    longitude: confloat(ge=-180.0, le=180.0)
    accuracy_meters: Optional[conint(ge=0)] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None

    @validator('postal_code')
    def validate_postal_code(cls, v, values):
        """Validate postal code format by country"""
        if not v:
            return v

        country = values.get('country', '').upper()

        patterns = {
            'US': r'^\d{5}(-\d{4})?$',
            'UK': r'^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$',
            'CA': r'^[A-Z]\d[A-Z]\s?\d[A-Z]\d$',
            'TH': r'^\d{5}$',
        }

        if country in patterns and not re.match(patterns[country], v):
            raise ValueError(f'Invalid postal code format for {country}')

        return v


class ContactInfo(BaseValidationModel):
    """Contact information with validation"""
    email: Optional[EmailStr] = None
    phone: Optional[PhoneNumber] = None
    website: Optional[HttpUrl] = None

    @validator('phone')
    def validate_phone_format(cls, v):
        """Additional phone validation"""
        if v and len(re.sub(r'[\s\-\(\)]', '', v)) < 10:
            raise ValueError('Phone number must have at least 10 digits')
        return v


class BusinessInfo(BaseValidationModel):
    """Business information with comprehensive validation"""
    business_id: str = Field(..., regex=r'^[a-zA-Z0-9_-]+$', min_length=1, max_length=100)
    name: BusinessName
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    location: Optional[GeoLocation] = None
    contact: Optional[ContactInfo] = None
    established_date: Optional[date] = None
    verified: bool = False
    platform_specific_data: Dict[Platform, Dict[str, Any]] = Field(default_factory=dict)

    @validator('established_date')
    def validate_established_date(cls, v):
        """Ensure business wasn't established in the future"""
        if v and v > date.today():
            raise ValueError('Established date cannot be in the future')
        return v

    @validator('platform_specific_data')
    def validate_platform_data(cls, v):
        """Validate platform-specific data structure"""
        for platform, data in v.items():
            if not isinstance(data, dict):
                raise ValueError(f'Platform data for {platform} must be a dictionary')
        return v


class ReviewerInfo(BaseValidationModel):
    """Reviewer information with privacy considerations"""
    reviewer_id: str = Field(..., min_length=1, max_length=100)
    display_name: Optional[str] = Field(None, max_length=100)
    profile_url: Optional[HttpUrl] = None
    verified: bool = False
    review_count: Optional[conint(ge=0)] = None
    average_rating: Optional[Rating] = None
    account_created: Optional[datetime] = None
    location: Optional[GeoLocation] = None

    # PII fields (should be encrypted/hashed)
    email_hash: Optional[str] = Field(None, regex=r'^[a-f0-9]{64}$')
    phone_hash: Optional[str] = Field(None, regex=r'^[a-f0-9]{64}$')

    @validator('email_hash', 'phone_hash')
    def validate_hash_format(cls, v):
        """Ensure hash is properly formatted SHA-256"""
        if v and len(v) != 64:
            raise ValueError('Hash must be 64-character SHA-256')
        return v


class SentimentAnalysis(BaseValidationModel):
    """Sentiment analysis results with confidence scores"""
    sentiment_label: Literal["positive", "negative", "neutral"]
    confidence_score: confloat(ge=0.0, le=1.0)
    polarity: confloat(ge=-1.0, le=1.0)
    subjectivity: confloat(ge=0.0, le=1.0)
    emotion_scores: Optional[Dict[str, confloat(ge=0.0, le=1.0)]] = None
    language_detected: Optional[Language] = None
    model_version: str = Field(..., regex=r'^\d+\.\d+\.\d+$')

    @validator('emotion_scores')
    def validate_emotion_scores(cls, v):
        """Validate emotion score format"""
        if v:
            valid_emotions = {'joy', 'anger', 'fear', 'sadness', 'surprise', 'disgust'}
            for emotion in v.keys():
                if emotion not in valid_emotions:
                    raise ValueError(f'Invalid emotion: {emotion}')
        return v


class QualityMetrics(BaseValidationModel):
    """Data quality metrics for the review"""
    completeness_score: Percentage
    accuracy_score: Percentage
    consistency_score: Percentage
    validity_score: Percentage
    overall_quality: DataQualityLevel
    issues_detected: List[str] = Field(default_factory=list)
    confidence_level: confloat(ge=0.0, le=1.0)

    @validator('overall_quality')
    def validate_overall_quality_consistency(cls, v, values):
        """Ensure overall quality matches component scores"""
        scores = [
            values.get('completeness_score', 0),
            values.get('accuracy_score', 0),
            values.get('consistency_score', 0),
            values.get('validity_score', 0)
        ]

        avg_score = sum(scores) / len(scores) if scores else 0

        quality_thresholds = {
            DataQualityLevel.EXCELLENT: 90,
            DataQualityLevel.GOOD: 75,
            DataQualityLevel.FAIR: 60,
            DataQualityLevel.POOR: 40,
            DataQualityLevel.INVALID: 0,
        }

        expected_quality = DataQualityLevel.INVALID
        for quality, threshold in quality_thresholds.items():
            if avg_score >= threshold:
                expected_quality = quality
                break

        if v != expected_quality:
            values['overall_quality'] = expected_quality

        return values['overall_quality']


class ProcessingMetadata(BaseValidationModel):
    """Metadata about review processing"""
    ingestion_timestamp: datetime
    processing_timestamp: Optional[datetime] = None
    validation_timestamp: Optional[datetime] = None
    source_system: str
    processing_version: str
    pipeline_id: UUID4
    trace_id: Optional[UUID4] = None
    content_hash: str = Field(..., regex=r'^[a-f0-9]{64}$')
    dedupe_signature: Optional[str] = None

    @validator('ingestion_timestamp', 'processing_timestamp', 'validation_timestamp')
    def ensure_timezone_aware(cls, v):
        """Ensure all timestamps are timezone-aware"""
        if v and v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v


class ReviewValidationModel(BaseValidationModel):
    """Comprehensive review validation model"""

    # Core identifiers
    review_id: UUID4 = Field(default_factory=uuid.uuid4)
    platform_review_id: str = Field(..., min_length=1, max_length=200)
    platform: Platform

    # Business and reviewer
    business: BusinessInfo
    reviewer: ReviewerInfo

    # Review content
    rating: Rating
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[ReviewText] = None
    language: Optional[Language] = None

    # Temporal data
    review_date: datetime
    response_date: Optional[datetime] = None

    # Rich content
    photos: List[HttpUrl] = Field(default_factory=list, max_items=20)
    videos: List[HttpUrl] = Field(default_factory=list, max_items=5)

    # Engagement metrics
    helpful_votes: conint(ge=0) = 0
    total_votes: conint(ge=0) = 0

    # Response from business
    business_response: Optional[str] = Field(None, max_length=2000)
    response_date: Optional[datetime] = None

    # Analysis results
    sentiment: Optional[SentimentAnalysis] = None
    quality_metrics: Optional[QualityMetrics] = None

    # Processing metadata
    metadata: ProcessingMetadata

    # Validation configuration
    validation_level: ValidationLevel = ValidationLevel.STANDARD

    @validator('review_date', 'response_date')
    def validate_dates(cls, v):
        """Ensure dates are not in the future and timezone-aware"""
        if v:
            # Ensure timezone awareness
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)

            # Check for future dates
            if v > datetime.now(timezone.utc):
                raise ValueError('Date cannot be in the future')

        return v

    @root_validator
    def validate_review_consistency(cls, values):
        """Cross-field validation for review consistency"""

        # Validate response timing
        review_date = values.get('review_date')
        response_date = values.get('response_date')
        business_response = values.get('business_response')

        if business_response and not response_date:
            raise ValueError('Response date required when business response provided')

        if response_date and review_date:
            if response_date < review_date:
                raise ValueError('Response date cannot be before review date')

        # Validate helpful votes
        helpful_votes = values.get('helpful_votes', 0)
        total_votes = values.get('total_votes', 0)

        if helpful_votes > total_votes:
            raise ValueError('Helpful votes cannot exceed total votes')

        # Validate content requirement based on rating
        rating = values.get('rating')
        content = values.get('content')
        validation_level = values.get('validation_level', ValidationLevel.MODERATE)

        if validation_level == ValidationLevel.STRICT:
            # Extreme ratings should have content
            if rating and (rating <= 2.0 or rating >= 4.5) and not content:
                raise ValueError('Reviews with extreme ratings should include written content')

        # Validate language consistency
        language = values.get('language')
        platform = values.get('platform')

        if platform == Platform.WONGNAI and language and language != Language.TH:
            values['language'] = Language.TH  # Auto-correct for Wongnai

        return values

    @validator('photos', 'videos')
    def validate_media_urls(cls, v):
        """Validate media URLs are accessible"""
        validated_urls = []
        for url in v:
            # Basic URL structure validation
            parsed = urlparse(str(url))
            if not all([parsed.scheme, parsed.netloc]):
                continue

            # Check for supported domains (extend as needed)
            supported_domains = {
                'lh3.googleusercontent.com',
                's3-media1.fl.yelpcdn.com',
                'media-cdn.tripadvisor.com',
                'images.trustpilot.com',
                'img.wongnai.com'
            }

            if any(domain in parsed.netloc for domain in supported_domains):
                validated_urls.append(url)

        return validated_urls

    def generate_content_hash(self) -> str:
        """Generate content hash for deduplication"""
        content_for_hash = f"{self.platform_review_id}{self.platform}{self.business.business_id}{self.rating}{self.content or ''}"
        return hashlib.sha256(content_for_hash.encode()).hexdigest()

    def calculate_quality_score(self) -> float:
        """Calculate overall quality score"""
        if not self.quality_metrics:
            return 0.0

        weights = {
            'completeness': 0.3,
            'accuracy': 0.3,
            'consistency': 0.2,
            'validity': 0.2
        }

        score = (
            self.quality_metrics.completeness_score * weights['completeness'] +
            self.quality_metrics.accuracy_score * weights['accuracy'] +
            self.quality_metrics.consistency_score * weights['consistency'] +
            self.quality_metrics.validity_score * weights['validity']
        ) / 100.0

        return round(score, 3)

    def is_suspicious(self) -> bool:
        """Detect potentially suspicious reviews"""
        suspicious_indicators = []

        # Check for very short time between account creation and review
        if (self.reviewer.account_created and
            self.review_date and
            (self.review_date - self.reviewer.account_created).days < 1):
            suspicious_indicators.append('new_account')

        # Check for extreme rating without content
        if (self.rating in [1.0, 5.0] and
            not self.content):
            suspicious_indicators.append('extreme_rating_no_content')

        # Check for unusual voting patterns
        if (self.total_votes > 0 and
            self.helpful_votes / self.total_votes > 0.95):
            suspicious_indicators.append('unusual_voting_pattern')

        # Check quality metrics
        if (self.quality_metrics and
            self.quality_metrics.overall_quality == DataQualityLevel.POOR):
            suspicious_indicators.append('poor_quality')

        return len(suspicious_indicators) >= 2


class BatchValidationRequest(BaseValidationModel):
    """Request for batch validation of reviews"""
    batch_id: UUID4 = Field(default_factory=uuid.uuid4)
    reviews: List[Dict[str, Any]] = Field(..., min_items=1, max_items=10000)
    validation_config: Dict[str, Any] = Field(default_factory=dict)
    callback_url: Optional[HttpUrl] = None
    priority: Literal["low", "normal", "high"] = "normal"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ValidationResult(BaseValidationModel):
    """Result of validation operation"""
    success: bool
    validated_data: Optional[Dict[str, Any]] = None
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    quality_score: Optional[float] = None
    processing_time_ms: float
    validation_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ValidationReport(BaseValidationModel):
    """Comprehensive validation report"""
    report_id: UUID4 = Field(default_factory=uuid.uuid4)
    total_records: int
    valid_records: int
    invalid_records: int
    validation_rate: Percentage

    error_summary: Dict[str, int] = Field(default_factory=dict)
    quality_distribution: Dict[DataQualityLevel, int] = Field(default_factory=dict)
    platform_breakdown: Dict[Platform, Dict[str, int]] = Field(default_factory=dict)

    average_quality_score: float
    processing_time_seconds: float

    recommendations: List[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Export all models
__all__ = [
    'ValidationLevel',
    'Platform',
    'Language',
    'DataQualityLevel',
    'GeoLocation',
    'ContactInfo',
    'BusinessInfo',
    'ReviewerInfo',
    'SentimentAnalysis',
    'QualityMetrics',
    'ProcessingMetadata',
    'ReviewValidationModel',
    'BatchValidationRequest',
    'ValidationResult',
    'ValidationReport'
]