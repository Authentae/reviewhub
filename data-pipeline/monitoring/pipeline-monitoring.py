"""
Comprehensive Pipeline Monitoring and Alerting
Real-time monitoring, performance tracking, and intelligent alerting system
"""

import time
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field, asdict
from enum import Enum
import threading
import asyncio
from pathlib import Path
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Monitoring and metrics
import psutil
import requests
from prometheus_client import Counter, Histogram, Gauge, Summary, CollectorRegistry, generate_latest
from prometheus_client.core import REGISTRY
import prometheus_client

# Data processing
import pandas as pd
import numpy as np
from collections import deque, defaultdict


class AlertSeverity(Enum):
    """Alert severity levels"""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class MetricType(Enum):
    """Types of metrics to track"""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


class PipelineStage(Enum):
    """Pipeline stages for monitoring"""
    INGESTION = "ingestion"
    PROCESSING = "processing"
    VALIDATION = "validation"
    STORAGE = "storage"
    SERVING = "serving"


@dataclass
class Alert:
    """Alert definition and state"""
    id: str
    name: str
    description: str
    condition: str
    severity: AlertSeverity
    threshold: float
    metric_name: str
    comparison: str  # '>', '<', '>=', '<=', '=='
    window_minutes: int = 5
    consecutive_breaches: int = 1
    enabled: bool = True
    last_triggered: Optional[datetime] = None
    breach_count: int = 0
    suppressed_until: Optional[datetime] = None
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class MetricPoint:
    """Single metric data point"""
    name: str
    value: float
    timestamp: datetime
    labels: Dict[str, str] = field(default_factory=dict)


@dataclass
class PipelineHealth:
    """Overall pipeline health status"""
    timestamp: datetime
    overall_status: str  # 'healthy', 'degraded', 'critical'
    stage_status: Dict[PipelineStage, str]
    active_alerts: List[Alert]
    performance_metrics: Dict[str, float]
    data_quality_score: float
    throughput_metrics: Dict[str, float]


