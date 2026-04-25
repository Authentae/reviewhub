"""
Data Ingestion Layer - Source Connectors
Handles data ingestion from multiple review platforms with robust error handling
"""

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, AsyncIterator
import aiohttp
import aiokafka
from tenacity import retry, stop_after_attempt, wait_exponential
import pandas as pd
from pydantic import BaseModel, ValidationError
import hashlib


# Schema definitions
class ReviewSchema(BaseModel):
    """Unified review schema across all platforms"""
    platform: str
    platform_review_id: str
    business_id: str
    reviewer_id: str
    reviewer_name: Optional[str]
    rating: float
    review_text: Optional[str]
    review_date: datetime
    response_text: Optional[str] = None
    response_date: Optional[datetime] = None
    language: Optional[str] = None
    verified_purchase: Optional[bool] = None
    helpful_votes: Optional[int] = 0
    total_votes: Optional[int] = 0
    photos: List[str] = []
    metadata: Dict[str, Any] = {}
    ingestion_timestamp: datetime
    source_url: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


@dataclass
class IngestionMetrics:
    """Metrics for ingestion monitoring"""
    source: str
    records_processed: int
    records_failed: int
    processing_time_seconds: float
    last_successful_timestamp: datetime
    error_rate: float


class DataQualityException(Exception):
    """Raised when data quality checks fail"""
    pass


class SourceConnector(ABC):
    """Abstract base class for all source connectors"""

    def __init__(self, config: Dict[str, Any], kafka_producer: aiokafka.AIOKafkaProducer):
        self.config = config
        self.kafka_producer = kafka_producer
        self.logger = logging.getLogger(f"{self.__class__.__name__}")
        self.metrics = IngestionMetrics(
            source=self.__class__.__name__,
            records_processed=0,
            records_failed=0,
            processing_time_seconds=0.0,
            last_successful_timestamp=datetime.utcnow(),
            error_rate=0.0
        )

    @abstractmethod
    async def extract_reviews(self, business_id: str, since: Optional[datetime] = None) -> AsyncIterator[ReviewSchema]:
        """Extract reviews from the source platform"""
        pass

    @abstractmethod
    def get_platform_name(self) -> str:
        """Return the platform name"""
        pass

    async def validate_review(self, review_data: Dict[str, Any]) -> ReviewSchema:
        """Validate and transform review data to unified schema"""
        try:
            # Add ingestion timestamp
            review_data['ingestion_timestamp'] = datetime.utcnow()
            review_data['platform'] = self.get_platform_name()

            # Validate schema
            review = ReviewSchema(**review_data)

            # Data quality checks
            await self._run_quality_checks(review)

            return review

        except ValidationError as e:
            self.logger.error(f"Schema validation failed: {e}")
            self.metrics.records_failed += 1
            raise DataQualityException(f"Invalid review schema: {e}")

    async def _run_quality_checks(self, review: ReviewSchema):
        """Run data quality checks on review"""
        checks = [
            self._check_rating_range(review),
            self._check_required_fields(review),
            self._check_text_length(review),
            self._check_date_validity(review),
            self._check_duplicate_detection(review)
        ]

        for check in checks:
            if not await check:
                raise DataQualityException(f"Quality check failed for review {review.platform_review_id}")

    async def _check_rating_range(self, review: ReviewSchema) -> bool:
        """Check if rating is within valid range"""
        return 0.0 <= review.rating <= 5.0

    async def _check_required_fields(self, review: ReviewSchema) -> bool:
        """Check if required fields are present"""
        required = [review.platform_review_id, review.business_id, review.rating]
        return all(field is not None for field in required)

    async def _check_text_length(self, review: ReviewSchema) -> bool:
        """Check review text length is reasonable"""
        if review.review_text:
            return 1 <= len(review.review_text) <= 10000
        return True  # Optional field

    async def _check_date_validity(self, review: ReviewSchema) -> bool:
        """Check if review date is reasonable"""
        now = datetime.utcnow()
        # Reviews shouldn't be from the future or more than 10 years old
        return (now - timedelta(days=3650)) <= review.review_date <= now

    async def _check_duplicate_detection(self, review: ReviewSchema) -> bool:
        """Generate content hash for duplicate detection"""
        content = f"{review.platform}{review.business_id}{review.reviewer_id}{review.review_text}{review.review_date}"
        review.metadata['content_hash'] = hashlib.sha256(content.encode()).hexdigest()
        return True

    async def publish_to_kafka(self, review: ReviewSchema, topic: str = "raw-reviews"):
        """Publish validated review to Kafka topic"""
        try:
            message = json.dumps(asdict(review), default=str).encode('utf-8')
            key = f"{review.platform}:{review.platform_review_id}".encode('utf-8')

            await self.kafka_producer.send_and_wait(
                topic,
                value=message,
                key=key,
                headers=[
                    ("platform", review.platform.encode('utf-8')),
                    ("business_id", review.business_id.encode('utf-8')),
                    ("ingestion_time", review.ingestion_timestamp.isoformat().encode('utf-8'))
                ]
            )

            self.metrics.records_processed += 1
            self.metrics.last_successful_timestamp = datetime.utcnow()

        except Exception as e:
            self.logger.error(f"Failed to publish to Kafka: {e}")
            self.metrics.records_failed += 1

            # Send to dead letter queue
            await self._send_to_dlq(review, str(e))
            raise

    async def _send_to_dlq(self, review: ReviewSchema, error_message: str):
        """Send failed messages to dead letter queue"""
        dlq_message = {
            "original_message": asdict(review),
            "error": error_message,
            "timestamp": datetime.utcnow().isoformat(),
            "source": self.get_platform_name()
        }

        try:
            await self.kafka_producer.send_and_wait(
                "dead-letter-queue",
                value=json.dumps(dlq_message).encode('utf-8'),
                key=f"failed:{review.platform}:{review.platform_review_id}".encode('utf-8')
            )
        except Exception as e:
            self.logger.error(f"Failed to send to DLQ: {e}")


