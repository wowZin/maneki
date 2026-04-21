#!/usr/bin/env python3
"""
龙虎榜数据诊断脚本
在 service-data 容器内运行，检查 Tushare API 返回和 DB 数据

用法:
    cd /app
    python scripts/diagnose_toplist.py
"""
import sys
sys.path.insert(0, "/app")

from app.services.data_source import init_data_sources, get_tushare_pro
from app.services.toplist_service import get_top_list, get_latest_trade_date
from app.services.toplist_sync_service import sync_top_list_to_db, get_top_list_stats
from app.db.database import get_db_session
from app.db.models import TopList
from sqlalchemy import func

print("=" * 60)
print("1. 初始化数据源...")
init_data_sources()
pro = get_tushare_pro()
if not pro:
    print("[ERROR] Tushare Pro 未初始化，请检查 TUSHARE_TOKEN 环境变量")
    sys.exit(1)
print("[OK] Tushare Pro 已初始化")

print()
print("=" * 60)
print("2. 测试 Tushare trade_cal 接口（获取最近交易日）...")
try:
    latest = get_latest_trade_date()
    print(f"[OK] 最近交易日: {latest}")
except Exception as e:
    print(f"[ERROR] 获取最近交易日失败: {e}")

print()
print("=" * 60)
print("3. 测试 Tushare top_list 接口...")
try:
    data = get_top_list()
    print(f"[OK] 获取到 {len(data)} 条龙虎榜数据")
    if data:
        print("样例数据:")
        for k, v in data[0].items():
            print(f"  {k}: {v}")
    else:
        print("[WARN] 返回空列表，可能原因：")
        print("  - 当日无龙虎榜数据")
        print("  - Tushare 积分不足（top_list 通常需要 120 积分以上）")
        print("  - token 权限受限")
except Exception as e:
    print(f"[ERROR] 获取龙虎榜数据失败: {e}")

print()
print("=" * 60)
print("4. 测试 DB 连接与 top_list 表...")
try:
    with get_db_session() as db:
        count = db.query(func.count(TopList.id)).scalar()
        print(f"[OK] DB 连接正常，top_list 表共有 {count} 条记录")

        latest_records = db.query(TopList).order_by(TopList.trade_date.desc()).limit(5).all()
        if latest_records:
            print("最近 5 条记录:")
            for r in latest_records:
                print(f"  {r.trade_date} | {r.ts_code} | {r.name} | amount={r.amount}")
        else:
            print("[WARN] top_list 表为空")
except Exception as e:
    print(f"[ERROR] DB 查询失败: {e}")

print()
print("=" * 60)
print("5. 测试完整同步流程（写入 DB）...")
try:
    result = sync_top_list_to_db()
    print(f"[OK] 同步结果: {result}")
except Exception as e:
    print(f"[ERROR] 同步失败: {e}")

print()
print("=" * 60)
print("6. 同步后统计...")
try:
    stats = get_top_list_stats()
    print(f"[OK] 统计: {stats}")
except Exception as e:
    print(f"[ERROR] 统计失败: {e}")

print()
print("=" * 60)
print("诊断完成")