class MetricsCollector:
    """Collects and manages pipeline metrics"""

    def __init__(self, registry: Optional[CollectorRegistry] = None):
        self.registry = registry or REGISTRY
        self.metrics = {}
        self._setup_default_metrics()

    def _setup_default_metrics(self):
        """Setup default pipeline metrics"""

        # Throughput metrics
        self.messages_processed = Counter(
            'pipeline_messages_processed_total',
            'Total messages processed',
            ['stage', 'source', 'status'],
            registry=self.registry
        )

        self.processing_duration = Histogram(
            'pipeline_processing_duration_seconds',
            'Time spent processing messages',
            ['stage', 'source'],
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, 120.0],
            registry=self.registry
        )

        # Error metrics
        self.error_rate = Counter(
            'pipeline_errors_total',
            'Total pipeline errors',
            ['stage', 'error_type', 'severity'],
            registry=self.registry
        )

        # Data quality metrics
        self.data_quality_score = Gauge(
            'pipeline_data_quality_score',
            'Data quality score (0-1)',
            ['dataset', 'dimension'],
            registry=self.registry
        )

        # System metrics
        self.cpu_usage = Gauge(
            'pipeline_cpu_usage_percent',
            'CPU usage percentage',
            ['component'],
            registry=self.registry
        )

        self.memory_usage = Gauge(
            'pipeline_memory_usage_bytes',
            'Memory usage in bytes',
            ['component'],
            registry=self.registry
        )

        self.disk_usage = Gauge(
            'pipeline_disk_usage_bytes',
            'Disk usage in bytes',
            ['mount_point'],
            registry=self.registry
        )

        # Pipeline-specific metrics
        self.lag = Gauge(
            'pipeline_consumer_lag',
            'Consumer lag',
            ['topic', 'partition', 'consumer_group'],
            registry=self.registry
        )

        self.queue_depth = Gauge(
            'pipeline_queue_depth',
            'Queue depth',
            ['queue_name', 'stage'],
            registry=self.registry
        )

        self.batch_size = Histogram(
            'pipeline_batch_size',
            'Batch size distribution',
            ['stage'],
            registry=self.registry
        )

        # SLA metrics
        self.sla_violations = Counter(
            'pipeline_sla_violations_total',
            'SLA violations',
            ['sla_type', 'severity'],
            registry=self.registry
        )

    def record_message_processed(self, stage: str, source: str, status: str = "success"):
        """Record a processed message"""
        self.messages_processed.labels(stage=stage, source=source, status=status).inc()

    def record_processing_time(self, stage: str, source: str, duration: float):
        """Record processing duration"""
        self.processing_duration.labels(stage=stage, source=source).observe(duration)

    def record_error(self, stage: str, error_type: str, severity: str = "medium"):
        """Record an error"""
        self.error_rate.labels(stage=stage, error_type=error_type, severity=severity).inc()

    def update_data_quality(self, dataset: str, dimension: str, score: float):
        """Update data quality score"""
        self.data_quality_score.labels(dataset=dataset, dimension=dimension).set(score)

    def update_system_metrics(self):
        """Update system resource metrics"""
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        self.cpu_usage.labels(component="pipeline").set(cpu_percent)

        # Memory usage
        memory = psutil.virtual_memory()
        self.memory_usage.labels(component="pipeline").set(memory.used)

        # Disk usage
        for disk in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(disk.mountpoint)
                self.disk_usage.labels(mount_point=disk.mountpoint).set(usage.used)
            except:
                pass  # Skip if permission denied

    def update_lag(self, topic: str, partition: str, consumer_group: str, lag: int):
        """Update consumer lag"""
        self.lag.labels(topic=topic, partition=partition, consumer_group=consumer_group).set(lag)

    def update_queue_depth(self, queue_name: str, stage: str, depth: int):
        """Update queue depth"""
        self.queue_depth.labels(queue_name=queue_name, stage=stage).set(depth)

    def record_batch_size(self, stage: str, size: int):
        """Record batch size"""
        self.batch_size.labels(stage=stage).observe(size)

    def record_sla_violation(self, sla_type: str, severity: str = "medium"):
        """Record SLA violation"""
        self.sla_violations.labels(sla_type=sla_type, severity=severity).inc()

    def get_metrics_snapshot(self) -> Dict[str, Any]:
        """Get current metrics snapshot"""
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'prometheus_metrics': generate_latest(self.registry).decode('utf-8')
        }


