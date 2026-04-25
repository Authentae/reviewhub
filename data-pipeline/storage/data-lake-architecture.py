"""
Data Lake Architecture for ReviewHub
Optimized storage strategy with partitioning, compression, and lifecycle management
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, asdict
from pathlib import Path
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.dataset as ds
from enum import Enum
import boto3
from google.cloud import storage as gcs
from azure.storage.blob import BlobServiceClient
import hashlib


class StorageTier(Enum):
    """Data storage tiers for lifecycle management"""
    HOT = "hot"           # Frequently accessed data
    WARM = "warm"         # Occasionally accessed data
    COLD = "cold"         # Rarely accessed data
    ARCHIVE = "archive"   # Long-term retention


class CompressionType(Enum):
    """Supported compression algorithms"""
    SNAPPY = "snappy"     # Fast compression, good for streaming
    GZIP = "gzip"         # Balanced compression ratio
    LZ4 = "lz4"          # Very fast compression
    ZSTD = "zstd"        # Excellent compression ratio
    BROTLI = "brotli"    # High compression ratio


@dataclass
class PartitionConfig:
    """Configuration for data partitioning"""
    partition_keys: List[str]
    partition_granularity: str  # 'day', 'hour', 'month'
    max_partitions_per_write: int
    partition_size_mb: int


@dataclass
class StorageConfig:
    """Storage configuration for different environments"""
    provider: str  # 'aws', 'gcp', 'azure'
    bucket_name: str
    region: str
    compression: CompressionType
    partition_config: PartitionConfig
    encryption_enabled: bool
    lifecycle_rules: Dict[StorageTier, int]  # Days before tier transition


class DataLakeManager:
    """Centralized data lake management with multi-cloud support"""

    def __init__(self, config: StorageConfig):
        self.config = config
        self.logger = logging.getLogger(self.__class__.__name__)
        self.client = self._initialize_client()

    def _initialize_client(self):
        """Initialize cloud storage client based on provider"""
        if self.config.provider == 'aws':
            return boto3.client('s3', region_name=self.config.region)
        elif self.config.provider == 'gcp':
            return gcs.Client()
        elif self.config.provider == 'azure':
            return BlobServiceClient.from_connection_string("your_connection_string")
        else:
            raise ValueError(f"Unsupported storage provider: {self.config.provider}")

    def write_reviews_dataset(
        self,
        reviews: List[Dict[str, Any]],
        layer: str = "raw",
        format: str = "parquet"
    ) -> str:
        """Write reviews to data lake with optimal partitioning"""

        if not reviews:
            self.logger.warning("No reviews to write")
            return ""

        # Convert to DataFrame for processing
        df = pd.DataFrame(reviews)

        # Add partition columns
        df = self._add_partition_columns(df)

        # Optimize schema
        schema = self._create_optimized_schema(df, layer)

        # Convert to Arrow Table
        table = pa.Table.from_pandas(df, schema=schema)

        # Determine output path
        base_path = self._get_base_path(layer)

        # Write partitioned dataset
        return self._write_partitioned_dataset(table, base_path, format)

    def _add_partition_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add partitioning columns based on review dates"""

        # Ensure review_date is datetime
        if 'review_date' in df.columns:
            df['review_date'] = pd.to_datetime(df['review_date'])

            # Add partition columns
            if self.config.partition_config.partition_granularity == 'day':
                df['year'] = df['review_date'].dt.year
                df['month'] = df['review_date'].dt.month.astype(str).str.zfill(2)
                df['day'] = df['review_date'].dt.day.astype(str).str.zfill(2)
            elif self.config.partition_config.partition_granularity == 'hour':
                df['year'] = df['review_date'].dt.year
                df['month'] = df['review_date'].dt.month.astype(str).str.zfill(2)
                df['day'] = df['review_date'].dt.day.astype(str).str.zfill(2)
                df['hour'] = df['review_date'].dt.hour.astype(str).str.zfill(2)
            elif self.config.partition_config.partition_granularity == 'month':
                df['year'] = df['review_date'].dt.year
                df['month'] = df['review_date'].dt.month.astype(str).str.zfill(2)

        return df

    def _create_optimized_schema(self, df: pd.DataFrame, layer: str) -> pa.Schema:
        """Create optimized Parquet schema"""

        if layer == "raw":
            return self._create_raw_schema()
        elif layer == "processed":
            return self._create_processed_schema()
        elif layer == "features":
            return self._create_features_schema()
        else:
            # Infer schema from DataFrame
            return pa.Table.from_pandas(df).schema

    def _create_raw_schema(self) -> pa.Schema:
        """Schema for raw review data"""
        return pa.schema([
            pa.field('platform', pa.string()),
            pa.field('platform_review_id', pa.string()),
            pa.field('business_id', pa.string()),
            pa.field('reviewer_id', pa.string()),
            pa.field('reviewer_name', pa.string()),
            pa.field('rating', pa.float32()),
            pa.field('review_text', pa.large_string()),
            pa.field('review_date', pa.timestamp('us')),
            pa.field('response_text', pa.large_string()),
            pa.field('response_date', pa.timestamp('us')),
            pa.field('language', pa.string()),
            pa.field('verified_purchase', pa.bool_()),
            pa.field('helpful_votes', pa.int32()),
            pa.field('total_votes', pa.int32()),
            pa.field('photos', pa.list_(pa.string())),
            pa.field('metadata', pa.string()),  # JSON string
            pa.field('ingestion_timestamp', pa.timestamp('us')),
            pa.field('source_url', pa.string()),
            # Partition columns
            pa.field('year', pa.int32()),
            pa.field('month', pa.string()),
            pa.field('day', pa.string()),
        ])

    def _create_processed_schema(self) -> pa.Schema:
        """Schema for processed review data with enrichments"""
        return pa.schema([
            # Core fields
            pa.field('review_id', pa.string()),
            pa.field('platform', pa.string()),
            pa.field('business_id', pa.string()),
            pa.field('rating', pa.float32()),
            pa.field('review_date', pa.timestamp('us')),

            # Language processing
            pa.field('detected_language', pa.string()),
            pa.field('language_confidence', pa.float32()),
            pa.field('english_text', pa.large_string()),

            # Sentiment analysis
            pa.field('sentiment_score', pa.float32()),
            pa.field('sentiment_label', pa.string()),
            pa.field('subjectivity', pa.float32()),

            # Text features
            pa.field('text_length', pa.int32()),
            pa.field('word_count', pa.int32()),
            pa.field('themes', pa.list_(pa.string())),

            # Quality metrics
            pa.field('quality_score', pa.float32()),
            pa.field('quality_passed', pa.bool_()),

            # Processing metadata
            pa.field('processing_timestamp', pa.timestamp('us')),
            pa.field('content_hash', pa.string()),
            pa.field('is_duplicate', pa.bool_()),

            # Partition columns
            pa.field('year', pa.int32()),
            pa.field('month', pa.string()),
            pa.field('day', pa.string()),
        ])

    def _create_features_schema(self) -> pa.Schema:
        """Schema for ML feature store"""
        return pa.schema([
            pa.field('feature_id', pa.string()),
            pa.field('business_id', pa.string()),
            pa.field('platform', pa.string()),

            # Numerical features
            pa.field('rating', pa.float32()),
            pa.field('sentiment_score', pa.float32()),
            pa.field('subjectivity', pa.float32()),
            pa.field('text_length', pa.int32()),
            pa.field('word_count', pa.int32()),

            # Categorical features (encoded)
            pa.field('platform_encoded', pa.int8()),
            pa.field('day_of_week', pa.int8()),
            pa.field('month', pa.int8()),
            pa.field('hour', pa.int8()),

            # Boolean features
            pa.field('is_weekend', pa.bool_()),
            pa.field('has_photos', pa.bool_()),
            pa.field('is_verified', pa.bool_()),
            pa.field('is_translated', pa.bool_()),

            # Theme features (one-hot encoded)
            pa.field('theme_food_quality', pa.bool_()),
            pa.field('theme_service', pa.bool_()),
            pa.field('theme_atmosphere', pa.bool_()),
            pa.field('theme_value', pa.bool_()),
            pa.field('theme_location', pa.bool_()),
            pa.field('theme_speed', pa.bool_()),

            # Target variables
            pa.field('sentiment_label', pa.string()),

            # Metadata
            pa.field('feature_timestamp', pa.timestamp('us')),
            pa.field('feature_version', pa.string()),

            # Partition columns
            pa.field('year', pa.int32()),
            pa.field('month', pa.string()),
        ])

    def _get_base_path(self, layer: str) -> str:
        """Get base path for data layer"""
        return f"{self.config.bucket_name}/data-lake/{layer}/reviews/"

    def _write_partitioned_dataset(
        self,
        table: pa.Table,
        base_path: str,
        format: str
    ) -> str:
        """Write partitioned dataset to storage"""

        try:
            # Configure partitioning
            partition_cols = self.config.partition_config.partition_keys

            if format == "parquet":
                # Parquet-specific optimizations
                write_options = pq.ParquetWriter.compression_level
                compression = self.config.compression.value

                # Write partitioned dataset
                ds.write_dataset(
                    table,
                    base_path,
                    format='parquet',
                    partitioning=partition_cols,
                    compression=compression,
                    existing_data_behavior='overwrite_or_ignore',
                    file_options=ds.ParquetFileFormat().make_write_options(
                        compression=compression,
                        use_dictionary=True,
                        row_group_size=50000,
                        data_page_size=1024*1024,  # 1MB pages
                        write_batch_size=1024
                    )
                )

            elif format == "delta":
                # Delta Lake format
                from deltalake import write_deltalake
                df = table.to_pandas()

                write_deltalake(
                    base_path,
                    df,
                    partition_by=partition_cols,
                    mode="append",
                    compression=self.config.compression.value
                )

            self.logger.info(f"Successfully wrote {len(table)} records to {base_path}")
            return base_path

        except Exception as e:
            self.logger.error(f"Failed to write dataset: {e}")
            raise

    def read_reviews_dataset(
        self,
        layer: str,
        filters: Optional[List] = None,
        columns: Optional[List[str]] = None,
        date_range: Optional[Tuple[datetime, datetime]] = None
    ) -> pa.Table:
        """Read reviews dataset with predicate pushdown"""

        base_path = self._get_base_path(layer)

        try:
            # Build filters
            dataset_filters = []

            # Date range filter
            if date_range:
                start_date, end_date = date_range
                dataset_filters.extend([
                    ('year', '>=', start_date.year),
                    ('year', '<=', end_date.year)
                ])

            # Additional filters
            if filters:
                dataset_filters.extend(filters)

            # Create dataset
            dataset = ds.dataset(base_path, format='parquet')

            # Scan with optimizations
            table = dataset.to_table(
                filter=ds.field('year').isin([f[2] for f in dataset_filters if f[0] == 'year'])
                if any(f[0] == 'year' for f in dataset_filters) else None,
                columns=columns
            )

            self.logger.info(f"Read {len(table)} records from {layer} layer")
            return table

        except Exception as e:
            self.logger.error(f"Failed to read dataset: {e}")
            raise

    def optimize_dataset(self, layer: str):
        """Optimize dataset by compaction and rebalancing"""

        base_path = self._get_base_path(layer)

        try:
            # Read existing dataset
            dataset = ds.dataset(base_path)
            table = dataset.to_table()

            if len(table) == 0:
                self.logger.warning("No data to optimize")
                return

            # Repartition based on optimal file sizes
            optimal_size_mb = self.config.partition_config.partition_size_mb
            current_size_mb = table.nbytes / (1024 * 1024)

            if current_size_mb > optimal_size_mb * 2:
                # Dataset is too large, increase partitioning
                self.logger.info(f"Repartitioning large dataset: {current_size_mb:.1f}MB")

                # Group by partition keys and write smaller chunks
                df = table.to_pandas()
                partition_cols = self.config.partition_config.partition_keys

                for group_keys, group_df in df.groupby(partition_cols):
                    group_table = pa.Table.from_pandas(group_df)
                    group_path = self._build_partition_path(base_path, partition_cols, group_keys)

                    # Write optimized partition
                    pq.write_table(
                        group_table,
                        group_path,
                        compression=self.config.compression.value,
                        row_group_size=50000,
                        use_dictionary=True
                    )

            self.logger.info(f"Dataset optimization completed for {layer}")

        except Exception as e:
            self.logger.error(f"Dataset optimization failed: {e}")
            raise

    def _build_partition_path(self, base_path: str, partition_cols: List[str], group_keys: tuple) -> str:
        """Build partition path from group keys"""
        path_parts = [base_path.rstrip('/')]

        for col, key in zip(partition_cols, group_keys):
            path_parts.append(f"{col}={key}")

        path_parts.append(f"data_{int(datetime.utcnow().timestamp())}.parquet")
        return '/'.join(path_parts)

    def setup_lifecycle_policies(self):
        """Setup automated lifecycle policies for cost optimization"""

        if self.config.provider == 'aws':
            self._setup_s3_lifecycle()
        elif self.config.provider == 'gcp':
            self._setup_gcs_lifecycle()
        elif self.config.provider == 'azure':
            self._setup_azure_lifecycle()

    def _setup_s3_lifecycle(self):
        """Setup S3 lifecycle policies"""
        lifecycle_config = {
            'Rules': [
                {
                    'ID': 'ReviewDataLifecycle',
                    'Status': 'Enabled',
                    'Filter': {'Prefix': 'data-lake/'},
                    'Transitions': [
                        {
                            'Days': self.config.lifecycle_rules[StorageTier.WARM],
                            'StorageClass': 'STANDARD_IA'
                        },
                        {
                            'Days': self.config.lifecycle_rules[StorageTier.COLD],
                            'StorageClass': 'GLACIER'
                        },
                        {
                            'Days': self.config.lifecycle_rules[StorageTier.ARCHIVE],
                            'StorageClass': 'DEEP_ARCHIVE'
                        }
                    ]
                }
            ]
        }

        try:
            self.client.put_bucket_lifecycle_configuration(
                Bucket=self.config.bucket_name,
                LifecycleConfiguration=lifecycle_config
            )
            self.logger.info("S3 lifecycle policies configured")
        except Exception as e:
            self.logger.error(f"Failed to setup S3 lifecycle: {e}")

    def _setup_gcs_lifecycle(self):
        """Setup GCS lifecycle policies"""
        bucket = self.client.bucket(self.config.bucket_name)

        lifecycle_rules = [
            {
                "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
                "condition": {
                    "age": self.config.lifecycle_rules[StorageTier.WARM],
                    "matchesPrefix": ["data-lake/"]
                }
            },
            {
                "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
                "condition": {
                    "age": self.config.lifecycle_rules[StorageTier.COLD],
                    "matchesPrefix": ["data-lake/"]
                }
            },
            {
                "action": {"type": "SetStorageClass", "storageClass": "ARCHIVE"},
                "condition": {
                    "age": self.config.lifecycle_rules[StorageTier.ARCHIVE],
                    "matchesPrefix": ["data-lake/"]
                }
            }
        ]

        try:
            bucket.lifecycle_rules = lifecycle_rules
            bucket.patch()
            self.logger.info("GCS lifecycle policies configured")
        except Exception as e:
            self.logger.error(f"Failed to setup GCS lifecycle: {e}")

    def get_storage_metrics(self) -> Dict[str, Any]:
        """Get storage utilization and cost metrics"""

        metrics = {
            'provider': self.config.provider,
            'bucket': self.config.bucket_name,
            'layers': {}
        }

        layers = ['raw', 'processed', 'features', 'aggregated']

        for layer in layers:
            try:
                base_path = self._get_base_path(layer)
                layer_metrics = self._get_layer_metrics(base_path, layer)
                metrics['layers'][layer] = layer_metrics

            except Exception as e:
                self.logger.error(f"Failed to get metrics for layer {layer}: {e}")
                metrics['layers'][layer] = {'error': str(e)}

        return metrics

    def _get_layer_metrics(self, path: str, layer: str) -> Dict[str, Any]:
        """Get metrics for a specific data layer"""

        if self.config.provider == 'aws':
            return self._get_s3_metrics(path, layer)
        elif self.config.provider == 'gcp':
            return self._get_gcs_metrics(path, layer)
        else:
            return {'total_size_mb': 0, 'file_count': 0, 'last_modified': None}

    def _get_s3_metrics(self, path: str, layer: str) -> Dict[str, Any]:
        """Get S3 storage metrics"""
        paginator = self.client.get_paginator('list_objects_v2')

        total_size = 0
        file_count = 0
        last_modified = None

        try:
            for page in paginator.paginate(Bucket=self.config.bucket_name, Prefix=path):
                for obj in page.get('Contents', []):
                    total_size += obj['Size']
                    file_count += 1

                    if last_modified is None or obj['LastModified'] > last_modified:
                        last_modified = obj['LastModified']

            return {
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'file_count': file_count,
                'last_modified': last_modified.isoformat() if last_modified else None,
                'avg_file_size_mb': round((total_size / file_count) / (1024 * 1024), 2) if file_count > 0 else 0
            }

        except Exception as e:
            self.logger.error(f"Failed to get S3 metrics: {e}")
            return {'error': str(e)}


