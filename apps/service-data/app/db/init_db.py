"""
数据库初始化脚本
"""
from loguru import logger
from app.db.database import engine, Base
from app.db.models import KLine, StockBasic  # noqa: F401


def init_db():
    """创建所有表"""
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")


def drop_db():
    """删除所有表（危险操作）"""
    logger.warning("Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    logger.warning("All tables dropped")


if __name__ == "__main__":
    init_db()