class AlertManager:
    """Manages alerts and notifications"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.alerts: Dict[str, Alert] = {}
        self.metric_history = defaultdict(lambda: deque(maxlen=1000))
        self.logger = logging.getLogger(self.__class__.__name__)
        self._setup_default_alerts()

    def _setup_default_alerts(self):
        """Setup default pipeline alerts"""
        default_alerts = [
            Alert(
                id="high_error_rate",
                name="High Error Rate",
                description="Error rate exceeds 5%",
                condition="error_rate > 0.05",
                severity=AlertSeverity.CRITICAL,
                threshold=0.05,
                metric_name="pipeline_error_rate",
                comparison=">",
                window_minutes=5,
                consecutive_breaches=2
            ),
            Alert(
                id="low_throughput",
                name="Low Throughput",
                description="Message processing rate below threshold",
                condition="throughput < 100",
                severity=AlertSeverity.WARNING,
                threshold=100.0,
                metric_name="pipeline_throughput",
                comparison="<",
                window_minutes=10
            ),
            Alert(
                id="high_cpu_usage",
                name="High CPU Usage",
                description="CPU usage above 80%",
                condition="cpu_usage > 80",
                severity=AlertSeverity.WARNING,
                threshold=80.0,
                metric_name="pipeline_cpu_usage_percent",
                comparison=">",
                window_minutes=5,
                consecutive_breaches=3
            ),
            Alert(
                id="high_memory_usage",
                name="High Memory Usage",
                description="Memory usage above 90%",
                condition="memory_usage > 90",
                severity=AlertSeverity.CRITICAL,
                threshold=90.0,
                metric_name="pipeline_memory_usage_percent",
                comparison=">",
                window_minutes=5
            ),
            Alert(
                id="consumer_lag",
                name="High Consumer Lag",
                description="Consumer lag exceeds 10000 messages",
                condition="lag > 10000",
                severity=AlertSeverity.WARNING,
                threshold=10000.0,
                metric_name="pipeline_consumer_lag",
                comparison=">",
                window_minutes=5
            ),
            Alert(
                id="data_quality_drop",
                name="Data Quality Degradation",
                description="Data quality score below 80%",
                condition="data_quality_score < 0.8",
                severity=AlertSeverity.WARNING,
                threshold=0.8,
                metric_name="pipeline_data_quality_score",
                comparison="<",
                window_minutes=15
            ),
            Alert(
                id="sla_violation",
                name="SLA Violation",
                description="Processing SLA violated",
                condition="processing_time_p99 > 60",
                severity=AlertSeverity.CRITICAL,
                threshold=60.0,
                metric_name="pipeline_processing_time_p99",
                comparison=">",
                window_minutes=5
            )
        ]

        for alert in default_alerts:
            self.add_alert(alert)

    def add_alert(self, alert: Alert):
        """Add an alert rule"""
        self.alerts[alert.id] = alert
        self.logger.info(f"Added alert: {alert.name}")

    def remove_alert(self, alert_id: str):
        """Remove an alert rule"""
        if alert_id in self.alerts:
            del self.alerts[alert_id]
            self.logger.info(f"Removed alert: {alert_id}")

    def update_metric(self, metric_name: str, value: float, labels: Dict[str, str] = None):
        """Update metric value and check alerts"""
        labels = labels or {}
        metric_point = MetricPoint(
            name=metric_name,
            value=value,
            timestamp=datetime.utcnow(),
            labels=labels
        )

        self.metric_history[metric_name].append(metric_point)
        self._check_alerts(metric_name, value)

    def _check_alerts(self, metric_name: str, current_value: float):
        """Check if any alerts should trigger"""
        current_time = datetime.utcnow()

        for alert in self.alerts.values():
            if not alert.enabled or alert.metric_name != metric_name:
                continue

            # Skip if suppressed
            if alert.suppressed_until and current_time < alert.suppressed_until:
                continue

            # Check threshold
            threshold_breached = self._evaluate_threshold(current_value, alert)

            if threshold_breached:
                alert.breach_count += 1

                # Check if we need consecutive breaches
                if alert.breach_count >= alert.consecutive_breaches:
                    self._trigger_alert(alert, current_value)
                    alert.breach_count = 0  # Reset after triggering
            else:
                alert.breach_count = 0  # Reset on non-breach

    def _evaluate_threshold(self, value: float, alert: Alert) -> bool:
        """Evaluate if threshold is breached"""
        if alert.comparison == ">":
            return value > alert.threshold
        elif alert.comparison == "<":
            return value < alert.threshold
        elif alert.comparison == ">=":
            return value >= alert.threshold
        elif alert.comparison == "<=":
            return value <= alert.threshold
        elif alert.comparison == "==":
            return abs(value - alert.threshold) < 1e-6
        else:
            return False

    def _trigger_alert(self, alert: Alert, current_value: float):
        """Trigger an alert"""
        alert.last_triggered = datetime.utcnow()

        self.logger.warning(f"Alert triggered: {alert.name}")

        # Send notifications
        self._send_notifications(alert, current_value)

        # Suppress for a period to avoid spam
        if alert.severity == AlertSeverity.CRITICAL:
            alert.suppressed_until = datetime.utcnow() + timedelta(minutes=10)
        else:
            alert.suppressed_until = datetime.utcnow() + timedelta(minutes=30)

    def _send_notifications(self, alert: Alert, current_value: float):
        """Send alert notifications"""
        message = f"""
Alert: {alert.name}
Severity: {alert.severity.value.upper()}
Description: {alert.description}
Current Value: {current_value}
Threshold: {alert.threshold}
Condition: {alert.condition}
Time: {datetime.utcnow().isoformat()}

