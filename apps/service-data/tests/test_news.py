"""
新闻服务测试
"""
import pytest
import os
import json
from datetime import datetime

from app.services.news_service import (
    save_to_offline_storage,
    load_from_offline_storage,
    calculate_sentiment_score,
    get_major_news,
    get_sentiment_data
)
from app.core import settings


def test_calculate_sentiment_score():
    """测试情绪分数计算"""
    assert calculate_sentiment_score(100, 0) == 100.0
    assert calculate_sentiment_score(0, 100) == 0.0
    assert calculate_sentiment_score(50, 50) == 50.0
    assert calculate_sentiment_score(0, 0) == 50.0


def test_offline_storage():
    """测试离线存储功能"""
    # 准备测试数据
    test_data = {
        "news": [{"title": "Test News", "content": "Test Content"}],
        "timestamp": datetime.now().isoformat()
    }
    test_date = "20240101"
    
    # 保存
    result = save_to_offline_storage(test_data, "news", test_date)
    assert result is True
    
    # 读取
    loaded = load_from_offline_storage("news", test_date)
    assert loaded is not None
    assert loaded["news"][0]["title"] == "Test News"
    
    # 清理
    filepath = os.path.join(settings.LOCAL_STORAGE_PATH, "news", f"{test_date}.json")
    if os.path.exists(filepath):
        os.remove(filepath)


@pytest.mark.asyncio
async def test_get_major_news():
    """测试获取重大新闻（从 Akshare）"""
    news = get_major_news()
    
    # 验证返回格式
    assert isinstance(news, list)
    
    if news:  # 如果有数据
        item = news[0]
        assert "title" in item
        assert "content" in item
        assert "datetime" in item


def test_get_sentiment_data():
    """测试获取情绪数据"""
    sentiment = get_sentiment_data()
    
    # 验证返回格式
    assert "sentiment_score" in sentiment
    assert "limit_up_count" in sentiment
    assert "limit_down_count" in sentiment
    assert 0 <= sentiment["sentiment_score"] <= 100