class GoogleReviewsConnector(SourceConnector):
    """Google My Business reviews connector"""

    def get_platform_name(self) -> str:
        return "google"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def extract_reviews(self, business_id: str, since: Optional[datetime] = None) -> AsyncIterator[ReviewSchema]:
        """Extract reviews from Google My Business API"""
        self.logger.info(f"Extracting Google reviews for business {business_id}")

        headers = {
            "Authorization": f"Bearer {self.config['google_api_key']}",
            "Content-Type": "application/json"
        }

        # Build API URL with pagination
        base_url = f"https://mybusiness.googleapis.com/v4/accounts/{self.config['account_id']}/locations/{business_id}/reviews"

        async with aiohttp.ClientSession() as session:
            page_token = None

            while True:
                url = base_url
                params = {"pageSize": 100}

                if page_token:
                    params["pageToken"] = page_token

                if since:
                    params["filter"] = f"createTime >= {since.isoformat()}"

                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 429:
                        # Rate limit exceeded
                        retry_after = int(response.headers.get('Retry-After', 60))
                        self.logger.warning(f"Rate limited, waiting {retry_after} seconds")
                        await asyncio.sleep(retry_after)
                        continue

                    response.raise_for_status()
                    data = await response.json()

                    reviews = data.get('reviews', [])

                    for review_data in reviews:
                        try:
                            # Transform Google schema to unified schema
                            unified_review = await self._transform_google_review(review_data, business_id)
                            validated_review = await self.validate_review(unified_review)
                            yield validated_review

                        except Exception as e:
                            self.logger.error(f"Failed to process Google review: {e}")
                            continue

                    # Check for next page
                    page_token = data.get('nextPageToken')
                    if not page_token:
                        break

    async def _transform_google_review(self, review_data: Dict[str, Any], business_id: str) -> Dict[str, Any]:
        """Transform Google review format to unified schema"""
        return {
            "platform_review_id": review_data['reviewId'],
            "business_id": business_id,
            "reviewer_id": review_data['reviewer']['profilePhotoUrl'].split('/')[-1] if 'profilePhotoUrl' in review_data.get('reviewer', {}) else 'anonymous',
            "reviewer_name": review_data.get('reviewer', {}).get('displayName'),
            "rating": float(review_data['starRating']),
            "review_text": review_data.get('comment'),
            "review_date": datetime.fromisoformat(review_data['createTime'].replace('Z', '+00:00')),
            "response_text": review_data.get('reviewReply', {}).get('comment'),
            "response_date": datetime.fromisoformat(review_data['reviewReply']['updateTime'].replace('Z', '+00:00')) if 'reviewReply' in review_data else None,
            "source_url": f"https://maps.google.com/place?q={business_id}",
            "metadata": {
                "google_account_type": review_data.get('reviewer', {}).get('accountType'),
                "google_review_id": review_data['reviewId']
            }
        }


