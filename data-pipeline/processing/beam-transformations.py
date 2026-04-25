"""
Apache Beam Transformations for Review Data Processing
Unified batch and stream processing pipeline with advanced feature engineering
"""

import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions, StandardOptions
from apache_beam.io import ReadFromKafka, WriteToBigQuery, WriteToText
from apache_beam.transforms import window
from apache_beam.transforms.trigger import AfterWatermark, AfterProcessingTime, AccumulationMode
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Iterable
import re
from textblob import TextBlob
import langdetect
from googletrans import Translator
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from collections import Counter
import hashlib


class ReviewParser(beam.DoFn):
    """Parse raw review messages from Kafka"""

    def process(self, element):
        try:
            # Kafka message format: (key, value, timestamp)
            key, value, timestamp = element

            # Parse JSON value
            review_data = json.loads(value.decode('utf-8'))

            # Add processing timestamp
            review_data['processing_timestamp'] = datetime.utcnow().isoformat()
            review_data['kafka_timestamp'] = timestamp

            yield review_data

        except Exception as e:
            logging.error(f"Failed to parse review: {e}")
            # Yield to dead letter queue
            yield beam.pvalue.TaggedOutput('dead_letter', {
                'raw_message': value.decode('utf-8') if value else '',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            })


class DataQualityFilter(beam.DoFn):
    """Advanced data quality filtering and validation"""

    def __init__(self):
        self.quality_rules = {
            'min_rating': 0.0,
            'max_rating': 5.0,
            'min_text_length': 0,
            'max_text_length': 10000,
            'required_fields': ['platform', 'platform_review_id', 'business_id', 'rating'],
            'valid_platforms': ['google', 'yelp', 'facebook', 'tripadvisor', 'trustpilot', 'wongnai']
        }

    def process(self, review):
        try:
            quality_score = 0
            quality_issues = []

            # Check required fields
            for field in self.quality_rules['required_fields']:
                if field not in review or review[field] is None:
                    quality_issues.append(f"Missing required field: {field}")
                else:
                    quality_score += 20

            # Check rating range
            rating = review.get('rating', 0)
            if self.quality_rules['min_rating'] <= rating <= self.quality_rules['max_rating']:
                quality_score += 20
            else:
                quality_issues.append(f"Invalid rating: {rating}")

            # Check text length
            text_length = len(review.get('review_text', ''))
            if self.quality_rules['min_text_length'] <= text_length <= self.quality_rules['max_text_length']:
                quality_score += 20
            else:
                quality_issues.append(f"Invalid text length: {text_length}")

            # Check platform validity
            platform = review.get('platform', '').lower()
            if platform in self.quality_rules['valid_platforms']:
                quality_score += 20
            else:
                quality_issues.append(f"Invalid platform: {platform}")

            # Check date validity
            try:
                review_date = datetime.fromisoformat(review['review_date'].replace('Z', '+00:00'))
                now = datetime.utcnow().replace(tzinfo=review_date.tzinfo)
                if review_date <= now:
                    quality_score += 20
                else:
                    quality_issues.append("Future review date")
            except:
                quality_issues.append("Invalid review date format")

            # Add quality metadata
            review['data_quality'] = {
                'score': quality_score,
                'issues': quality_issues,
                'passed': quality_score >= 80  # 80% threshold
            }

            if quality_score >= 80:
                yield review
            else:
                yield beam.pvalue.TaggedOutput('low_quality', review)

        except Exception as e:
            logging.error(f"Quality filter error: {e}")
            yield beam.pvalue.TaggedOutput('processing_error', review)


