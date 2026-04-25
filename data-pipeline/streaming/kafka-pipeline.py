"""
Kafka Streaming Pipeline for Real-time Review Processing
High-throughput, exactly-once semantics with advanced windowing and late data handling
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable, AsyncIterator
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
from collections import defaultdict, deque
import time

# Kafka imports
import aiokafka
from kafka import KafkaProducer, KafkaConsumer
from kafka.admin import KafkaAdminClient, NewTopic, ConfigResource, ConfigResourceType
from kafka.structs import TopicPartition

# Stream processing
import asyncio
from aiokafka.helpers import create_ssl_context
import avro.schema
import avro.io
import io

# Monitoring and metrics
import prometheus_client
from prometheus_client import Counter, Histogram, Gauge, Summary


class MessageType(Enum):
    """Types of messages in the pipeline"""
    RAW_REVIEW = "raw_review"
    PROCESSED_REVIEW = "processed_review"
    AGGREGATION = "aggregation"
    DEAD_LETTER = "dead_letter"
    CONTROL = "control"


class ProcessingState(Enum):
    """States for message processing"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


@dataclass
class StreamMessage:
    """Standard message format across all topics"""
    message_id: str
    message_type: MessageType
    timestamp: datetime
    data: Dict[str, Any]
    headers: Dict[str, str]
    partition_key: Optional[str] = None
    processing_state: ProcessingState = ProcessingState.PENDING
    retry_count: int = 0
    error_message: Optional[str] = None

    def to_kafka_message(self) -> Dict[str, bytes]:
        """Convert to Kafka message format"""
        return {
            'key': self.partition_key.encode('utf-8') if self.partition_key else None,
            'value': json.dumps(asdict(self), default=str).encode('utf-8'),
            'headers': [(k, v.encode('utf-8')) for k, v in self.headers.items()]
        }

    @classmethod
    def from_kafka_message(cls, message) -> 'StreamMessage':
        """Create from Kafka message"""
        data = json.loads(message.value.decode('utf-8'))

        # Parse datetime fields
        data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        data['message_type'] = MessageType(data['message_type'])
        data['processing_state'] = ProcessingState(data['processing_state'])

        return cls(**data)


class MetricsCollector:
    """Prometheus metrics for stream processing"""

    def __init__(self):
        self.messages_processed = Counter(
            'stream_messages_processed_total',
            'Total processed messages',
            ['topic', 'partition', 'message_type', 'status']
        )

        self.processing_duration = Histogram(
            'stream_processing_duration_seconds',
            'Message processing duration',
            ['topic', 'message_type']
        )

        self.lag = Gauge(
            'stream_consumer_lag',
            'Consumer lag by topic and partition',
            ['topic', 'partition']
        )

        self.throughput = Gauge(
            'stream_throughput_messages_per_second',
            'Message throughput',
            ['topic', 'consumer_group']
        )

        self.error_rate = Counter(
            'stream_processing_errors_total',
            'Total processing errors',
            ['topic', 'error_type', 'message_type']
        )

        self.watermark_delay = Gauge(
            'stream_watermark_delay_seconds',
            'Event time watermark delay',
            ['topic']
        )


class ExactlyOnceProcessor:
    """Implements exactly-once processing semantics"""

    def __init__(self, state_store_path: str = "/tmp/kafka_state"):
        self.processed_offsets = {}
        self.state_store_path = state_store_path
        self.transaction_timeout = 60  # seconds

    async def is_already_processed(self, topic: str, partition: int, offset: int) -> bool:
        """Check if message was already processed"""
        key = f"{topic}:{partition}"
        return key in self.processed_offsets and self.processed_offsets[key] >= offset

    async def mark_processed(self, topic: str, partition: int, offset: int):
        """Mark message as processed"""
        key = f"{topic}:{partition}"
        self.processed_offsets[key] = offset

    async def checkpoint_state(self):
        """Checkpoint processing state to persistent storage"""
        try:
            with open(f"{self.state_store_path}/offsets.json", 'w') as f:
                json.dump(self.processed_offsets, f)
        except Exception as e:
            logging.error(f"Failed to checkpoint state: {e}")

    async def restore_state(self):
        """Restore processing state from persistent storage"""
        try:
            with open(f"{self.state_store_path}/offsets.json", 'r') as f:
                self.processed_offsets = json.load(f)
        except FileNotFoundError:
            logging.info("No previous state found, starting fresh")
        except Exception as e:
            logging.error(f"Failed to restore state: {e}")