class YelpReviewsConnector(SourceConnector):
    """Yelp reviews connector"""

    def get_platform_name(self) -> str:
        return "yelp"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def extract_reviews(self, business_id: str, since: Optional[datetime] = None) -> AsyncIterator[ReviewSchema]:
        """Extract reviews from Yelp Fusion API"""
        self.logger.info(f"Extracting Yelp reviews for business {business_id}")

        headers = {
            "Authorization": f"Bearer {self.config['yelp_api_key']}",
            "Content-Type": "application/json"
        }

        url = f"https://api.yelp.com/v3/businesses/{business_id}/reviews"

        async with aiohttp.ClientSession() as session:
            offset = 0
            limit = 50

            while True:
                params = {"limit": limit, "offset": offset, "sort_by": "time_created"}

                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 429:
                        retry_after = int(response.headers.get('Retry-After', 60))
                        self.logger.warning(f"Rate limited, waiting {retry_after} seconds")
                        await asyncio.sleep(retry_after)
                        continue

                    response.raise_for_status()
                    data = await response.json()

                    reviews = data.get('reviews', [])

                    if not reviews:
                        break

                    for review_data in reviews:
                        try:
                            review_date = datetime.fromisoformat(review_data['time_created'])

                            # Skip if before 'since' timestamp
                            if since and review_date < since:
                                continue

                            unified_review = await self._transform_yelp_review(review_data, business_id)
                            validated_review = await self.validate_review(unified_review)
                            yield validated_review

                        except Exception as e:
                            self.logger.error(f"Failed to process Yelp review: {e}")
                            continue

                    offset += limit

                    # Yelp API has a maximum of 3 pages
                    if offset >= 150:
                        break

    async def _transform_yelp_review(self, review_data: Dict[str, Any], business_id: str) -> Dict[str, Any]:
        """Transform Yelp review format to unified schema"""
        return {
            "platform_review_id": review_data['id'],
            "business_id": business_id,
            "reviewer_id": review_data['user']['id'],
            "reviewer_name": review_data['user']['name'],
            "rating": float(review_data['rating']),
            "review_text": review_data.get('text'),
            "review_date": datetime.fromisoformat(review_data['time_created']),
            "source_url": review_data.get('url'),
            "metadata": {
                "yelp_user_profile": review_data['user'].get('profile_url'),
                "yelp_user_image": review_data['user'].get('image_url'),
                "yelp_review_id": review_data['id']
            }
        }


class WongnaiReviewsConnector(SourceConnector):
    """Wongnai reviews connector (Thailand)"""

    def get_platform_name(self) -> str:
        return "wongnai"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def extract_reviews(self, business_id: str, since: Optional[datetime] = None) -> AsyncIterator[ReviewSchema]:
        """Extract reviews from Wongnai API"""
        self.logger.info(f"Extracting Wongnai reviews for business {business_id}")

        headers = {
            "Authorization": f"Bearer {self.config['wongnai_api_key']}",
            "Content-Type": "application/json",
            "Accept-Language": "th-TH,en-US"
        }

        url = f"https://api.wongnai.com/v2/restaurants/{business_id}/reviews"

        async with aiohttp.ClientSession() as session:
            page = 1

            while True:
                params = {"page": page, "per_page": 50, "order_by": "created_at"}

                if since:
                    params["since"] = since.isoformat()

                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 429:
                        retry_after = int(response.headers.get('Retry-After', 60))
                        self.logger.warning(f"Rate limited, waiting {retry_after} seconds")
                        await asyncio.sleep(retry_after)
                        continue

                    response.raise_for_status()
                    data = await response.json()

                    reviews = data.get('data', {}).get('reviews', [])

                    if not reviews:
                        break

                    for review_data in reviews:
                        try:
                            unified_review = await self._transform_wongnai_review(review_data, business_id)
                            validated_review = await self.validate_review(unified_review)
                            yield validated_review

                        except Exception as e:
                            self.logger.error(f"Failed to process Wongnai review: {e}")
                            continue

                    # Check if there are more pages
                    pagination = data.get('data', {}).get('pagination', {})
                    if page >= pagination.get('total_pages', 1):
                        break

                    page += 1

    async def _transform_wongnai_review(self, review_data: Dict[str, Any], business_id: str) -> Dict[str, Any]:
        """Transform Wongnai review format to unified schema"""
        return {
            "platform_review_id": str(review_data['id']),
            "business_id": business_id,
            "reviewer_id": str(review_data['user']['id']),
            "reviewer_name": review_data['user'].get('display_name'),
            "rating": float(review_data['rating']),
            "review_text": review_data.get('comment'),
            "review_date": datetime.fromisoformat(review_data['created_at']),
            "language": "th",  # Thai language
            "photos": review_data.get('photos', []),
            "helpful_votes": review_data.get('helpful_count', 0),
            "source_url": review_data.get('url'),
            "metadata": {
                "wongnai_user_level": review_data['user'].get('level'),
                "wongnai_review_id": review_data['id'],
                "wongnai_photos": review_data.get('photos', [])
            }
        }


