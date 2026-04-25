"""
Performance optimization for data validation system

Implements caching, streaming validation, batch processing,
and incremental validation for high-performance data processing.
"""

import asyncio
import logging
import hashlib
import json
import pickle
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, AsyncIterator
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import aioredis
from cachetools import TTLCache, LRUCache
import pandas as pd
import numpy as np
from pydantic import BaseModel

from ..core.models import ReviewValidationModel, ValidationLevel
from ..validators.schema_validator import SchemaValidator

logger = logging.getLogger(__name__)

@dataclass
class ValidationMetrics:
    """Performance metrics for validation operations"""
    total_records: int
    validation_time_seconds: float
    throughput_records_per_second: float
    cache_hit_ratio: float
    memory_usage_mb: float
    cpu_utilization: float
    error_rate: float

@dataclass
class CacheStats:
    """Cache performance statistics"""
    hits: int
    misses: int
    hit_ratio: float
    cache_size: int
    max_size: int
    evictions: int

class ValidationCache:
    """Multi-level caching system for validation results"""

    def __init__(self, redis_url: Optional[str] = None, local_cache_size: int = 10000):
        self.local_cache = TTLCache(maxsize=local_cache_size, ttl=3600)  # 1 hour TTL
        self.lru_cache = LRUCache(maxsize=5000)
        self.redis_client = None
        self.redis_url = redis_url

        # Cache statistics
        self.stats = {
            'local_hits': 0,
            'local_misses': 0,
            'redis_hits': 0,
            'redis_misses': 0,
            'evictions': 0
        }

    async def initialize_redis(self):
        """Initialize Redis connection for distributed caching"""
        if self.redis_url:
            try:
                self.redis_client = await aioredis.from_url(self.redis_url)
                logger.info("Redis cache initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis: {e}. Using local cache only.")

    async def get_validation_result(self, record_hash: str, validation_level: ValidationLevel) -> Optional[Dict[str, Any]]:
        """
        Get cached validation result

        Args:
            record_hash: Hash of the record being validated
            validation_level: Validation level used

        Returns:
            Cached validation result or None if not found
        """
        cache_key = f"{record_hash}_{validation_level.value}"

        # Check local cache first (fastest)
        if cache_key in self.local_cache:
            self.stats['local_hits'] += 1
            return self.local_cache[cache_key]

        self.stats['local_misses'] += 1

        # Check LRU cache
        if cache_key in self.lru_cache:
            result = self.lru_cache[cache_key]
            # Promote to local cache
            self.local_cache[cache_key] = result
            return result

        # Check Redis cache if available
        if self.redis_client:
            try:
                cached_result = await self.redis_client.get(cache_key)
                if cached_result:
                    self.stats['redis_hits'] += 1
                    result = json.loads(cached_result)

                    # Promote to local caches
                    self.local_cache[cache_key] = result
                    self.lru_cache[cache_key] = result

                    return result
                else:
                    self.stats['redis_misses'] += 1
            except Exception as e:
                logger.warning(f"Redis cache error: {e}")

        return None

    async def cache_validation_result(self, record_hash: str, validation_level: ValidationLevel, result: Dict[str, Any]):
        """
        Cache validation result at multiple levels

        Args:
            record_hash: Hash of the record
            validation_level: Validation level used
            result: Validation result to cache
        """
        cache_key = f"{record_hash}_{validation_level.value}"

        # Store in local cache
        self.local_cache[cache_key] = result

        # Store in LRU cache
        self.lru_cache[cache_key] = result

        # Store in Redis with longer TTL
        if self.redis_client:
            try:
                await self.redis_client.setex(
                    cache_key,
                    timedelta(hours=24),  # 24 hour TTL for Redis
                    json.dumps(result, default=str)
                )
            except Exception as e:
                logger.warning(f"Failed to cache in Redis: {e}")

    def get_cache_stats(self) -> CacheStats:
        """Get comprehensive cache statistics"""
        total_requests = self.stats['local_hits'] + self.stats['local_misses']
        hit_ratio = self.stats['local_hits'] / total_requests if total_requests > 0 else 0

        return CacheStats(
            hits=self.stats['local_hits'],
            misses=self.stats['local_misses'],
            hit_ratio=hit_ratio,
            cache_size=len(self.local_cache),
            max_size=self.local_cache.maxsize,
            evictions=self.stats['evictions']
        )

    def clear_cache(self):
        """Clear all caches"""
        self.local_cache.clear()
        self.lru_cache.clear()
        if self.redis_client:
            asyncio.create_task(self.redis_client.flushdb())

