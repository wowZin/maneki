"""
K线服务测试
"""
import pytest
from datetime import datetime, timedelta

from app.services.kline_service import format_code, get_kline


def test_format_code_tushare():
    """测试 Tushare 代码格式化"""
    assert format_code("000001", "tushare") == "000001.SZ"
    assert format_code("600000", "tushare") == "600000.SH"


def test_format_code_akshare():
    """测试 Akshare 代码格式化"""
    assert format_code("000001", "akshare") == "000001"
    assert format_code("600000", "akshare") == "600000"


@pytest.mark.asyncio
async def test_get_kline_with_akshare():
    """测试从 Akshare 获取 K线（不依赖 token）"""
    result = get_kline("000001", days=5, source="akshare")
    
    assert "code" in result
    assert "data" in result
    assert "source" in result
    assert result["source"] == "akshare"
    
    if result["code"] == 0:
        assert isinstance(result["data"], list)
        if result["data"]:
            item = result["data"][0]
            assert "date" in item
            assert "open" in item
            assert "high" in item
            assert "low" in item
            assert "close" in item
            assert "volume" in item
