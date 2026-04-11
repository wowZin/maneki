"""
数据库初始化脚本
创建表、TimescaleDB hypertable、索引和 TTL 策略
"""

import asyncio
from app.db.session import engine
from app.db.base import Base
from app.models import (
    Stock,
    KLine1Min,
    KLine5Min,
    KLine1Day,
    Indicator,
    Signal,
    AgentDecision,
    ReplayResult,
    AgentLearning,
)


async def init_timescaledb():
    """初始化 TimescaleDB 扩展和时序表"""
    from sqlalchemy import text

    async with engine.begin() as conn:
        # 启用 TimescaleDB 扩展
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb;"))
        print("✓ TimescaleDB 扩展已启用")

        # 创建标准表
        await conn.run_sync(Base.metadata.create_all)
        print("✓ 标准表已创建")

        # 创建 TimescaleDB hypertable（时序表）
        hypertables = [
            ("kline_1min", "time", "1 day"),
            ("kline_5min", "time", "1 day"),
            ("kline_1d", "time", "1 month"),
            ("indicators", "time", "1 day"),
        ]

        for table, time_column, chunk_interval in hypertables:
            try:
                # 检查是否已经是 hypertable
                result = await conn.execute(
                    text(f"SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = '{table}';")
                )
                if not result.fetchone():
                    await conn.execute(
                        text(f"SELECT create_hypertable('{table}', '{time_column}', chunk_time_interval => INTERVAL '{chunk_interval}', if_not_exists => TRUE);")
                    )
                    print(f"✓ {table} 已转换为 hypertable（分区间隔: {chunk_interval}）")
                else:
                    print(f"✓ {table} 已经是 hypertable")
            except Exception as e:
                print(f"⚠ {table} hypertable 创建失败（可能已存在）: {e}")

        # 创建数据保留策略（14天 TTL）
        retention_policies = [
            ("kline_1min", "14 days"),
            ("indicators", "14 days"),
        ]

        for table, retention in retention_policies:
            try:
                # 先尝试删除已存在的策略
                await conn.execute(
                    text(f"SELECT remove_retention_policy('{table}', if_exists => true);")
                )
                # 创建新策略
                await conn.execute(
                    text(f"SELECT add_retention_policy('{table}', INTERVAL '{retention}');")
                )
                print(f"✓ {table} 保留策略已设置: {retention}")
            except Exception as e:
                print(f"⚠ {table} 保留策略设置失败: {e}")

        # 创建压缩策略（可选，节省存储）
        compression_policies = [
            ("kline_1min", "7 days"),
            ("indicators", "7 days"),
        ]

        for table, after in compression_policies:
            try:
                await conn.execute(
                    text(f"ALTER TABLE {table} SET (timescaledb.compress);")
                )
                await conn.execute(
                    text(f"SELECT add_compression_policy('{table}', INTERVAL '{after}');")
                )
                print(f"✓ {table} 压缩策略已设置: {after}后压缩")
            except Exception as e:
                print(f"⚠ {table} 压缩策略设置失败（可能已存在）: {e}")

        print("\n✅ 数据库初始化完成！")


async def drop_all_tables():
    """删除所有表（危险操作，仅用于开发）"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        print("✓ 所有表已删除")


if __name__ == "__main__":
    print("开始初始化数据库...")
    print("=" * 50)
    asyncio.run(init_timescaledb())
