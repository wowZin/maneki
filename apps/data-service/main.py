"""
数据服务
统一数据获取服务，支持 Tushare Pro 和 Akshare 双数据源
"""

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import os
import akshare as ak
import tushare as ts
import pandas as pd
import uvicorn

from config import get_settings

settings = get_settings()

app = FastAPI(
    title="Maneki Data Service",
    description="统一数据获取服务 - 支持 Tushare Pro 和 Akshare",
    version="1.0.0"
)

# 初始化 Tushare Pro
tushare_pro = None
if settings.TUSHARE_TOKEN and settings.TUSHARE_ENABLED:
    try:
        ts.set_token(settings.TUSHARE_TOKEN)
        tushare_pro = ts.pro_api()
        print(f"✅ Tushare Pro 已初始化")
    except Exception as e:
        print(f"⚠️ Tushare Pro 初始化失败: {e}")


class APIRequest(BaseModel):
    """通用API请求"""
    api_name: str
    params: Dict[str, Any] = {}


class KLineRequest(BaseModel):
    """K线数据请求"""
    code: str  # 股票代码，如 "000001"
    days: int = 30  # 获取天数
    source: str = "auto"  # 数据源: tushare | akshare | auto


class QuoteRequest(BaseModel):
    """实时行情请求"""
    codes: List[str]  # 股票代码列表
    source: str = "auto"


class APIResponse(BaseModel):
    """通用API响应"""
    code: int
    msg: str
    data: Any
    source: str = ""  # 实际使用的数据源


# ============ 工具函数 ============

def get_data_source(user_source: str = "auto") -> str:
    """确定实际使用的数据源"""
    if user_source == "tushare":
        return "tushare" if tushare_pro else "akshare"
    elif user_source == "akshare":
        return "akshare"
    else:  # auto
        # 优先使用 Tushare Pro（数据质量更好）
        return "tushare" if tushare_pro else "akshare"


def to_ts_code(code: str) -> str:
    """转换为 Tushare 代码格式 (000001.SZ)"""
    if "." in code:
        return code
    if len(code) >= 1:
        if code[0] in ['0', '3']:
            return f"{code}.SZ"
        elif code[0] == '6':
            return f"{code}.SH"
    return code


def format_kline_data(df: pd.DataFrame, source: str, code: str) -> List[Dict]:
    """统一K线数据格式"""
    results = []

    for _, row in df.iterrows():
        if source == "tushare":
            # Tushare 列名
            results.append({
                "code": code,
                "date": row.get("trade_date", ""),
                "open": float(row.get("open", 0)),
                "high": float(row.get("high", 0)),
                "low": float(row.get("low", 0)),
                "close": float(row.get("close", 0)),
                "volume": float(row.get("vol", 0)),
                "amount": float(row.get("amount", 0)),
                "source": "tushare"
            })
        else:
            # Akshare 列名（中文）
            results.append({
                "code": code,
                "date": row.get("日期", ""),
                "open": float(row.get("开盘", 0)),
                "high": float(row.get("最高", 0)),
                "low": float(row.get("最低", 0)),
                "close": float(row.get("收盘", 0)),
                "volume": float(row.get("成交量", 0)),
                "amount": float(row.get("成交额", 0)),
                "source": "akshare"
            })

    return results


# ============ 健康检查 ============

@app.get("/health")
def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "service": "data-service",
        "version": "1.0.0",
        "sources": {
            "tushare": tushare_pro is not None,
            "akshare": True
        }
    }


@app.get("/api/sources")
def get_available_sources():
    """获取可用数据源"""
    return {
        "tushare": {
            "available": tushare_pro is not None,
            "description": "Tushare Pro - 付费数据源，数据质量高，实时"
        },
        "akshare": {
            "available": True,
            "description": "Akshare - 免费数据源，3秒延迟"
        }
    }


# ============ K线数据 ============

@app.post("/api/kline", response_model=APIResponse)
def get_kline(req: KLineRequest):
    """
    获取K线数据

    - code: 股票代码，如 "000001"
    - days: 获取天数，默认30天
    - source: 数据源，可选 tushare | akshare | auto（默认）
    """
    try:
        source = get_data_source(req.source)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=req.days)

        if source == "tushare" and tushare_pro:
            # 使用 Tushare Pro
            ts_code = to_ts_code(req.code)
            df = tushare_pro.daily(
                ts_code=ts_code,
                start_date=start_date.strftime("%Y%m%d"),
                end_date=end_date.strftime("%Y%m%d")
            )

            if df is None or df.empty:
                return APIResponse(code=1, msg="no data", data=[], source=source)

            # 按日期降序排列
            df = df.sort_values('trade_date', ascending=False)
            data = format_kline_data(df, source, req.code)

        else:
            # 使用 Akshare
            df = ak.stock_zh_a_hist(
                symbol=req.code,
                period="daily",
                start_date=start_date.strftime("%Y%m%d"),
                end_date=end_date.strftime("%Y%m%d"),
                adjust="qfq"
            )

            if df is None or df.empty:
                return APIResponse(code=1, msg="no data", data=[], source="akshare")

            # 按日期降序排列
            df = df.sort_values('日期', ascending=False)
            data = format_kline_data(df, "akshare", req.code)
            source = "akshare"

        return APIResponse(code=0, msg="success", data=data, source=source)

    except Exception as e:
        return APIResponse(code=1, msg=str(e), data=[], source="")


# ============ 股票基本信息 ============