class LanguageDetector(beam.DoFn):
    """Detect and enhance language information"""

    def __init__(self):
        self.translator = None

    def setup(self):
        self.translator = Translator()

    def process(self, review):
        try:
            review_text = review.get('review_text', '')

            if review_text:
                # Detect language
                detected_lang = langdetect.detect(review_text)
                confidence = langdetect.detect_langs(review_text)[0].prob

                # Handle Thai language specifically (for Wongnai)
                if review.get('platform') == 'wongnai':
                    detected_lang = 'th'
                    confidence = 0.99

                # Translate to English if not already English
                english_text = review_text
                if detected_lang != 'en' and confidence > 0.8:
                    try:
                        translation = self.translator.translate(review_text, dest='en')
                        english_text = translation.text
                    except:
                        pass  # Keep original text if translation fails

                review['language_detection'] = {
                    'detected_language': detected_lang,
                    'confidence': confidence,
                    'english_text': english_text,
                    'original_text': review_text
                }

            yield review

        except Exception as e:
            logging.error(f"Language detection error: {e}")
            review['language_detection'] = {
                'detected_language': 'unknown',
                'confidence': 0.0,
                'english_text': review.get('review_text', ''),
                'original_text': review.get('review_text', '')
            }
            yield review


class SentimentAnalyzer(beam.DoFn):
    """Analyze sentiment and emotional features"""

    def process(self, review):
        try:
            text = review.get('language_detection', {}).get('english_text', '') or review.get('review_text', '')

            if text:
                # Basic sentiment analysis with TextBlob
                blob = TextBlob(text)
                sentiment_score = blob.sentiment.polarity  # -1 to 1
                subjectivity = blob.sentiment.subjectivity  # 0 to 1

                # Categorize sentiment
                if sentiment_score > 0.1:
                    sentiment_label = 'positive'
                elif sentiment_score < -0.1:
                    sentiment_label = 'negative'
                else:
                    sentiment_label = 'neutral'

                # Extract keywords/phrases
                words = text.lower().split()
                word_freq = Counter(words)
                top_words = word_freq.most_common(5)

                # Detect review themes
                themes = self._detect_themes(text)

                review['sentiment_analysis'] = {
                    'sentiment_score': sentiment_score,
                    'sentiment_label': sentiment_label,
                    'subjectivity': subjectivity,
                    'top_words': top_words,
                    'themes': themes,
                    'text_length': len(text),
                    'word_count': len(words)
                }

            yield review

        except Exception as e:
            logging.error(f"Sentiment analysis error: {e}")
            review['sentiment_analysis'] = {
                'sentiment_score': 0.0,
                'sentiment_label': 'unknown',
                'subjectivity': 0.0,
                'top_words': [],
                'themes': [],
                'text_length': 0,
                'word_count': 0
            }
            yield review

    def _detect_themes(self, text: str) -> List[str]:
        """Detect common review themes"""
        theme_keywords = {
            'food_quality': ['delicious', 'tasty', 'flavor', 'fresh', 'bland', 'stale', 'spicy'],
            'service': ['friendly', 'rude', 'helpful', 'slow', 'quick', 'staff', 'waiter', 'waitress'],
            'atmosphere': ['cozy', 'noisy', 'clean', 'dirty', 'ambiance', 'music', 'lighting'],
            'value': ['expensive', 'cheap', 'worth', 'overpriced', 'reasonable', 'price', 'cost'],
            'location': ['convenient', 'parking', 'location', 'accessibility', 'crowded'],
            'speed': ['fast', 'slow', 'quick', 'wait', 'timing', 'delay']
        }

        text_lower = text.lower()
        detected_themes = []

        for theme, keywords in theme_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                detected_themes.append(theme)

        return detected_themes