# Factory function for creating data lake managers
def create_data_lake_manager(provider: str, environment: str = 'production') -> DataLakeManager:
    """Factory function to create configured data lake managers"""

    # Environment-specific configurations
    configs = {
        'production': {
            'aws': StorageConfig(
                provider='aws',
                bucket_name='reviewhub-data-lake-prod',
                region='us-east-1',
                compression=CompressionType.ZSTD,
                partition_config=PartitionConfig(
                    partition_keys=['year', 'month', 'day'],
                    partition_granularity='day',
                    max_partitions_per_write=100,
                    partition_size_mb=128
                ),
                encryption_enabled=True,
                lifecycle_rules={
                    StorageTier.WARM: 30,    # 30 days to IA
                    StorageTier.COLD: 90,    # 90 days to Glacier
                    StorageTier.ARCHIVE: 365  # 1 year to Deep Archive
                }
            ),
            'gcp': StorageConfig(
                provider='gcp',
                bucket_name='reviewhub-data-lake-prod',
                region='us-central1',
                compression=CompressionType.ZSTD,
                partition_config=PartitionConfig(
                    partition_keys=['year', 'month', 'day'],
                    partition_granularity='day',
                    max_partitions_per_write=100,
                    partition_size_mb=128
                ),
                encryption_enabled=True,
                lifecycle_rules={
                    StorageTier.WARM: 30,    # 30 days to Nearline
                    StorageTier.COLD: 90,    # 90 days to Coldline
                    StorageTier.ARCHIVE: 365  # 1 year to Archive
                }
            )
        },
        'development': {
            'aws': StorageConfig(
                provider='aws',
                bucket_name='reviewhub-data-lake-dev',
                region='us-east-1',
                compression=CompressionType.SNAPPY,
                partition_config=PartitionConfig(
                    partition_keys=['year', 'month'],
                    partition_granularity='month',
                    max_partitions_per_write=50,
                    partition_size_mb=64
                ),
                encryption_enabled=False,
                lifecycle_rules={
                    StorageTier.WARM: 7,     # 7 days to IA
                    StorageTier.COLD: 30,    # 30 days to Glacier
                    StorageTier.ARCHIVE: 90  # 90 days to Deep Archive
                }
            )
        }
    }

    if environment not in configs or provider not in configs[environment]:
        raise ValueError(f"Configuration not found for {provider}/{environment}")

    config = configs[environment][provider]
    return DataLakeManager(config)


# Example usage
if __name__ == "__main__":
    # Create production data lake manager
    dl_manager = create_data_lake_manager('aws', 'production')

    # Setup lifecycle policies
    dl_manager.setup_lifecycle_policies()

    # Example: Write sample data
    sample_reviews = [
        {
            'platform': 'google',
            'platform_review_id': 'review_123',
            'business_id': 'biz_456',
            'reviewer_id': 'user_789',
            'rating': 4.5,
            'review_text': 'Great restaurant with excellent service!',
            'review_date': datetime.utcnow(),
            'ingestion_timestamp': datetime.utcnow()
        }
    ]

    # Write to raw layer
    dl_manager.write_reviews_dataset(sample_reviews, layer="raw")

    # Get storage metrics
    metrics = dl_manager.get_storage_metrics()
    print(json.dumps(metrics, indent=2, default=str))