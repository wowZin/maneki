"""
OSS 对象存储服务

用于上传离线数据到云端存储
支持阿里云 OSS
"""
import os
from typing import Optional
from loguru import logger

from app.core import settings


# 全局 OSS 客户端
_oss_client = None
_oss_bucket = None


def init_oss_client():
    """初始化 OSS 客户端"""
    global _oss_client, _oss_bucket
    
    # 检查配置
    if not all([
        settings.OSS_ENDPOINT,
        settings.OSS_ACCESS_KEY,
        settings.OSS_SECRET_KEY
    ]):
        logger.warning("OSS configuration incomplete, OSS upload disabled")
        return None
    
    try:
        import oss2
        
        # 创建认证
        auth = oss2.Auth(
            settings.OSS_ACCESS_KEY,
            settings.OSS_SECRET_KEY
        )
        
        # 创建 Bucket 实例
        _oss_client = oss2.Bucket(
            auth,
            settings.OSS_ENDPOINT,
            settings.OSS_BUCKET
        )
        
        # 测试连接
        _oss_client.get_bucket_info()
        
        logger.info(f"OSS client initialized: {settings.OSS_BUCKET}@{settings.OSS_ENDPOINT}")
        return _oss_client
    
    except ImportError:
        logger.warning("oss2 not installed, OSS upload disabled")
        return None
    except Exception as e:
        logger.error(f"Failed to initialize OSS client: {e}")
        return None


def get_oss_client():
    """获取 OSS 客户端（延迟初始化）"""
    global _oss_client
    if _oss_client is None:
        _oss_client = init_oss_client()
    return _oss_client


def upload_to_oss(
    local_path: str,
    oss_key: str,
    content_type: str = "application/json"
) -> bool:
    """
    上传文件到 OSS
    
    Args:
        local_path: 本地文件路径
        oss_key: OSS 对象键（如 "news/20240101.json"）
        content_type: 文件类型
    
    Returns:
        是否上传成功
    """
    client = get_oss_client()
    if not client:
        logger.debug("OSS client not available, skip upload")
        return False
    
    if not os.path.exists(local_path):
        logger.warning(f"Local file not found: {local_path}")
        return False
    
    try:
        # 上传文件
        with open(local_path, 'rb') as f:
            client.put_object(
                oss_key,
                f,
                headers={'Content-Type': content_type}
            )
        
        logger.info(f"Uploaded to OSS: {local_path} -> {oss_key}")
        return True
    
    except Exception as e:
        logger.error(f"Failed to upload to OSS: {e}")
        return False


def download_from_oss(
    oss_key: str,
    local_path: str
) -> bool:
    """
    从 OSS 下载文件
    
    Args:
        oss_key: OSS 对象键
        local_path: 本地保存路径
    
    Returns:
        是否下载成功
    """
    client = get_oss_client()
    if not client:
        logger.debug("OSS client not available, skip download")
        return False
    
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        # 下载文件
        client.get_object_to_file(oss_key, local_path)
        
        logger.info(f"Downloaded from OSS: {oss_key} -> {local_path}")
        return True
    
    except Exception as e:
        logger.error(f"Failed to download from OSS: {e}")
        return False


def list_oss_objects(prefix: str = "") -> list:
    """
    列出 OSS 对象
    
    Args:
        prefix: 前缀过滤
    
    Returns:
        对象键列表
    """
    client = get_oss_client()
    if not client:
        return []
    
    try:
        objects = []
        for obj in oss2.ObjectIterator(client, prefix=prefix):
            objects.append(obj.key)
        return objects
    except Exception as e:
        logger.error(f"Failed to list OSS objects: {e}")
        return []


def delete_oss_object(oss_key: str) -> bool:
    """
    删除 OSS 对象
    
    Args:
        oss_key: OSS 对象键
    
    Returns:
        是否删除成功
    """
    client = get_oss_client()
    if not client:
        return False
    
    try:
        client.delete_object(oss_key)
        logger.info(f"Deleted from OSS: {oss_key}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete OSS object: {e}")
        return False