class FeatureEngineer(beam.DoFn):
    """Advanced feature engineering for ML models"""

    def process(self, review):
        try:
            # Extract basic features
            rating = review.get('rating', 0)
            platform = review.get('platform', '')
            sentiment = review.get('sentiment_analysis', {})

            # Date features
            review_date = datetime.fromisoformat(review['review_date'].replace('Z', '+00:00'))
            features = {
                'review_id': review.get('platform_review_id'),
                'business_id': review.get('business_id'),
                'platform': platform,
                'rating': rating,
                'review_date': review_date.isoformat(),

                # Date features
                'day_of_week': review_date.weekday(),
                'month': review_date.month,
                'hour': review_date.hour,
                'is_weekend': review_date.weekday() >= 5,

                # Text features
                'text_length': sentiment.get('text_length', 0),
                'word_count': sentiment.get('word_count', 0),
                'sentiment_score': sentiment.get('sentiment_score', 0),
                'sentiment_label': sentiment.get('sentiment_label', 'unknown'),
                'subjectivity': sentiment.get('subjectivity', 0),

                # Platform-specific features
                'is_verified': review.get('verified_purchase', False),
                'has_photos': len(review.get('photos', [])) > 0,
                'photo_count': len(review.get('photos', [])),
                'helpful_votes': review.get('helpful_votes', 0),

                # Derived features
                'rating_sentiment_alignment': self._calculate_alignment(rating, sentiment.get('sentiment_score', 0)),
                'review_complexity': self._calculate_complexity(sentiment.get('word_count', 0), sentiment.get('subjectivity', 0)),
                'platform_encoding': self._encode_platform(platform),

                # Theme features (one-hot encoding)
                'theme_food_quality': 'food_quality' in sentiment.get('themes', []),
                'theme_service': 'service' in sentiment.get('themes', []),
                'theme_atmosphere': 'atmosphere' in sentiment.get('themes', []),
                'theme_value': 'value' in sentiment.get('themes', []),
                'theme_location': 'location' in sentiment.get('themes', []),
                'theme_speed': 'speed' in sentiment.get('themes', []),

                # Metadata
                'processing_timestamp': datetime.utcnow().isoformat(),
                'feature_version': '1.0'
            }

            # Add language features
            lang_info = review.get('language_detection', {})
            features.update({
                'detected_language': lang_info.get('detected_language', 'unknown'),
                'language_confidence': lang_info.get('confidence', 0),
                'is_translated': lang_info.get('detected_language') != 'en'
            })

            review['features'] = features
            yield review

        except Exception as e:
            logging.error(f"Feature engineering error: {e}")
            yield review

    def _calculate_alignment(self, rating: float, sentiment_score: float) -> float:
        """Calculate alignment between rating and sentiment"""
        # Normalize rating to -1 to 1 scale
        normalized_rating = (rating - 2.5) / 2.5

        # Calculate absolute difference
        alignment = 1 - abs(normalized_rating - sentiment_score)
        return max(0, alignment)

    def _calculate_complexity(self, word_count: int, subjectivity: float) -> float:
        """Calculate review complexity score"""
        # Combine word count and subjectivity
        word_complexity = min(word_count / 100, 1.0)  # Normalize to 0-1
        return (word_complexity + subjectivity) / 2

    def _encode_platform(self, platform: str) -> int:
        """Encode platform as integer"""
        platform_map = {
            'google': 1, 'yelp': 2, 'facebook': 3,
            'tripadvisor': 4, 'trustpilot': 5, 'wongnai': 6
        }
        return platform_map.get(platform.lower(), 0)


class ReviewAggregator(beam.DoFn):
    """Aggregate review metrics by business"""

    def process(self, element):
        business_id, reviews = element
        reviews_list = list(reviews)

        if not reviews_list:
            return

        # Calculate aggregations
        ratings = [r['rating'] for r in reviews_list]
        sentiments = [r.get('sentiment_analysis', {}).get('sentiment_score', 0) for r in reviews_list]

        aggregated = {
            'business_id': business_id,
            'total_reviews': len(reviews_list),
            'avg_rating': np.mean(ratings),
            'std_rating': np.std(ratings),
            'min_rating': min(ratings),
            'max_rating': max(ratings),
            'avg_sentiment': np.mean(sentiments),
            'std_sentiment': np.std(sentiments),

            # Platform distribution
            'platform_distribution': Counter(r['platform'] for r in reviews_list),

            # Language distribution
            'language_distribution': Counter(
                r.get('language_detection', {}).get('detected_language', 'unknown')
                for r in reviews_list
            ),

            # Theme analysis
            'theme_counts': self._aggregate_themes(reviews_list),

            # Time-based metrics
            'review_velocity': self._calculate_velocity(reviews_list),
            'latest_review_date': max(r['review_date'] for r in reviews_list),
            'earliest_review_date': min(r['review_date'] for r in reviews_list),

            # Quality metrics
            'avg_quality_score': np.mean([
                r.get('data_quality', {}).get('score', 0) for r in reviews_list
            ]),

            'aggregation_timestamp': datetime.utcnow().isoformat()
        }

        yield aggregated

    def _aggregate_themes(self, reviews: List[Dict]) -> Dict[str, int]:
        """Aggregate theme counts across reviews"""
        all_themes = []
        for review in reviews:
            themes = review.get('sentiment_analysis', {}).get('themes', [])
            all_themes.extend(themes)
        return dict(Counter(all_themes))

    def _calculate_velocity(self, reviews: List[Dict]) -> float:
        """Calculate reviews per day"""
        if len(reviews) < 2:
            return 0.0

        dates = [datetime.fromisoformat(r['review_date'].replace('Z', '+00:00')) for r in reviews]
        date_range = (max(dates) - min(dates)).days

        return len(reviews) / max(date_range, 1)