class WindowManager:
    """Manages windowing for stream aggregations"""

    def __init__(self, window_size: timedelta, slide_interval: timedelta):
        self.window_size = window_size
        self.slide_interval = slide_interval
        self.windows = defaultdict(lambda: defaultdict(list))  # window_start -> key -> messages
        self.watermark = datetime.utcnow() - timedelta(hours=1)  # Start 1 hour behind

    def add_message(self, message: StreamMessage, group_key: str):
        """Add message to appropriate windows"""
        message_time = message.timestamp

        # Calculate which windows this message belongs to
        windows = self._calculate_windows(message_time)

        for window_start in windows:
            self.windows[window_start][group_key].append(message)

    def _calculate_windows(self, timestamp: datetime) -> List[datetime]:
        """Calculate all windows that should contain this timestamp"""
        windows = []

        # Find the first window start that includes this timestamp
        window_start = self._align_to_window(timestamp - self.window_size + timedelta(microseconds=1))

        # Add all overlapping windows (for sliding windows)
        current_start = window_start
        while current_start <= timestamp:
            windows.append(current_start)
            current_start += self.slide_interval

        return windows

    def _align_to_window(self, timestamp: datetime) -> datetime:
        """Align timestamp to window boundary"""
        # Align to slide interval boundary
        epoch = datetime(1970, 1, 1)
        duration_since_epoch = timestamp - epoch
        slide_seconds = self.slide_interval.total_seconds()

        aligned_seconds = (duration_since_epoch.total_seconds() // slide_seconds) * slide_seconds
        return epoch + timedelta(seconds=aligned_seconds)

    def advance_watermark(self, new_watermark: datetime):
        """Advance watermark and trigger window completions"""
        if new_watermark <= self.watermark:
            return []

        old_watermark = self.watermark
        self.watermark = new_watermark

        # Find completed windows
        completed_windows = []
        for window_start in list(self.windows.keys()):
            window_end = window_start + self.window_size

            if window_end <= new_watermark:
                # Window is complete
                window_data = self.windows.pop(window_start)
                completed_windows.append((window_start, window_end, window_data))

        return completed_windows

    def handle_late_data(self, message: StreamMessage, group_key: str, max_lateness: timedelta):
        """Handle late arriving data"""
        message_time = message.timestamp

        # Check if message is too late
        if message_time < self.watermark - max_lateness:
            logging.warning(f"Dropping late message: {message_time} vs {self.watermark}")
            return False

        # Check if any relevant windows are still open
        windows = self._calculate_windows(message_time)
        added_to_window = False

        for window_start in windows:
            window_end = window_start + self.window_size

            # If window hasn't been completed yet, add the message
            if window_start in self.windows:
                self.windows[window_start][group_key].append(message)
                added_to_window = True

        return added_to_window


class StreamProcessor:
    """High-level stream processing framework"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.metrics = MetricsCollector()
        self.exactly_once = ExactlyOnceProcessor()
        self.window_manager = WindowManager(
            window_size=timedelta(minutes=config.get('window_size_minutes', 5)),
            slide_interval=timedelta(minutes=config.get('slide_interval_minutes', 1))
        )
        self.consumers = {}
        self.producers = {}
        self.processors = {}
        self.logger = logging.getLogger(self.__class__.__name__)

    async def initialize(self):
        """Initialize Kafka clients and state"""
        await self.exactly_once.restore_state()
        await self._initialize_kafka_clients()
        await self._create_topics()

    async def _initialize_kafka_clients(self):
        """Initialize Kafka producers and consumers"""
        kafka_config = {
            'bootstrap_servers': self.config['kafka']['bootstrap_servers'],
            'security_protocol': 'SASL_SSL',
            'sasl_mechanism': 'PLAIN',
            'sasl_plain_username': self.config['kafka']['username'],
            'sasl_plain_password': self.config['kafka']['password'],
        }

        # Producer for exactly-once processing
        self.producer = aiokafka.AIOKafkaProducer(
            **kafka_config,
            value_serializer=None,  # We handle serialization
            key_serializer=None,
            enable_idempotence=True,
            transactional_id=f"stream_processor_{self.config['instance_id']}",
            compression_type='gzip',
            batch_size=16384,
            linger_ms=5
        )
        await self.producer.start()

    async def _create_topics(self):
        """Create required Kafka topics"""
        admin_client = KafkaAdminClient(
            bootstrap_servers=self.config['kafka']['bootstrap_servers'],
            client_id='stream_processor_admin'
        )

        topics = [
            NewTopic(
                name='raw-reviews',
                num_partitions=12,
                replication_factor=3,
                topic_configs={
                    'retention.ms': str(7 * 24 * 60 * 60 * 1000),  # 7 days
                    'compression.type': 'gzip',
                    'cleanup.policy': 'delete'
                }
            ),
            NewTopic(
                name='processed-reviews',
                num_partitions=12,
                replication_factor=3,
                topic_configs={
                    'retention.ms': str(30 * 24 * 60 * 60 * 1000),  # 30 days
                    'compression.type': 'gzip'
                }
            ),
            NewTopic(
                name='review-aggregations',
                num_partitions=6,
                replication_factor=3,
                topic_configs={
                    'retention.ms': str(90 * 24 * 60 * 60 * 1000),  # 90 days
                    'cleanup.policy': 'compact'
                }
            ),
            NewTopic(
                name='dead-letter-queue',
                num_partitions=3,
                replication_factor=3,
                topic_configs={
                    'retention.ms': str(7 * 24 * 60 * 60 * 1000),
                    'cleanup.policy': 'delete'
                }
            )
        ]

        try:
            admin_client.create_topics(topics)
            self.logger.info("Topics created successfully")
        except Exception as e:
            if "TopicExistsException" not in str(e):
                self.logger.error(f"Failed to create topics: {e}")

    def register_processor(self, source_topic: str, processor_func: Callable):
        """Register a message processor for a topic"""
        self.processors[source_topic] = processor_func

    async def start_consumer(self, topic: str, group_id: str):
        """Start consumer for a topic"""
        kafka_config = {
            'bootstrap_servers': self.config['kafka']['bootstrap_servers'],
            'group_id': group_id,
            'auto_offset_reset': 'latest',
            'enable_auto_commit': False,  # Manual commit for exactly-once
            'isolation_level': 'read_committed',
            'max_poll_records': 500,
            'session_timeout_ms': 30000,
            'heartbeat_interval_ms': 3000
        }

        consumer = aiokafka.AIOKafkaConsumer(
            topic,
            **kafka_config
        )
        await consumer.start()

        self.consumers[topic] = consumer

        # Start processing task
        asyncio.create_task(self._process_messages(topic, consumer))

    async def _process_messages(self, topic: str, consumer: aiokafka.AIOKafkaConsumer):
        """Process messages from a topic"""
        self.logger.info(f"Started processing messages from {topic}")

        try:
            async for message in consumer:
                try:
                    # Check exactly-once semantics
                    if await self.exactly_once.is_already_processed(
                        topic, message.partition, message.offset
                    ):
                        continue

                    # Parse message
                    stream_message = StreamMessage.from_kafka_message(message)

                    # Update watermark
                    self._update_watermark(stream_message.timestamp, topic)

                    # Process message
                    start_time = time.time()

                    if topic in self.processors:
                        await self._execute_processor(topic, stream_message)

                    processing_time = time.time() - start_time

                    # Record metrics
                    self.metrics.messages_processed.labels(
                        topic=topic,
                        partition=message.partition,
                        message_type=stream_message.message_type.value,
                        status='success'
                    ).inc()

                    self.metrics.processing_duration.labels(
                        topic=topic,
                        message_type=stream_message.message_type.value
                    ).observe(processing_time)

                    # Mark as processed
                    await self.exactly_once.mark_processed(
                        topic, message.partition, message.offset
                    )

                    # Commit offset
                    await consumer.commit()

                except Exception as e:
                    self.logger.error(f"Failed to process message from {topic}: {e}")

                    self.metrics.error_rate.labels(
                        topic=topic,
                        error_type=type(e).__name__,
                        message_type=stream_message.message_type.value if 'stream_message' in locals() else 'unknown'
                    ).inc()

                    # Send to dead letter queue
                    await self._send_to_dlq(message, str(e))

        except Exception as e:
            self.logger.error(f"Consumer error for topic {topic}: {e}")
        finally:
            await consumer.stop()

    async def _execute_processor(self, topic: str, message: StreamMessage):
        """Execute registered processor for a message"""
        processor_func = self.processors[topic]

        # Add to window if it's a windowed operation
        if hasattr(processor_func, '_windowed'):
            group_key = processor_func._group_key_func(message)
            self.window_manager.add_message(message, group_key)
        else:
            # Direct processing
            result = await processor_func(message)
            if result:
                await self._publish_result(result)

    def _update_watermark(self, event_time: datetime, topic: str):
        """Update watermark based on event time"""
        new_watermark = event_time - timedelta(minutes=1)  # 1 minute buffer

        # Advance window manager watermark
        completed_windows = self.window_manager.advance_watermark(new_watermark)

        # Process completed windows
        for window_start, window_end, window_data in completed_windows:
            asyncio.create_task(self._process_completed_window(window_start, window_end, window_data))

        # Update metrics
        delay = (datetime.utcnow() - new_watermark).total_seconds()
        self.metrics.watermark_delay.labels(topic=topic).set(delay)

    async def _process_completed_window(self, start: datetime, end: datetime, data: Dict[str, List[StreamMessage]]):
        """Process completed window aggregations"""
        self.logger.info(f"Processing window {start} - {end} with {len(data)} groups")

        for group_key, messages in data.items():
            # Example aggregation: count reviews by platform
            aggregation = self._aggregate_reviews(group_key, messages, start, end)
            await self._publish_result(aggregation)

    def _aggregate_reviews(self, group_key: str, messages: List[StreamMessage], start: datetime, end: datetime) -> StreamMessage:
        """Aggregate reviews for a window"""
        platform_counts = defaultdict(int)
        total_rating = 0
        total_reviews = len(messages)
        sentiment_scores = []

        for msg in messages:
            data = msg.data
            platform = data.get('platform', 'unknown')
            platform_counts[platform] += 1
            total_rating += data.get('rating', 0)

            sentiment = data.get('sentiment_analysis', {})
            if sentiment.get('sentiment_score') is not None:
                sentiment_scores.append(sentiment['sentiment_score'])

        aggregation_data = {
            'business_id': group_key,
            'window_start': start.isoformat(),
            'window_end': end.isoformat(),
            'total_reviews': total_reviews,
            'avg_rating': total_rating / total_reviews if total_reviews > 0 else 0,
            'platform_counts': dict(platform_counts),
            'avg_sentiment': sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0,
            'review_velocity': total_reviews / ((end - start).total_seconds() / 3600)  # reviews per hour
        }

        return StreamMessage(
            message_id=f"agg_{group_key}_{int(start.timestamp())}",
            message_type=MessageType.AGGREGATION,
            timestamp=datetime.utcnow(),
            data=aggregation_data,
            headers={'aggregation_type': 'business_window'},
            partition_key=group_key
        )

    async def _publish_result(self, result: StreamMessage):
        """Publish processing result to appropriate topic"""
        target_topic = self._determine_target_topic(result.message_type)
        kafka_msg = result.to_kafka_message()

        await self.producer.send(
            target_topic,
            key=kafka_msg['key'],
            value=kafka_msg['value'],
            headers=kafka_msg['headers']
        )

    def _determine_target_topic(self, message_type: MessageType) -> str:
        """Determine target topic based on message type"""
        topic_mapping = {
            MessageType.PROCESSED_REVIEW: 'processed-reviews',
            MessageType.AGGREGATION: 'review-aggregations',
            MessageType.DEAD_LETTER: 'dead-letter-queue'
        }
        return topic_mapping.get(message_type, 'dead-letter-queue')

    async def _send_to_dlq(self, original_message, error: str):
        """Send failed message to dead letter queue"""
        dlq_message = StreamMessage(
            message_id=f"dlq_{int(time.time() * 1000)}",
            message_type=MessageType.DEAD_LETTER,
            timestamp=datetime.utcnow(),
            data={
                'original_topic': original_message.topic,
                'original_partition': original_message.partition,
                'original_offset': original_message.offset,
                'original_value': original_message.value.decode('utf-8'),
                'error': error
            },
            headers={'error_type': type(Exception).__name__, 'original_topic': original_message.topic}
        )

        await self._publish_result(dlq_message)

    async def shutdown(self):
        """Graceful shutdown"""
        self.logger.info("Shutting down stream processor")

        # Stop all consumers
        for consumer in self.consumers.values():
            await consumer.stop()

        # Stop producer
        await self.producer.stop()

        # Checkpoint state
        await self.exactly_once.checkpoint_state()


# Decorators for stream processing functions
def windowed(window_size_minutes: int, slide_interval_minutes: int, group_by: Callable):
    """Decorator to mark a function as windowed processing"""
    def decorator(func):
        func._windowed = True
        func._window_size = timedelta(minutes=window_size_minutes)
        func._slide_interval = timedelta(minutes=slide_interval_minutes)
        func._group_key_func = group_by
        return func
    return decorator


def group_key_business_id(message: StreamMessage) -> str:
    """Extract business_id as group key"""
    return message.data.get('business_id', 'unknown')


# Example processor functions
async def process_raw_review(message: StreamMessage) -> Optional[StreamMessage]:
    """Process raw review message"""
    try:
        # Simulate processing (sentiment analysis, feature extraction, etc.)
        data = message.data.copy()

        # Add processing metadata
        data['processing_timestamp'] = datetime.utcnow().isoformat()
        data['processor_version'] = '1.0'

        # Create processed message
        return StreamMessage(
            message_id=f"proc_{message.message_id}",
            message_type=MessageType.PROCESSED_REVIEW,
            timestamp=message.timestamp,
            data=data,
            headers=message.headers.copy(),
            partition_key=data.get('business_id')
        )

    except Exception as e:
        logging.error(f"Failed to process review: {e}")
        return None


@windowed(window_size_minutes=5, slide_interval_minutes=1, group_by=group_key_business_id)
async def aggregate_business_metrics(messages: List[StreamMessage]) -> StreamMessage:
    """Aggregate metrics for a business within a window"""
    # This function signature is for windowed operations
    # Actual processing happens in _process_completed_window
    pass


async def main():
    """Main execution function"""
    config = {
        'instance_id': 'stream_processor_001',
        'kafka': {
            'bootstrap_servers': ['localhost:9092'],
            'username': 'your_username',
            'password': 'your_password'
        },
        'window_size_minutes': 5,
        'slide_interval_minutes': 1
    }

    # Initialize stream processor
    processor = StreamProcessor(config)
    await processor.initialize()

    # Register processors
    processor.register_processor('raw-reviews', process_raw_review)
    processor.register_processor('processed-reviews', aggregate_business_metrics)

    # Start consumers
    await processor.start_consumer('raw-reviews', 'review_processor_group')
    await processor.start_consumer('processed-reviews', 'aggregation_processor_group')

    try:
        # Keep running
        while True:
            await asyncio.sleep(1)

    except KeyboardInterrupt:
        logging.info("Received shutdown signal")
    finally:
        await processor.shutdown()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())