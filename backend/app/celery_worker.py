from celery import Celery
import os

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", 6379)
REDIS_DB_BROKER = os.getenv("REDIS_DB_BROKER", 0)
REDIS_DB_BACKEND = os.getenv("REDIS_DB_BACKEND", 1)
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

# ใส่ password ด้วยรูปแบบ redis://:password@host:port/db
celery_app = Celery(
    "worker",
    broker=f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB_BROKER}",
    backend=f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB_BACKEND}",
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Bangkok",
    enable_utc=True,
    task_soft_time_limit=300,
    task_time_limit=320,
    worker_max_tasks_per_child=150,
)

celery_app.autodiscover_tasks([
    "app.celery_task",
])

celery_app.conf.include = [
    "app.celery_task.customers",
    "app.celery_task.messages",
    "app.celery_task.auto_sync_tasks",
    "app.celery_task.message_sender",
    "app.celery_task.customer_tasks",
    "app.celery_task.classification",
    "app.celery_task.mining_tasks",
    "app.celery_task.webhook_task",
    "app.celery_task.page_tasks",
    "app.celery_task.pages_admin",
    "app.celery_task.groups_task",
]