class DeduplicationTransform(beam.DoFn):
    """Remove duplicate reviews based on content hash"""

    def __init__(self, window_duration_minutes=60):
        self.window_duration = window_duration_minutes
        self.seen_hashes = set()

    def process(self, review):
        try:
            # Generate content hash
            content = f"{review.get('platform', '')}{review.get('business_id', '')}{review.get('reviewer_id', '')}{review.get('review_text', '')}"
            content_hash = hashlib.sha256(content.encode()).hexdigest()

            if content_hash not in self.seen_hashes:
                self.seen_hashes.add(content_hash)
                review['content_hash'] = content_hash
                review['is_duplicate'] = False
                yield review
            else:
                review['content_hash'] = content_hash
                review['is_duplicate'] = True
                yield beam.pvalue.TaggedOutput('duplicates', review)

        except Exception as e:
            logging.error(f"Deduplication error: {e}")
            yield review


def create_pipeline_options(job_name: str, runner: str = 'DirectRunner') -> PipelineOptions:
    """Create pipeline options for different runners"""
    options = PipelineOptions()

    if runner == 'DataflowRunner':
        # Google Cloud Dataflow options
        options.view_as(StandardOptions).runner = 'DataflowRunner'
        options.view_as(beam.options.pipeline_options.GoogleCloudOptions).project = 'your-project-id'
        options.view_as(beam.options.pipeline_options.GoogleCloudOptions).region = 'us-central1'
        options.view_as(beam.options.pipeline_options.GoogleCloudOptions).temp_location = 'gs://your-bucket/temp'
        options.view_as(beam.options.pipeline_options.GoogleCloudOptions).staging_location = 'gs://your-bucket/staging'
        options.view_as(beam.options.pipeline_options.WorkerOptions).machine_type = 'n1-standard-2'
        options.view_as(beam.options.pipeline_options.WorkerOptions).max_num_workers = 10

    elif runner == 'FlinkRunner':
        # Apache Flink options
        options.view_as(StandardOptions).runner = 'FlinkRunner'
        options.view_as(beam.options.pipeline_options.FlinkRunnerOptions).flink_master = 'localhost:8081'

    else:
        # Direct runner for local testing
        options.view_as(StandardOptions).runner = 'DirectRunner'

    options.view_as(beam.options.pipeline_options.SetupOptions).save_main_session = True
    options.view_as(StandardOptions).streaming = True

    return options