@app.post("/api/stock/info", response_model=APIResponse)
def get_stock_info(req: APIRequest):
    """获取股票基本信息"""
    try:
        source = get_data_source("auto")
        symbol = req.params.get("symbol", "")

        if source == "tushare" and tushare_pro:
            # Tushare Pro
            ts_code = to_ts_code(symbol)
            df = tushare_pro.stock_basic(ts_code=ts_code)

            if df is None or df.empty:
                return APIResponse(code=1, msg="stock not found", data=None, source=source)

            row = df.iloc[0]
            data = {
                "code": symbol,
                "name": row.get("name", ""),
                "industry": row.get("industry", ""),
                "area": row.get("area", ""),
                "list_date": row.get("list_date", ""),
                "source": "tushare"
            }
        else:
            # Akshare
            df = ak.stock_individual_info_em(symbol=symbol)

            info = {}
            for _, row in df.iterrows():
                info[row["item"]] = row["value"]

            data = {
                "code": symbol,
                "name": info.get("股票简称", ""),
                "industry": info.get("行业", ""),
                "source": "akshare"
            }
            source = "akshare"

        return APIResponse(code=0, msg="success", data=data, source=source)

    except Exception as e:
        return APIResponse(code=1, msg=str(e), data=None, source="")


# ============ 实时行情 ============

@app.post("/api/quote/realtime", response_model=APIResponse)
def get_realtime_quote(req: QuoteRequest):
    """
    获取实时行情

    - codes: 股票代码列表
    - source: 数据源
    """
    try:
        source = get_data_source(req.source)
        results = []

        if source == "tushare" and tushare_pro:
            # Tushare Pro 没有免费实时行情接口，使用最新日K线模拟
            for code in req.codes:
                try:
                    ts_code = to_ts_code(code)
                    df = tushare_pro.daily(ts_code=ts_code, limit=1)

                    if df is not None and not df.empty:
                        row = df.iloc[0]
                        results.append({
                            "code": code,
                            "price": float(row.get("close", 0)),
                            "open": float(row.get("open", 0)),
                            "high": float(row.get("high", 0)),
                            "low": float(row.get("low", 0)),
                            "volume": float(row.get("vol", 0)),
                            "amount": float(row.get("amount", 0)),
                            "time": datetime.now().isoformat(),
                            "source": "tushare"
                        })
                except Exception:
                    continue
        else:
            # 使用 Akshare 获取实时行情
            for code in req.codes:
                try:
                    # 获取个股信息
                    df = ak.stock_bid_ask_em(symbol=code)
                    if df is not None and not df.empty:
                        row = df.iloc[0]
                        results.append({
                            "code": code,
                            "price": float(row.get("最新价", 0)),
                            "change": float(row.get("涨跌额", 0)),
                            "change_pct": float(row.get("涨跌幅", 0)),
                            "volume": float(row.get("成交量", 0)),
                            "amount": float(row.get("成交额", 0)),
                            "bid": float(row.get("买一", 0)),
                            "ask": float(row.get("卖一", 0)),
                            "time": datetime.now().isoformat(),
                            "source": "akshare"
                        })
                except Exception:
                    continue
            source = "akshare"

        return APIResponse(code=0, msg="success", data=results, source=source)

    except Exception as e:
        return APIResponse(code=1, msg=str(e), data=[], source="")


# ============ 股票列表 ============

@app.get("/api/stock/list", response_model=APIResponse)
def get_stock_list(
    source: str = Query("auto", description="数据源: tushare | akshare | auto")
):
    """获取股票列表"""
    try:
        use_source = get_data_source(source)

        if use_source == "tushare" and tushare_pro:
            df = tushare_pro.stock_basic(exchange='', list_status='L')
            data = df[["ts_code", "symbol", "name", "industry", "area"]].to_dict(orient="records")
        else:
            df = ak.stock_zh_a_spot_em()
            data = df[["代码", "名称"]].rename(columns={"代码": "symbol", "名称": "name"}).to_dict(orient="records")
            use_source = "akshare"

        return APIResponse(code=0, msg="success", data=data, source=use_source)

    except Exception as e:
        return APIResponse(code=1, msg=str(e), data=[], source="")


# ============ 批量同步接口 ============

@app.post("/api/sync/batch", response_model=APIResponse)
def batch_sync(req: APIRequest):
    """
    批量同步股票数据（供定时任务调用）

    参数:
    - codes: 股票代码列表
    - days: 同步天数，默认14天
    """
    try:
        codes = req.params.get("codes", [])
        days = req.params.get("days", 14)
        source = get_data_source("auto")

        results = []
        for code in codes:
            try:
                # 调用 K线接口获取数据
                kline_req = KLineRequest(code=code, days=days, source=source)
                resp = get_kline(kline_req)

                if resp.code == 0:
                    results.append({
                        "code": code,
                        "status": "success",
                        "count": len(resp.data)
                    })
                else:
                    results.append({
                        "code": code,
                        "status": "failed",
                        "error": resp.msg
                    })
            except Exception as e:
                results.append({
                    "code": code,
                    "status": "failed",
                    "error": str(e)
                })

        return APIResponse(code=0, msg="sync completed", data=results, source=source)

    except Exception as e:
        return APIResponse(code=1, msg=str(e), data=[], source="")


if __name__ == "__main__":
    print(f"🚀 启动 {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"📊 数据源策略: {settings.DATA_SOURCE_STRATEGY}")
    print(f"🔑 Tushare Pro: {'已启用' if tushare_pro else '未启用'}")
    print(f"🌐 服务地址: http://0.0.0.0:{settings.PORT}")

    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)
