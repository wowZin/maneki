"""
通知服务

负责向 Admin API 发送任务通知
"""
import json
import os
from typing import Dict, Any

import requests
from loguru import logger

ADMIN_API_URL = os.getenv("ADMIN_API_URL", "http://localhost:8080/api/v1")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")


def send_task_notification(title: str, content: Dict[str, Any], notification_type: str = "task") -> bool:
    """
    发送任务通知到 Admin API

    Args:
        title: 通知标题/概要
        content: 通知详情
        notification_type: 通知类型，如 task_success / task_failed

    Returns:
        是否发送成功
    """
    if not INTERNAL_API_KEY:
        logger.warning("INTERNAL_API_KEY not set, skipping notification")
        return False

    try:
        url = f"{ADMIN_API_URL}/internal/notifications"
        payload = {
            "title": title,
            "content": json.dumps(content, ensure_ascii=False),
            "type": notification_type,
        }
        headers = {
            "X-Internal-Token": INTERNAL_API_KEY,
        }

        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            logger.info(f"Notification sent: {title}")
            return True
        else:
            logger.warning(f"Failed to send notification: {response.status_code} {response.text}")
            return False
    except Exception as e:
        logger.warning(f"Failed to send notification: {e}")
        return False