def run_streaming_pipeline():
    """Run the streaming data processing pipeline"""

    options = create_pipeline_options('review-processing-stream', 'DirectRunner')

    with beam.Pipeline(options=options) as pipeline:

        # Read from Kafka
        raw_reviews = (
            pipeline
            | 'ReadFromKafka' >> ReadFromKafka(
                consumer_config={
                    'bootstrap.servers': 'localhost:9092',
                    'auto.offset.reset': 'latest',
                    'group.id': 'review-processing'
                },
                topics=['raw-reviews'],
                with_metadata=True
            )
        )

        # Parse and validate
        parsed_reviews = (
            raw_reviews
            | 'ParseReviews' >> beam.ParDo(ReviewParser()).with_outputs('dead_letter', main='main')
        )

        # Data quality filtering
        quality_filtered = (
            parsed_reviews.main
            | 'QualityFilter' >> beam.ParDo(DataQualityFilter()).with_outputs('low_quality', 'processing_error', main='main')
        )

        # Deduplication
        deduplicated = (
            quality_filtered.main
            | 'Deduplication' >> beam.ParDo(DeduplicationTransform()).with_outputs('duplicates', main='main')
        )

        # Feature engineering pipeline
        enriched_reviews = (
            deduplicated.main
            | 'LanguageDetection' >> beam.ParDo(LanguageDetector())
            | 'SentimentAnalysis' >> beam.ParDo(SentimentAnalyzer())
            | 'FeatureEngineering' >> beam.ParDo(FeatureEngineer())
        )

        # Windowing for aggregations
        windowed_reviews = (
            enriched_reviews
            | 'WindowInto' >> beam.WindowInto(
                window.FixedWindows(5 * 60),  # 5-minute windows
                trigger=AfterWatermark(early=AfterProcessingTime(60)),  # Early trigger every minute
                accumulation_mode=AccumulationMode.DISCARDING
            )
        )

        # Business-level aggregations
        business_aggregations = (
            windowed_reviews
            | 'KeyByBusiness' >> beam.Map(lambda x: (x['business_id'], x))
            | 'GroupByBusiness' >> beam.GroupByKey()
            | 'AggregateByBusiness' >> beam.ParDo(ReviewAggregator())
        )

        # Write to different sinks
        (
            enriched_reviews
            | 'WriteToProcessed' >> beam.io.WriteToBigQuery(
                'your-project:dataset.processed_reviews',
                schema={
                    'fields': [
                        {'name': 'review_id', 'type': 'STRING'},
                        {'name': 'business_id', 'type': 'STRING'},
                        {'name': 'platform', 'type': 'STRING'},
                        {'name': 'rating', 'type': 'FLOAT'},
                        {'name': 'sentiment_score', 'type': 'FLOAT'},
                        {'name': 'features', 'type': 'JSON'},
                    ]
                },
                write_disposition=beam.io.BigQueryDisposition.WRITE_APPEND,
                create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED
            )
        )

        (
            business_aggregations
            | 'WriteToAggregations' >> beam.io.WriteToBigQuery(
                'your-project:dataset.business_aggregations',
                write_disposition=beam.io.BigQueryDisposition.WRITE_APPEND,
                create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED
            )
        )

        # Write low quality reviews for analysis
        (
            quality_filtered.low_quality
            | 'WriteLowQuality' >> WriteToText(
                'gs://your-bucket/low-quality-reviews',
                file_name_suffix='.json'
            )
        )


def run_batch_pipeline(input_path: str, output_path: str):
    """Run batch processing pipeline"""

    options = create_pipeline_options('review-processing-batch', 'DataflowRunner')

    with beam.Pipeline(options=options) as pipeline:

        # Read from files
        raw_reviews = (
            pipeline
            | 'ReadFiles' >> beam.io.ReadFromText(input_path)
            | 'ParseJSON' >> beam.Map(json.loads)
        )

        # Same processing pipeline as streaming
        processed_reviews = (
            raw_reviews
            | 'QualityFilter' >> beam.ParDo(DataQualityFilter()).main
            | 'LanguageDetection' >> beam.ParDo(LanguageDetector())
            | 'SentimentAnalysis' >> beam.ParDo(SentimentAnalyzer())
            | 'FeatureEngineering' >> beam.ParDo(FeatureEngineer())
        )

        # Write results
        (
            processed_reviews
            | 'WriteResults' >> WriteToText(output_path, file_name_suffix='.json')
        )


if __name__ == '__main__':
    logging.getLogger().setLevel(logging.INFO)

    # Run streaming pipeline
    run_streaming_pipeline()