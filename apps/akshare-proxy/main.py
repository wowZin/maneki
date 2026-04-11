"""
Akshare 代理服务
为 Go 后端提供 Akshare 数据访问接口
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import akshare as ak
import uvicorn
from datetime import datetime, timedelta

app = FastAPI(title="Akshare Proxy Service", version="1.0.0")


class APIRequest(BaseModel):
    api_name: str
    params: Dict[str, Any] = {}


class APIResponse(BaseModel):
    code: int
    msg: str
    data: Any


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/kline")
def get_kline(req: APIRequest):
    """获取K线数据"""
    try:
        if req.api_name == "stock_zh_a_hist":
            symbol = req.params.get("symbol", "")
            period = req.params.get("period", "daily")
            start_date = req.params.get("start_date", "")
            end_date = req.params.get("end_date", "")

            df = ak.stock_zh_a_hist(
                symbol=symbol,
                period=period,
                start_date=start_date,
                end_date=end_date,
                adjust="qfq"  # 前复权
            )

            # 转换为前端需要的格式
            data = df.to_dict(orient="records")
            return APIResponse(code=0, msg="success", data=data)

        return APIResponse(code=1, msg=f"unknown api: {req.api_name}", data=None)

    except Exception as e:
        return APIResponse(code=1, msg=str(e), data=None)


@app.post("/api/stock/info")
def get_stock_info(req: APIRequest):
    """获取股票基本信息"""
    try:
        if req.api_name == "stock_individual_info_em":
            symbol = req.params.get("symbol", "")
            df = ak.stock_individual_info_em(symbol=symbol)

            # DataFrame 转换为 dict
            info = {}
            for _, row in df.iterrows():
                info[row["item"]] = row["value"]

            return APIResponse(code=0, msg="success", data=info)

        return APIResponse(code=1, msg=f"unknown api: {req.api_name}", data=None)

    except Exception as e:
        return APIResponse(code=1, msg=str(e), data=None)


@app.post("/api/quote/realtime")
def get_realtime_quote(req: APIRequest):
    """获取实时行情"""
    try:
        codes = req.params.get("codes", [])
        results = []

        for code in codes:
            try:
                # 使用实时行情接口
                df = ak.stock_bid_ask_em(symbol=code)
                if not df.empty:
                    results.append({
                        "code": code,
                        "price": float(df.iloc[0].get("最新价", 0)),
                        "volume": float(df.iloc[0].get("成交量", 0)),
                        "time": datetime.now().isoformat(),
                        "source": "akshare"
                    })
            except Exception:
                continue

        return APIResponse(code=0, msg="success", data=results)

    except Exception as e:
        return APIResponse(code=1, msg=str(e), data=None)


@app.get("/api/stock/list")
def get_stock_list():
    """获取股票列表"""
    try:
        df = ak.stock_zh_a_spot_em()
        data = df[["代码", "名称"]].to_dict(orient="records")
        return APIResponse(code=0, msg="success", data=data)
    except Exception as e:
        return APIResponse(code=1, msg=str(e), data=None)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