This alert will be suppressed for the next {30 if alert.severity != AlertSeverity.CRITICAL else 10} minutes.
"""

        # Send email if configured
        if 'email' in self.config.get('notifications', {}):
            self._send_email_alert(alert, message)

        # Send Slack if configured
        if 'slack' in self.config.get('notifications', {}):
            self._send_slack_alert(alert, message)

        # Send PagerDuty for critical alerts
        if alert.severity == AlertSeverity.CRITICAL and 'pagerduty' in self.config.get('notifications', {}):
            self._send_pagerduty_alert(alert, message)

    def _send_email_alert(self, alert: Alert, message: str):
        """Send email alert"""
        try:
            email_config = self.config['notifications']['email']

            msg = MIMEMultipart()
            msg['From'] = email_config['from']
            msg['To'] = ', '.join(email_config['to'])
            msg['Subject'] = f"[{alert.severity.value.upper()}] Pipeline Alert: {alert.name}"

            msg.attach(MIMEText(message, 'plain'))

            server = smtplib.SMTP(email_config['smtp_server'], email_config.get('smtp_port', 587))
            if email_config.get('use_tls', True):
                server.starttls()
            if 'username' in email_config:
                server.login(email_config['username'], email_config['password'])

            server.send_message(msg)
            server.quit()

            self.logger.info(f"Email alert sent for: {alert.name}")

        except Exception as e:
            self.logger.error(f"Failed to send email alert: {e}")

    def _send_slack_alert(self, alert: Alert, message: str):
        """Send Slack alert"""
        try:
            slack_config = self.config['notifications']['slack']

            color = {
                AlertSeverity.CRITICAL: "danger",
                AlertSeverity.WARNING: "warning",
                AlertSeverity.INFO: "good"
            }.get(alert.severity, "warning")

            payload = {
                "channel": slack_config['channel'],
                "username": "Pipeline Monitor",
                "icon_emoji": ":warning:",
                "attachments": [{
                    "color": color,
                    "title": f"{alert.severity.value.upper()}: {alert.name}",
                    "text": message,
                    "ts": time.time()
                }]
            }

            response = requests.post(
                slack_config['webhook_url'],
                json=payload,
                timeout=30
            )
            response.raise_for_status()

            self.logger.info(f"Slack alert sent for: {alert.name}")

        except Exception as e:
            self.logger.error(f"Failed to send Slack alert: {e}")

    def _send_pagerduty_alert(self, alert: Alert, message: str):
        """Send PagerDuty alert for critical issues"""
        try:
            pd_config = self.config['notifications']['pagerduty']

            payload = {
                "routing_key": pd_config['integration_key'],
                "event_action": "trigger",
                "dedup_key": f"pipeline_alert_{alert.id}",
                "payload": {
                    "summary": f"Pipeline Alert: {alert.name}",
                    "source": "reviewhub-pipeline",
                    "severity": "critical",
                    "custom_details": {
                        "alert_id": alert.id,
                        "description": alert.description,
                        "condition": alert.condition,
                        "message": message
                    }
                }
            }

            response = requests.post(
                "https://events.pagerduty.com/v2/enqueue",
                json=payload,
                timeout=30
            )
            response.raise_for_status()

            self.logger.info(f"PagerDuty alert sent for: {alert.name}")

        except Exception as e:
            self.logger.error(f"Failed to send PagerDuty alert: {e}")

    def get_active_alerts(self) -> List[Alert]:
        """Get currently active alerts"""
        current_time = datetime.utcnow()
        active_alerts = []

        for alert in self.alerts.values():
            if (alert.last_triggered and
                current_time - alert.last_triggered < timedelta(hours=1)):
                active_alerts.append(alert)

        return active_alerts

    def suppress_alert(self, alert_id: str, duration_minutes: int):
        """Suppress an alert for specified duration"""
        if alert_id in self.alerts:
            self.alerts[alert_id].suppressed_until = datetime.utcnow() + timedelta(minutes=duration_minutes)
            self.logger.info(f"Alert {alert_id} suppressed for {duration_minutes} minutes")


class HealthChecker:
    """Monitors overall pipeline health"""

    def __init__(self, metrics_collector: MetricsCollector, alert_manager: AlertManager):
        self.metrics_collector = metrics_collector
        self.alert_manager = alert_manager
        self.logger = logging.getLogger(self.__class__.__name__)

    def check_pipeline_health(self) -> PipelineHealth:
        """Check overall pipeline health"""
        current_time = datetime.utcnow()

        # Check individual stage health
        stage_status = {}
        for stage in PipelineStage:
            stage_status[stage] = self._check_stage_health(stage)

        # Determine overall status
        overall_status = self._determine_overall_status(stage_status)

        # Get active alerts
        active_alerts = self.alert_manager.get_active_alerts()

        # Calculate performance metrics
        performance_metrics = self._calculate_performance_metrics()

        # Get data quality score
        data_quality_score = self._get_data_quality_score()

        # Calculate throughput metrics
        throughput_metrics = self._calculate_throughput_metrics()

        return PipelineHealth(
            timestamp=current_time,
            overall_status=overall_status,
            stage_status=stage_status,
            active_alerts=active_alerts,
            performance_metrics=performance_metrics,
            data_quality_score=data_quality_score,
            throughput_metrics=throughput_metrics
        )

    def _check_stage_health(self, stage: PipelineStage) -> str:
        """Check health of a specific pipeline stage"""
        # This would check stage-specific metrics
        # For now, return a simple status based on alerts

        stage_alerts = [
            alert for alert in self.alert_manager.get_active_alerts()
            if stage.value.lower() in alert.tags.get('stage', '').lower()
        ]

        critical_alerts = [a for a in stage_alerts if a.severity == AlertSeverity.CRITICAL]
        warning_alerts = [a for a in stage_alerts if a.severity == AlertSeverity.WARNING]

        if critical_alerts:
            return "critical"
        elif warning_alerts:
            return "degraded"
        else:
            return "healthy"

    def _determine_overall_status(self, stage_status: Dict[PipelineStage, str]) -> str:
        """Determine overall pipeline status"""
        statuses = list(stage_status.values())

        if "critical" in statuses:
            return "critical"
        elif "degraded" in statuses:
            return "degraded"
        else:
            return "healthy"

    def _calculate_performance_metrics(self) -> Dict[str, float]:
        """Calculate performance metrics"""
        # This would calculate actual performance metrics
        # For now, return mock values
        return {
            "avg_processing_time_ms": 125.5,
            "p95_processing_time_ms": 450.2,
            "p99_processing_time_ms": 1200.8,
            "error_rate_percent": 0.15,
            "cpu_usage_percent": 45.2,
            "memory_usage_percent": 67.3
        }

    def _get_data_quality_score(self) -> float:
        """Get aggregated data quality score"""
        # This would aggregate data quality scores across all datasets
        return 0.87

    def _calculate_throughput_metrics(self) -> Dict[str, float]:
        """Calculate throughput metrics"""
        return {
            "messages_per_second": 1250.5,
            "records_processed_per_hour": 4500000,
            "avg_batch_size": 100.0,
            "queue_depth": 25
        }


class PipelineMonitor:
    """Main pipeline monitoring orchestrator"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.metrics_collector = MetricsCollector()
        self.alert_manager = AlertManager(config)
        self.health_checker = HealthChecker(self.metrics_collector, self.alert_manager)
        self.logger = logging.getLogger(self.__class__.__name__)

        self._running = False
        self._monitor_thread = None

    def start_monitoring(self):
        """Start the monitoring system"""
        if self._running:
            self.logger.warning("Monitoring already running")
            return

        self._running = True
        self._monitor_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self._monitor_thread.start()

        self.logger.info("Pipeline monitoring started")

    def stop_monitoring(self):
        """Stop the monitoring system"""
        self._running = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=10)

        self.logger.info("Pipeline monitoring stopped")

    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self._running:
            try:
                # Update system metrics
                self.metrics_collector.update_system_metrics()

                # Check pipeline health
                health = self.health_checker.check_pipeline_health()

                # Update health metrics
                self._update_health_metrics(health)

                # Sleep for monitoring interval
                time.sleep(self.config.get('monitor_interval_seconds', 30))

            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {e}")
                time.sleep(5)

    def _update_health_metrics(self, health: PipelineHealth):
        """Update metrics based on health check"""
        # Update overall health gauge
        health_score = {
            "healthy": 1.0,
            "degraded": 0.5,
            "critical": 0.0
        }.get(health.overall_status, 0.0)

        # Create health gauge if it doesn't exist
        if not hasattr(self.metrics_collector, 'pipeline_health'):
            self.metrics_collector.pipeline_health = prometheus_client.Gauge(
                'pipeline_health_status',
                'Overall pipeline health status (1=healthy, 0.5=degraded, 0=critical)',
                registry=self.metrics_collector.registry
            )

        self.metrics_collector.pipeline_health.set(health_score)

        # Update alert manager with performance metrics
        for metric_name, value in health.performance_metrics.items():
            self.alert_manager.update_metric(f"pipeline_{metric_name}", value)

        # Log health summary
        self.logger.info(
            f"Pipeline Health: {health.overall_status.upper()} | "
            f"Active Alerts: {len(health.active_alerts)} | "
            f"Data Quality: {health.data_quality_score:.2%}"
        )

    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get data for monitoring dashboard"""
        health = self.health_checker.check_pipeline_health()

        return {
            "health": asdict(health),
            "metrics_snapshot": self.metrics_collector.get_metrics_snapshot(),
            "alert_rules": {
                alert_id: {
                    'name': alert.name,
                    'severity': alert.severity.value,
                    'enabled': alert.enabled,
                    'last_triggered': alert.last_triggered.isoformat() if alert.last_triggered else None
                }
                for alert_id, alert in self.alert_manager.alerts.items()
            }
        }

    def create_custom_alert(self, alert_config: Dict[str, Any]):
        """Create a custom alert rule"""
        alert = Alert(
            id=alert_config['id'],
            name=alert_config['name'],
            description=alert_config['description'],
            condition=alert_config['condition'],
            severity=AlertSeverity(alert_config['severity']),
            threshold=float(alert_config['threshold']),
            metric_name=alert_config['metric_name'],
            comparison=alert_config['comparison'],
            window_minutes=alert_config.get('window_minutes', 5),
            consecutive_breaches=alert_config.get('consecutive_breaches', 1),
            tags=alert_config.get('tags', {})
        )

        self.alert_manager.add_alert(alert)


# Example usage and configuration
def create_monitoring_config() -> Dict[str, Any]:
    """Create example monitoring configuration"""
    return {
        "monitor_interval_seconds": 30,
        "notifications": {
            "email": {
                "smtp_server": "smtp.gmail.com",
                "smtp_port": 587,
                "use_tls": True,
                "from": "alerts@reviewhub.com",
                "to": ["ops-team@reviewhub.com"],
                "username": "alerts@reviewhub.com",
                "password": "your_password"
            },
            "slack": {
                "webhook_url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
                "channel": "#pipeline-alerts"
            },
            "pagerduty": {
                "integration_key": "your_pagerduty_integration_key"
            }
        },
        "thresholds": {
            "error_rate_percent": 5.0,
            "cpu_usage_percent": 80.0,
            "memory_usage_percent": 90.0,
            "processing_time_p99_seconds": 60.0
        }
    }


def example_usage():
    """Example of using the monitoring system"""

    # Create configuration
    config = create_monitoring_config()

    # Initialize monitor
    monitor = PipelineMonitor(config)

    # Start monitoring
    monitor.start_monitoring()

    # Simulate some pipeline metrics
    for i in range(10):
        # Record some processing
        monitor.metrics_collector.record_message_processed("ingestion", "google", "success")
        monitor.metrics_collector.record_processing_time("ingestion", "google", 0.5)

        # Simulate an error occasionally
        if i % 5 == 0:
            monitor.metrics_collector.record_error("processing", "validation_error", "medium")

        # Update data quality
        monitor.metrics_collector.update_data_quality("reviews", "completeness", 0.95)

        time.sleep(1)

    # Create a custom alert
    custom_alert_config = {
        "id": "custom_throughput",
        "name": "Custom Throughput Alert",
        "description": "Custom alert for throughput monitoring",
        "condition": "throughput < 500",
        "severity": "warning",
        "threshold": 500.0,
        "metric_name": "pipeline_custom_throughput",
        "comparison": "<",
        "window_minutes": 5,
        "tags": {"component": "custom"}
    }

    monitor.create_custom_alert(custom_alert_config)

    # Get dashboard data
    dashboard_data = monitor.get_dashboard_data()
    print(f"Pipeline Status: {dashboard_data['health']['overall_status']}")

    # Stop monitoring
    time.sleep(5)
    monitor.stop_monitoring()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    example_usage()