class BatchProcessor:
    """Optimized batch processing for large datasets"""

    def __init__(self, batch_size: int = 1000, max_workers: int = None):
        self.batch_size = batch_size
        self.max_workers = max_workers or min(32, (os.cpu_count() or 1) + 4)
        self.thread_pool = ThreadPoolExecutor(max_workers=self.max_workers)
        self.process_pool = ProcessPoolExecutor(max_workers=max(1, self.max_workers // 4))

    async def process_batch_async(self, data: List[Dict[str, Any]],
                                validator_func: callable) -> List[Dict[str, Any]]:
        """
        Process data in batches asynchronously

        Args:
            data: List of records to validate
            validator_func: Validation function to apply

        Returns:
            List of validation results
        """
        start_time = datetime.now()
        results = []

        # Split into batches
        batches = [data[i:i + self.batch_size] for i in range(0, len(data), self.batch_size)]

        logger.info(f"Processing {len(data)} records in {len(batches)} batches")

        # Process batches concurrently
        tasks = []
        for batch_index, batch in enumerate(batches):
            task = asyncio.create_task(
                self._process_single_batch(batch, validator_func, batch_index)
            )
            tasks.append(task)

        # Wait for all batches to complete
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine results
        for batch_result in batch_results:
            if isinstance(batch_result, Exception):
                logger.error(f"Batch processing error: {batch_result}")
                # Add error placeholders
                results.extend([{"error": str(batch_result)} for _ in range(self.batch_size)])
            else:
                results.extend(batch_result)

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        throughput = len(data) / duration if duration > 0 else 0

        logger.info(f"Batch processing complete: {throughput:.2f} records/sec")

        return results

    async def _process_single_batch(self, batch: List[Dict[str, Any]],
                                  validator_func: callable,
                                  batch_index: int) -> List[Dict[str, Any]]:
        """Process a single batch of records"""
        try:
            logger.debug(f"Processing batch {batch_index} with {len(batch)} records")

            # Use thread pool for CPU-bound validation
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.thread_pool,
                self._validate_batch_sync,
                batch,
                validator_func
            )

            return result

        except Exception as e:
            logger.error(f"Error processing batch {batch_index}: {e}")
            raise

    def _validate_batch_sync(self, batch: List[Dict[str, Any]], validator_func: callable) -> List[Dict[str, Any]]:
        """Synchronous batch validation for thread pool execution"""
        results = []
        for record in batch:
            try:
                result = validator_func(record)
                results.append(result)
            except Exception as e:
                results.append({"error": str(e), "record": record})

        return results

    async def process_stream(self, data_stream: AsyncIterator[Dict[str, Any]],
                           validator_func: callable) -> AsyncIterator[Dict[str, Any]]:
        """
        Process streaming data with validation

        Args:
            data_stream: Async iterator of data records
            validator_func: Validation function

        Yields:
            Validated records
        """
        batch = []

        async for record in data_stream:
            batch.append(record)

            if len(batch) >= self.batch_size:
                # Process current batch
                batch_results = await self._process_single_batch(batch, validator_func, 0)
                for result in batch_results:
                    yield result

                # Reset batch
                batch = []

        # Process remaining records
        if batch:
            batch_results = await self._process_single_batch(batch, validator_func, 0)
            for result in batch_results:
                yield result

class IncrementalValidator:
    """Incremental validation system for changed data only"""

    def __init__(self, cache: ValidationCache):
        self.cache = cache
        self.change_detection = ChangeDetector()

    async def validate_incremental(self, current_data: List[Dict[str, Any]],
                                 previous_data: Optional[List[Dict[str, Any]]] = None,
                                 validator_func: callable = None) -> Dict[str, Any]:
        """
        Perform incremental validation on changed data only

        Args:
            current_data: Current dataset
            previous_data: Previous dataset for comparison
            validator_func: Validation function

        Returns:
            Incremental validation results
        """
        start_time = datetime.now()

        # Detect changes
        changes = await self.change_detection.detect_changes(current_data, previous_data)

        logger.info(f"Detected changes: {changes['summary']}")

        # Validate only changed records
        validation_results = {
            'new_records': [],
            'updated_records': [],
            'deleted_records': changes['deleted'],
            'unchanged_count': changes['summary']['unchanged'],
            'validation_metrics': None
        }

        # Validate new records
        if changes['new']:
            new_results = []
            for record in changes['new']:
                result = await self._validate_single_record(record, validator_func)
                new_results.append(result)
            validation_results['new_records'] = new_results

        # Validate updated records
        if changes['updated']:
            updated_results = []
            for record in changes['updated']:
                result = await self._validate_single_record(record, validator_func)
                updated_results.append(result)
            validation_results['updated_records'] = updated_results

        # Calculate metrics
        total_validated = len(changes['new']) + len(changes['updated'])
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        validation_results['validation_metrics'] = ValidationMetrics(
            total_records=total_validated,
            validation_time_seconds=duration,
            throughput_records_per_second=total_validated / duration if duration > 0 else 0,
            cache_hit_ratio=0,  # Would be calculated from cache stats
            memory_usage_mb=0,  # Would be measured
            cpu_utilization=0,  # Would be measured
            error_rate=0        # Would be calculated from results
        )

        return validation_results

    async def _validate_single_record(self, record: Dict[str, Any], validator_func: callable) -> Dict[str, Any]:
        """Validate a single record with caching"""
        record_hash = self._calculate_record_hash(record)

        # Try cache first
        cached_result = await self.cache.get_validation_result(record_hash, ValidationLevel.STANDARD)
        if cached_result:
            return cached_result

        # Validate and cache result
        result = validator_func(record) if validator_func else {"valid": True, "record": record}
        await self.cache.cache_validation_result(record_hash, ValidationLevel.STANDARD, result)

        return result

    def _calculate_record_hash(self, record: Dict[str, Any]) -> str:
        """Calculate deterministic hash for a record"""
        # Sort keys for consistent hashing
        sorted_record = json.dumps(record, sort_keys=True)
        return hashlib.sha256(sorted_record.encode()).hexdigest()

class ChangeDetector:
    """Efficient change detection between datasets"""

    async def detect_changes(self, current_data: List[Dict[str, Any]],
                           previous_data: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Detect changes between current and previous datasets

        Args:
            current_data: Current dataset
            previous_data: Previous dataset (if available)

        Returns:
            Dictionary containing new, updated, deleted, and unchanged records
        """
        if not previous_data:
            # All records are new
            return {
                'new': current_data,
                'updated': [],
                'deleted': [],
                'unchanged': [],
                'summary': {
                    'new': len(current_data),
                    'updated': 0,
                    'deleted': 0,
                    'unchanged': 0
                }
            }

        # Create hash maps for efficient lookups
        current_hashes = {}
        previous_hashes = {}

        # Hash current data
        for i, record in enumerate(current_data):
            record_hash = self._hash_record(record)
            current_hashes[record_hash] = {'index': i, 'record': record}

        # Hash previous data
        for i, record in enumerate(previous_data):
            record_hash = self._hash_record(record)
            previous_hashes[record_hash] = {'index': i, 'record': record}

        # Detect changes
        new_records = []
        updated_records = []
        deleted_records = []
        unchanged_records = []

        # Find new and updated records
        for record_hash, current_info in current_hashes.items():
            if record_hash not in previous_hashes:
                new_records.append(current_info['record'])
            else:
                # Check if record content actually changed (not just hash)
                if self._records_equal(current_info['record'], previous_hashes[record_hash]['record']):
                    unchanged_records.append(current_info['record'])
                else:
                    updated_records.append(current_info['record'])

        # Find deleted records
        for record_hash, previous_info in previous_hashes.items():
            if record_hash not in current_hashes:
                deleted_records.append(previous_info['record'])

        return {
            'new': new_records,
            'updated': updated_records,
            'deleted': deleted_records,
            'unchanged': unchanged_records,
            'summary': {
                'new': len(new_records),
                'updated': len(updated_records),
                'deleted': len(deleted_records),
                'unchanged': len(unchanged_records)
            }
        }

    def _hash_record(self, record: Dict[str, Any]) -> str:
        """Create hash for record comparison"""
        # Remove non-essential fields that might change frequently
        filtered_record = {k: v for k, v in record.items()
                          if k not in ['timestamp', 'updated_at', 'last_modified']}

        sorted_record = json.dumps(filtered_record, sort_keys=True, default=str)
        return hashlib.md5(sorted_record.encode()).hexdigest()

    def _records_equal(self, record1: Dict[str, Any], record2: Dict[str, Any]) -> bool:
        """Deep comparison of two records"""
        try:
            return json.dumps(record1, sort_keys=True, default=str) == \
                   json.dumps(record2, sort_keys=True, default=str)
        except:
            return record1 == record2

class PerformanceOptimizer:
    """Main performance optimization orchestrator"""

    def __init__(self, redis_url: Optional[str] = None, batch_size: int = 1000):
        self.cache = ValidationCache(redis_url=redis_url)
        self.batch_processor = BatchProcessor(batch_size=batch_size)
        self.incremental_validator = IncrementalValidator(self.cache)
        self.metrics_history = []

    async def initialize(self):
        """Initialize all performance components"""
        await self.cache.initialize_redis()
        logger.info("Performance optimizer initialized")

    async def optimize_validation(self, data: List[Dict[str, Any]],
                                validator_func: callable,
                                validation_strategy: str = 'auto') -> Dict[str, Any]:
        """
        Optimize validation using best strategy for the data

        Args:
            data: Data to validate
            validator_func: Validation function
            validation_strategy: 'auto', 'batch', 'stream', or 'incremental'

        Returns:
            Optimized validation results with performance metrics
        """
        start_time = datetime.now()

        # Auto-select strategy if needed
        if validation_strategy == 'auto':
            validation_strategy = self._select_optimal_strategy(data)

        logger.info(f"Using {validation_strategy} validation strategy for {len(data)} records")

        # Execute selected strategy
        if validation_strategy == 'batch':
            results = await self.batch_processor.process_batch_async(data, validator_func)

        elif validation_strategy == 'incremental':
            # For incremental, we'd need previous data - using batch as fallback
            results = await self.batch_processor.process_batch_async(data, validator_func)

        elif validation_strategy == 'stream':
            # Convert to async iterator for streaming
            async def data_stream():
                for record in data:
                    yield record

            results = []
            async for result in self.batch_processor.process_stream(data_stream(), validator_func):
                results.append(result)

        else:
            # Default batch processing
            results = await self.batch_processor.process_batch_async(data, validator_func)

        # Calculate performance metrics
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        cache_stats = self.cache.get_cache_stats()

        metrics = ValidationMetrics(
            total_records=len(data),
            validation_time_seconds=duration,
            throughput_records_per_second=len(data) / duration if duration > 0 else 0,
            cache_hit_ratio=cache_stats.hit_ratio,
            memory_usage_mb=0,  # Would implement memory monitoring
            cpu_utilization=0,  # Would implement CPU monitoring
            error_rate=len([r for r in results if 'error' in r]) / len(results) if results else 0
        )

        self.metrics_history.append(metrics)

        return {
            'results': results,
            'metrics': asdict(metrics),
            'strategy_used': validation_strategy,
            'cache_stats': asdict(cache_stats)
        }

    def _select_optimal_strategy(self, data: List[Dict[str, Any]]) -> str:
        """Auto-select optimal validation strategy based on data characteristics"""
        data_size = len(data)

        # Simple heuristics for strategy selection
        if data_size < 100:
            return 'batch'  # Small datasets - just batch process
        elif data_size < 10000:
            return 'batch'  # Medium datasets - batch with caching
        else:
            return 'stream'  # Large datasets - streaming validation

    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary across all validation runs"""
        if not self.metrics_history:
            return {"message": "No validation runs recorded"}

        total_records = sum(m.total_records for m in self.metrics_history)
        total_time = sum(m.validation_time_seconds for m in self.metrics_history)
        avg_throughput = sum(m.throughput_records_per_second for m in self.metrics_history) / len(self.metrics_history)
        avg_cache_hit = sum(m.cache_hit_ratio for m in self.metrics_history) / len(self.metrics_history)

        return {
            'total_validation_runs': len(self.metrics_history),
            'total_records_processed': total_records,
            'total_validation_time_seconds': total_time,
            'average_throughput_per_second': avg_throughput,
            'average_cache_hit_ratio': avg_cache_hit,
            'cache_stats': asdict(self.cache.get_cache_stats())
        }

    async def cleanup(self):
        """Cleanup resources"""
        self.batch_processor.thread_pool.shutdown(wait=True)
        self.batch_processor.process_pool.shutdown(wait=True)

        if self.cache.redis_client:
            await self.cache.redis_client.close()

# Performance monitoring utilities

class PerformanceMonitor:
    """Monitor validation performance in real-time"""

    def __init__(self):
        self.active_validations = {}
        self.metrics_buffer = []

    def start_monitoring(self, validation_id: str):
        """Start monitoring a validation session"""
        self.active_validations[validation_id] = {
            'start_time': datetime.now(),
            'records_processed': 0,
            'errors_encountered': 0
        }

    def update_progress(self, validation_id: str, records_processed: int, errors: int = 0):
        """Update progress for a validation session"""
        if validation_id in self.active_validations:
            self.active_validations[validation_id]['records_processed'] = records_processed
            self.active_validations[validation_id]['errors_encountered'] += errors

    def end_monitoring(self, validation_id: str) -> Dict[str, Any]:
        """End monitoring and return final metrics"""
        if validation_id not in self.active_validations:
            return {}

        session = self.active_validations.pop(validation_id)
        end_time = datetime.now()
        duration = (end_time - session['start_time']).total_seconds()

        metrics = {
            'validation_id': validation_id,
            'duration_seconds': duration,
            'records_processed': session['records_processed'],
            'errors_encountered': session['errors_encountered'],
            'throughput_per_second': session['records_processed'] / duration if duration > 0 else 0,
            'error_rate': session['errors_encountered'] / session['records_processed'] if session['records_processed'] > 0 else 0
        }

        self.metrics_buffer.append(metrics)
        return metrics

    def get_real_time_stats(self) -> Dict[str, Any]:
        """Get real-time statistics for active validations"""
        stats = {
            'active_sessions': len(self.active_validations),
            'total_records_processing': sum(s['records_processed'] for s in self.active_validations.values()),
            'sessions': []
        }

        for validation_id, session in self.active_validations.items():
            current_duration = (datetime.now() - session['start_time']).total_seconds()
            current_throughput = session['records_processed'] / current_duration if current_duration > 0 else 0

            stats['sessions'].append({
                'validation_id': validation_id,
                'running_time_seconds': current_duration,
                'records_processed': session['records_processed'],
                'current_throughput': current_throughput,
                'errors': session['errors_encountered']
            })

        return stats

# Memory optimization utilities
import gc
import psutil
import os

class MemoryOptimizer:
    """Optimize memory usage during validation"""

    def __init__(self):
        self.process = psutil.Process(os.getpid())

    def get_memory_usage(self) -> Dict[str, float]:
        """Get current memory usage"""
        memory_info = self.process.memory_info()
        return {
            'rss_mb': memory_info.rss / 1024 / 1024,
            'vms_mb': memory_info.vms / 1024 / 1024,
            'percent': self.process.memory_percent()
        }

    def optimize_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Optimize DataFrame memory usage"""
        start_memory = df.memory_usage(deep=True).sum()

        # Optimize numeric columns
        for col in df.select_dtypes(include=['int']).columns:
            col_min = df[col].min()
            col_max = df[col].max()

            if col_min >= np.iinfo(np.int8).min and col_max <= np.iinfo(np.int8).max:
                df[col] = df[col].astype(np.int8)
            elif col_min >= np.iinfo(np.int16).min and col_max <= np.iinfo(np.int16).max:
                df[col] = df[col].astype(np.int16)
            elif col_min >= np.iinfo(np.int32).min and col_max <= np.iinfo(np.int32).max:
                df[col] = df[col].astype(np.int32)

        # Optimize float columns
        for col in df.select_dtypes(include=['float']).columns:
            if df[col].min() >= np.finfo(np.float32).min and df[col].max() <= np.finfo(np.float32).max:
                df[col] = df[col].astype(np.float32)

        # Convert object columns to category if beneficial
        for col in df.select_dtypes(include=['object']).columns:
            if df[col].nunique() / len(df) < 0.5:  # Less than 50% unique values
                df[col] = df[col].astype('category')

        end_memory = df.memory_usage(deep=True).sum()
        logger.info(f"Memory optimization: {start_memory / 1024 / 1024:.2f}MB -> {end_memory / 1024 / 1024:.2f}MB "
                   f"({(start_memory - end_memory) / start_memory * 100:.1f}% reduction)")

        return df

    def cleanup_memory(self):
        """Force garbage collection to free memory"""
        gc.collect()
        logger.debug("Memory cleanup performed")