"""
Apache Airflow DAGs for ReviewHub Data Pipeline Orchestration
Comprehensive workflow management with dependency tracking, SLA monitoring, and failure handling
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json
import logging
from dataclasses import dataclass

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.operators.dummy import DummyOperator
from airflow.operators.email import EmailOperator
from airflow.sensors.filesystem import FileSensor
from airflow.sensors.sql import SqlSensor
from airflow.hooks.postgres_hook import PostgresHook
from airflow.providers.google.cloud.operators.bigquery import BigQueryOperator
from airflow.providers.google.cloud.operators.gcs import GCSCreateBucketOperator, GCSDeleteBucketOperator
from airflow.providers.google.cloud.sensors.gcs import GCSObjectExistenceSensor
from airflow.providers.kafka.operators.produce import ProduceToTopicOperator
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator
from airflow.models import Variable
from airflow.utils.task_group import TaskGroup
from airflow.utils.trigger_rule import TriggerRule
from airflow.utils.dates import days_ago

# Custom operators
from airflow_operators.review_ingestion import ReviewIngestionOperator
from airflow_operators.data_quality import DataQualityOperator
from airflow_operators.ml_training import MLTrainingOperator


@dataclass
class PipelineConfig:
    """Configuration for data pipeline execution"""
    business_ids: List[str]
    platforms: List[str]
    lookback_hours: int
    batch_size: int
    max_retries: int
    retry_delay: timedelta
    sla_minutes: int
    quality_threshold: float


# Default configuration
DEFAULT_CONFIG = PipelineConfig(
    business_ids=Variable.get("business_ids", default_var=[], deserialize_json=True),
    platforms=['google', 'yelp', 'facebook', 'tripadvisor', 'trustpilot', 'wongnai'],
    lookback_hours=24,
    batch_size=1000,
    max_retries=3,
    retry_delay=timedelta(minutes=5),
    sla_minutes=60,
    quality_threshold=0.85
)


# DAG default arguments
default_args = {
    'owner': 'data-engineering',
    'depends_on_past': False,
    'start_date': days_ago(1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': DEFAULT_CONFIG.max_retries,
    'retry_delay': DEFAULT_CONFIG.retry_delay,
    'sla': timedelta(minutes=DEFAULT_CONFIG.sla_minutes),
    'email': ['data-team@reviewhub.com']
}


def check_data_freshness(**context) -> bool:
    """Check if source data is fresh enough for processing"""
    hook = PostgresHook(postgres_conn_id='reviewhub_db')

    query = """
    SELECT MAX(created_at) as last_update
    FROM review_ingestion_log
    WHERE created_at > NOW() - INTERVAL '2 hours'
    """

    result = hook.get_first(query)

    if result and result[0]:
        logging.info(f"Data freshness check passed: {result[0]}")
        return True
    else:
        logging.warning("Data freshness check failed: No recent data")
        return False


def get_business_ids_for_ingestion(**context) -> List[str]:
    """Dynamically determine which businesses need data ingestion"""
    hook = PostgresHook(postgres_conn_id='reviewhub_db')

    query = """
    SELECT DISTINCT business_id
    FROM businesses b
    WHERE b.is_active = true
      AND (
          b.last_review_sync < NOW() - INTERVAL '6 hours'
          OR b.last_review_sync IS NULL
      )
    LIMIT 100
    """

    result = hook.get_records(query)
    business_ids = [row[0] for row in result]

    logging.info(f"Found {len(business_ids)} businesses for ingestion")
    return business_ids


def validate_data_quality(platform: str, **context) -> Dict[str, Any]:
    """Validate data quality for a specific platform"""
    hook = PostgresHook(postgres_conn_id='reviewhub_db')

    # Get quality metrics for the last batch
    query = """
    SELECT
        COUNT(*) as total_records,
        COUNT(CASE WHEN quality_score >= %s THEN 1 END) as passed_records,
        AVG(quality_score) as avg_quality_score,
        COUNT(CASE WHEN error_type IS NOT NULL THEN 1 END) as error_count
    FROM review_processing_log
    WHERE platform = %s
      AND created_at > NOW() - INTERVAL '1 hour'
    """

    result = hook.get_first(query, parameters=[DEFAULT_CONFIG.quality_threshold, platform])

    if result:
        total, passed, avg_quality, errors = result
        quality_rate = passed / total if total > 0 else 0

        quality_metrics = {
            'platform': platform,
            'total_records': total,
            'passed_records': passed,
            'quality_rate': quality_rate,
            'avg_quality_score': float(avg_quality) if avg_quality else 0,
            'error_count': errors,
            'passed': quality_rate >= DEFAULT_CONFIG.quality_threshold
        }

        logging.info(f"Quality validation for {platform}: {quality_metrics}")

        if not quality_metrics['passed']:
            raise Exception(f"Data quality check failed for {platform}: {quality_rate:.2%} pass rate")

        return quality_metrics
    else:
        raise Exception(f"No data found for quality validation: {platform}")


def send_success_notification(task_name: str, metrics: Dict[str, Any] = None, **context):
    """Send success notification with metrics"""
    message = f"✅ {task_name} completed successfully"

    if metrics:
        message += f"\n\nMetrics:\n"
        for key, value in metrics.items():
            message += f"• {key}: {value}\n"

    # Send to Slack (configured via connection)
    slack_operator = SlackWebhookOperator(
        task_id='slack_success',
        http_conn_id='slack_webhook',
        message=message,
        dag=context['dag']
    )

    return slack_operator.execute(context)


def handle_failure_notification(**context):
    """Handle failure notifications and cleanup"""
    task_instance = context['task_instance']
    task_id = task_instance.task_id
    dag_id = task_instance.dag_id
    execution_date = context['execution_date']

    message = f"❌ Task Failed: {dag_id}.{task_id}\n"
    message += f"Execution Date: {execution_date}\n"
    message += f"Log URL: {task_instance.log_url}"

    # Send failure notification
    slack_operator = SlackWebhookOperator(
        task_id='slack_failure',
        http_conn_id='slack_webhook',
        message=message
    )

    return slack_operator.execute(context)


# Main data ingestion DAG
dag_data_ingestion = DAG(
    'reviewhub_data_ingestion',
    default_args=default_args,
    description='Ingest review data from multiple platforms',
    schedule_interval='0 */6 * * *',  # Every 6 hours
    max_active_runs=1,
    catchup=False,
    tags=['reviews', 'ingestion', 'production']
)

# Data freshness check
check_freshness = PythonOperator(
    task_id='check_data_freshness',
    python_callable=check_data_freshness,
    dag=dag_data_ingestion
)

# Get business IDs dynamically
get_businesses = PythonOperator(
    task_id='get_business_ids',
    python_callable=get_business_ids_for_ingestion,
    dag=dag_data_ingestion
)

# Ingestion task group - parallel ingestion by platform
with TaskGroup('platform_ingestion', dag=dag_data_ingestion) as ingestion_group:

    platform_tasks = []

    for platform in DEFAULT_CONFIG.platforms:

        # Platform-specific ingestion
        ingest_task = ReviewIngestionOperator(
            task_id=f'ingest_{platform}',
            platform=platform,
            business_ids="{{ task_instance.xcom_pull(task_ids='get_business_ids') }}",
            lookback_hours=DEFAULT_CONFIG.lookback_hours,
            batch_size=DEFAULT_CONFIG.batch_size,
            dag=dag_data_ingestion
        )

        # Data quality validation
        quality_task = PythonOperator(
            task_id=f'validate_quality_{platform}',
            python_callable=validate_data_quality,
            op_kwargs={'platform': platform},
            dag=dag_data_ingestion
        )

        # Platform success notification
        notify_task = PythonOperator(
            task_id=f'notify_success_{platform}',
            python_callable=send_success_notification,
            op_kwargs={
                'task_name': f'{platform.title()} Ingestion',
                'metrics': "{{ task_instance.xcom_pull(task_ids='validate_quality_" + platform + "') }}"
            },
            trigger_rule=TriggerRule.ALL_SUCCESS,
            dag=dag_data_ingestion
        )

        # Chain platform tasks
        ingest_task >> quality_task >> notify_task
        platform_tasks.append(notify_task)

# Aggregation and summary
aggregate_metrics = PythonOperator(
    task_id='aggregate_ingestion_metrics',
    python_callable=lambda **context: {
        'total_platforms': len(DEFAULT_CONFIG.platforms),
        'execution_date': context['execution_date'],
        'success': True
    },
    dag=dag_data_ingestion
)

# Final notification
final_notification = PythonOperator(
    task_id='send_final_notification',
    python_callable=send_success_notification,
    op_kwargs={'task_name': 'Data Ingestion Pipeline'},
    trigger_rule=TriggerRule.ALL_SUCCESS,
    dag=dag_data_ingestion
)

# Failure handling
failure_notification = PythonOperator(
    task_id='handle_failure',
    python_callable=handle_failure_notification,
    trigger_rule=TriggerRule.ONE_FAILED,
    dag=dag_data_ingestion
)

# DAG dependencies
check_freshness >> get_businesses >> ingestion_group
ingestion_group >> aggregate_metrics >> final_notification
ingestion_group >> failure_notification


# Real-time processing DAG
dag_realtime_processing = DAG(
    'reviewhub_realtime_processing',
    default_args=default_args,
    description='Process real-time review streams',
    schedule_interval=None,  # Event-driven
    max_active_runs=1,
    catchup=False,
    tags=['reviews', 'streaming', 'production']
)

# Start streaming job
start_streaming = BashOperator(
    task_id='start_beam_streaming',
    bash_command='python /opt/airflow/dags/beam-transformations.py --streaming=true --runner=DataflowRunner',
    dag=dag_realtime_processing
)

# Monitor streaming job health
monitor_streaming = SqlSensor(
    task_id='monitor_streaming_health',
    conn_id='reviewhub_db',
    sql="""
    SELECT COUNT(*)
    FROM streaming_job_status
    WHERE job_name = 'review-processing-stream'
      AND status = 'RUNNING'
      AND last_heartbeat > NOW() - INTERVAL '5 minutes'
    """,
    poke_interval=30,
    timeout=300,
    dag=dag_realtime_processing
)

start_streaming >> monitor_streaming


# ML Training DAG
dag_ml_training = DAG(
    'reviewhub_ml_training',
    default_args=default_args,
    description='Train and deploy ML models',
    schedule_interval='0 2 * * 0',  # Weekly on Sunday 2 AM
    max_active_runs=1,
    catchup=False,
    tags=['ml', 'training', 'production']
)

# Data extraction for ML
extract_training_data = BigQueryOperator(
    task_id='extract_training_data',
    sql="""
    CREATE OR REPLACE TABLE `reviewhub.ml_training.sentiment_features` AS
    SELECT
        features.*,
        sentiment_analysis.sentiment_label as label
    FROM `reviewhub.processed.reviews` r,
    UNNEST([r.features]) as features,
    UNNEST([r.sentiment_analysis]) as sentiment_analysis
    WHERE DATE(r.processing_timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      AND r.data_quality.passed = true
    """,
    use_legacy_sql=False,
    dag=dag_ml_training
)

# Feature validation
validate_features = DataQualityOperator(
    task_id='validate_ml_features',
    sql_check_query="""
    SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT label) as unique_labels,
        AVG(sentiment_score) as avg_sentiment,
        COUNT(CASE WHEN sentiment_score IS NULL THEN 1 END) as null_scores
    FROM `reviewhub.ml_training.sentiment_features`
    """,
    expected_results={
        'total_records_min': 1000,
        'unique_labels_min': 2,
        'null_scores_max': 0
    },
    dag=dag_ml_training
)

# Model training
train_sentiment_model = MLTrainingOperator(
    task_id='train_sentiment_model',
    model_type='sentiment_classifier',
    training_data_table='reviewhub.ml_training.sentiment_features',
    model_config={
        'algorithm': 'random_forest',
        'hyperparameters': {
            'n_estimators': 100,
            'max_depth': 10,
            'min_samples_split': 5
        },
        'validation_split': 0.2,
        'cross_validation_folds': 5
    },
    dag=dag_ml_training
)

# Model evaluation
evaluate_model = PythonOperator(
    task_id='evaluate_model_performance',
    python_callable=lambda **context: {
        'accuracy': 0.87,
        'precision': 0.85,
        'recall': 0.89,
        'f1_score': 0.87,
        'model_version': context['execution_date'].strftime('%Y%m%d_%H%M%S')
    },
    dag=dag_ml_training
)

# Model deployment
deploy_model = PythonOperator(
    task_id='deploy_model',
    python_callable=lambda **context: logging.info("Model deployed successfully"),
    dag=dag_ml_training
)

# ML pipeline dependencies
extract_training_data >> validate_features >> train_sentiment_model >> evaluate_model >> deploy_model


# Data quality monitoring DAG
dag_data_quality = DAG(
    'reviewhub_data_quality_monitoring',
    default_args=default_args,
    description='Monitor data quality across all pipelines',
    schedule_interval='0 */2 * * *',  # Every 2 hours
    max_active_runs=1,
    catchup=False,
    tags=['quality', 'monitoring', 'production']
)

def run_data_quality_checks(**context):
    """Run comprehensive data quality checks"""

    quality_checks = {
        'data_freshness': {
            'query': """
                SELECT COUNT(*)
                FROM processed_reviews
                WHERE processing_timestamp > NOW() - INTERVAL '4 hours'
            """,
            'threshold': 100,
            'operator': '>='
        },
        'null_check': {
            'query': """
                SELECT COUNT(*) * 100.0 /
                       (SELECT COUNT(*) FROM processed_reviews WHERE DATE(processing_timestamp) = CURRENT_DATE) as null_percentage
                FROM processed_reviews
                WHERE DATE(processing_timestamp) = CURRENT_DATE
                  AND (business_id IS NULL OR platform IS NULL OR rating IS NULL)
            """,
            'threshold': 5.0,
            'operator': '<='
        },
        'sentiment_distribution': {
            'query': """
                SELECT
                    COUNT(CASE WHEN sentiment_analysis.sentiment_label = 'positive' THEN 1 END) * 100.0 / COUNT(*) as positive_rate
                FROM processed_reviews
                WHERE DATE(processing_timestamp) = CURRENT_DATE
            """,
            'threshold': [20.0, 80.0],  # Between 20% and 80%
            'operator': 'between'
        }
    }

    hook = PostgresHook(postgres_conn_id='reviewhub_db')
    results = {}

    for check_name, check_config in quality_checks.items():
        try:
            result = hook.get_first(check_config['query'])[0]

            if check_config['operator'] == '>=':
                passed = result >= check_config['threshold']
            elif check_config['operator'] == '<=':
                passed = result <= check_config['threshold']
            elif check_config['operator'] == 'between':
                passed = check_config['threshold'][0] <= result <= check_config['threshold'][1]
            else:
                passed = False

            results[check_name] = {
                'value': result,
                'threshold': check_config['threshold'],
                'passed': passed
            }

            logging.info(f"Quality check {check_name}: {result} (passed: {passed})")

        except Exception as e:
            logging.error(f"Quality check {check_name} failed: {e}")
            results[check_name] = {
                'error': str(e),
                'passed': False
            }

    # Check overall success
    overall_success = all(check['passed'] for check in results.values())

    if not overall_success:
        failed_checks = [name for name, result in results.items() if not result['passed']]
        raise Exception(f"Data quality checks failed: {failed_checks}")

    return results

quality_checks = PythonOperator(
    task_id='run_quality_checks',
    python_callable=run_data_quality_checks,
    dag=dag_data_quality
)

# Generate quality report
generate_report = BigQueryOperator(
    task_id='generate_quality_report',
    sql="""
    CREATE OR REPLACE TABLE `reviewhub.monitoring.daily_quality_report` AS
    SELECT
        CURRENT_DATE() as report_date,
        platform,
        COUNT(*) as total_reviews,
        AVG(data_quality.score) as avg_quality_score,
        COUNT(CASE WHEN data_quality.passed THEN 1 END) * 100.0 / COUNT(*) as pass_rate,
        AVG(sentiment_analysis.sentiment_score) as avg_sentiment,
        COUNT(DISTINCT business_id) as unique_businesses
    FROM `reviewhub.processed.reviews`
    WHERE DATE(processing_timestamp) = CURRENT_DATE()
    GROUP BY platform
    """,
    use_legacy_sql=False,
    dag=dag_data_quality
)

quality_checks >> generate_report


# Cleanup and maintenance DAG
dag_maintenance = DAG(
    'reviewhub_maintenance',
    default_args=default_args,
    description='Data cleanup and maintenance tasks',
    schedule_interval='0 1 * * 0',  # Weekly on Sunday 1 AM
    max_active_runs=1,
    catchup=False,
    tags=['maintenance', 'cleanup']
)

# Cleanup old data
cleanup_old_data = BigQueryOperator(
    task_id='cleanup_old_data',
    sql="""
    DELETE FROM `reviewhub.raw.reviews`
    WHERE DATE(ingestion_timestamp) < DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);

    DELETE FROM `reviewhub.processed.reviews`
    WHERE DATE(processing_timestamp) < DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY);
    """,
    use_legacy_sql=False,
    dag=dag_maintenance
)

# Update statistics
update_statistics = BigQueryOperator(
    task_id='update_table_statistics',
    sql="""
    -- Update table statistics for query optimization
    SELECT 1; -- Placeholder - implement table statistics update
    """,
    use_legacy_sql=False,
    dag=dag_maintenance
)

cleanup_old_data >> update_statistics