class IngestionOrchestrator:
    """Orchestrates data ingestion from multiple sources"""

    def __init__(self, kafka_config: Dict[str, Any]):
        self.kafka_config = kafka_config
        self.kafka_producer = None
        self.connectors: List[SourceConnector] = []
        self.logger = logging.getLogger(self.__class__.__name__)

    async def initialize(self):
        """Initialize Kafka producer and connectors"""
        self.kafka_producer = aiokafka.AIOKafkaProducer(
            bootstrap_servers=self.kafka_config['bootstrap_servers'],
            value_serializer=None,  # We handle serialization manually
            key_serializer=None,
            compression_type='gzip',
            batch_size=16384,
            linger_ms=10
        )
        await self.kafka_producer.start()

    def add_connector(self, connector_class, config: Dict[str, Any]):
        """Add a source connector"""
        connector = connector_class(config, self.kafka_producer)
        self.connectors.append(connector)

    async def run_ingestion(self, business_ids: List[str], since: Optional[datetime] = None):
        """Run ingestion for all connectors and business IDs"""
        tasks = []

        for business_id in business_ids:
            for connector in self.connectors:
                task = self._ingest_from_connector(connector, business_id, since)
                tasks.append(task)

        # Run all ingestion tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Log results
        for i, result in enumerate(results):
            connector = self.connectors[i % len(self.connectors)]
            if isinstance(result, Exception):
                self.logger.error(f"Ingestion failed for {connector.get_platform_name()}: {result}")
            else:
                self.logger.info(f"Ingestion completed for {connector.get_platform_name()}: {result} reviews")

    async def _ingest_from_connector(self, connector: SourceConnector, business_id: str, since: Optional[datetime] = None) -> int:
        """Ingest reviews from a single connector"""
        start_time = datetime.utcnow()
        review_count = 0

        try:
            async for review in connector.extract_reviews(business_id, since):
                await connector.publish_to_kafka(review)
                review_count += 1

            # Update metrics
            end_time = datetime.utcnow()
            connector.metrics.processing_time_seconds = (end_time - start_time).total_seconds()
            connector.metrics.error_rate = connector.metrics.records_failed / max(connector.metrics.records_processed, 1)

            return review_count

        except Exception as e:
            self.logger.error(f"Connector {connector.get_platform_name()} failed: {e}")
            raise

    async def get_metrics(self) -> List[IngestionMetrics]:
        """Get ingestion metrics from all connectors"""
        return [connector.metrics for connector in self.connectors]

    async def shutdown(self):
        """Cleanup resources"""
        if self.kafka_producer:
            await self.kafka_producer.stop()


# Example usage
async def main():
    """Example usage of the ingestion system"""

    # Kafka configuration
    kafka_config = {
        "bootstrap_servers": ["localhost:9092"]
    }

    # Initialize orchestrator
    orchestrator = IngestionOrchestrator(kafka_config)
    await orchestrator.initialize()

    # Add connectors
    google_config = {
        "google_api_key": "your_google_api_key",
        "account_id": "your_account_id"
    }
    orchestrator.add_connector(GoogleReviewsConnector, google_config)

    yelp_config = {
        "yelp_api_key": "your_yelp_api_key"
    }
    orchestrator.add_connector(YelpReviewsConnector, yelp_config)

    wongnai_config = {
        "wongnai_api_key": "your_wongnai_api_key"
    }
    orchestrator.add_connector(WongnaiReviewsConnector, wongnai_config)

    # Run ingestion
    business_ids = ["business_123", "business_456"]
    since = datetime.utcnow() - timedelta(days=1)  # Last 24 hours

    await orchestrator.run_ingestion(business_ids, since)

    # Get metrics
    metrics = await orchestrator.get_metrics()
    for metric in metrics:
        print(f"{metric.source}: {metric.records_processed} processed, {metric.error_rate:.2%} error rate")

    # Cleanup
    await orchestrator.shutdown()


if __name__ == "__main__":
    asyncio.run(main())