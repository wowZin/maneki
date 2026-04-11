-- 股票分析智能应用 - 数据库初始化脚本
-- 适用于 TimescaleDB / PostgreSQL
-- 执行时机：容器首次启动时自动执行

-- ============================================
-- 1. 启用 TimescaleDB 扩展
-- ============================================
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================
-- 2. 股票基础信息表
-- ============================================
CREATE TABLE IF NOT EXISTS stocks (
    code VARCHAR(20) PRIMARY KEY,           -- 股票代码，如 000001.SZ
    name VARCHAR(100) NOT NULL,             -- 股票名称
    market VARCHAR(10) NOT NULL,            -- 市场：SH(上海)/SZ(深圳)/BJ(北京)
    industry VARCHAR(50),                   -- 所属行业
    list_date DATE,                         -- 上市日期
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE stocks IS '股票基础信息表';

-- ============================================
-- 3. 1分钟K线数据表 (TimescaleDB Hypertable)
-- ============================================
CREATE TABLE IF NOT EXISTS kline_1min (
    time TIMESTAMPTZ NOT NULL,              -- 时间戳
    code VARCHAR(20) NOT NULL,              -- 股票代码
    open DECIMAL(10,4) NOT NULL,            -- 开盘价
    high DECIMAL(10,4) NOT NULL,            -- 最高价
    low DECIMAL(10,4) NOT NULL,             -- 最低价
    close DECIMAL(10,4) NOT NULL,           -- 收盘价
    volume BIGINT NOT NULL,                 -- 成交量（股）
    amount DECIMAL(15,2) NOT NULL,          -- 成交金额（元）
    PRIMARY KEY (time, code)
);

-- 转换为时序表（自动分区，按天分区）
SELECT create_hypertable('kline_1min', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_kline_code ON kline_1min (code, time DESC);

COMMENT ON TABLE kline_1min IS '1分钟K线数据';

-- ============================================
-- 4. 5分钟K线数据表 (连续聚合)
-- ============================================
CREATE TABLE IF NOT EXISTS kline_5min (
    time TIMESTAMPTZ NOT NULL,
    code VARCHAR(20) NOT NULL,
    open DECIMAL(10,4) NOT NULL,
    high DECIMAL(10,4) NOT NULL,
    low DECIMAL(10,4) NOT NULL,
    close DECIMAL(10,4) NOT NULL,
    volume BIGINT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    PRIMARY KEY (time, code)
);

SELECT create_hypertable('kline_5min', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_kline_5min_code ON kline_5min (code, time DESC);

-- ============================================
-- 5. 日线数据表
-- ============================================
CREATE TABLE IF NOT EXISTS kline_1d (
    time TIMESTAMPTZ NOT NULL,
    code VARCHAR(20) NOT NULL,
    open DECIMAL(10,4) NOT NULL,
    high DECIMAL(10,4) NOT NULL,
    low DECIMAL(10,4) NOT NULL,
    close DECIMAL(10,4) NOT NULL,
    volume BIGINT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    change_pct DECIMAL(6,2),                -- 涨跌幅 %
    PRIMARY KEY (time, code)
);

SELECT create_hypertable('kline_1d', 'time', chunk_time_interval => INTERVAL '1 month', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_kline_1d_code ON kline_1d (code, time DESC);

COMMENT ON TABLE kline_1d IS '日K线数据';

-- ============================================
-- 6. 实时指标数据表
-- ============================================
CREATE TABLE IF NOT EXISTS indicators (
    time TIMESTAMPTZ NOT NULL,
    code VARCHAR(20) NOT NULL,
    ma5 DECIMAL(10,4),                      -- 5日均线
    ma10 DECIMAL(10,4),                     -- 10日均线
    ma20 DECIMAL(10,4),                     -- 20日均线
    macd_dif DECIMAL(10,4),                 -- MACD DIF
    macd_dea DECIMAL(10,4),                 -- MACD DEA
    macd_hist DECIMAL(10,4),                -- MACD 柱状图
    kdj_k DECIMAL(6,2),                     -- KDJ K值
    kdj_d DECIMAL(6,2),                     -- KDJ D值
    kdj_j DECIMAL(6,2),                     -- KDJ J值
    rsi6 DECIMAL(6,2),                      -- RSI 6
    rsi12 DECIMAL(6,2),                     -- RSI 12
    rsi24 DECIMAL(6,2),                     -- RSI 24
    volume_ma5 BIGINT,                      -- 成交量5日均值
    PRIMARY KEY (time, code)
);

SELECT create_hypertable('indicators', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_indicators_code ON indicators (code, time DESC);

COMMENT ON TABLE indicators IS '技术指标数据（分钟级）';

-- ============================================
-- 7. 交易信号表
-- ============================================
CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),   -- 信号生成时间
    code VARCHAR(20) NOT NULL,              -- 股票代码
    signal_type VARCHAR(20) NOT NULL,       -- 信号类型：buy/sell/watch/alert
    confidence DECIMAL(3,2) NOT NULL,       -- 置信度 0.00-1.00
    trigger_price DECIMAL(10,4),            -- 触发价格
    reason TEXT,                            -- 信号原因描述
    agents_votes JSONB,                     -- 各Agent投票详情
    metadata JSONB,                         -- 额外元数据
    is_valid BOOLEAN DEFAULT TRUE,          -- 是否有效（用于复盘时标记）
    FOREIGN KEY (code) REFERENCES stocks(code)
);

CREATE INDEX IF NOT EXISTS idx_signals_code ON signals (code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_type ON signals (signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_date ON signals (DATE(created_at));

COMMENT ON TABLE signals IS '交易信号记录表';

-- ============================================
-- 8. Agent决策记录表
-- ============================================
CREATE TABLE IF NOT EXISTS agent_decisions (
    id SERIAL PRIMARY KEY,
    signal_id INT REFERENCES signals(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    agent_type VARCHAR(30) NOT NULL,        -- Agent类型：technical/fundamental/sentiment/capital/decision
    decision VARCHAR(10) NOT NULL,          -- 决策：buy/sell/hold
    score DECIMAL(3,2),                     -- 评分 0-1
    reasoning TEXT,                         -- 决策理由
    weight DECIMAL(3,2) DEFAULT 1.0         -- 权重
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_signal ON agent_decisions (signal_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_type ON agent_decisions (agent_type, created_at DESC);

COMMENT ON TABLE agent_decisions IS 'Agent决策详情表';

-- ============================================
-- 9. 复盘结果表
-- ============================================
CREATE TABLE IF NOT EXISTS replay_results (
    id SERIAL PRIMARY KEY,
    trade_date DATE NOT NULL,               -- 交易日期
    signal_id INT REFERENCES signals(id),
    code VARCHAR(20) NOT NULL,

    -- 决策时信息
    entry_price DECIMAL(10,4),              -- 决策时价格
    target_price DECIMAL(10,4),             -- 目标价
    stop_loss_price DECIMAL(10,4),          -- 止损价

    -- 实际结果
    max_price DECIMAL(10,4),                -- 日内最高价
    min_price DECIMAL(10,4),                -- 日内最低价
    close_price DECIMAL(10,4),              -- 收盘价

    -- 收益计算
    max_return_pct DECIMAL(6,2),            -- 最大收益 %
    actual_return_pct DECIMAL(6,2),         -- 实际收益 %

    -- 成功判定
    success BOOLEAN,                        -- 是否成功（达到目标或涨停）
    success_type VARCHAR(20),               -- 成功类型：limit_up/target_reached/time_exit

    -- 失败分析
    failure_reason VARCHAR(50),             -- 失败原因：fake_breakout/reverse/black_swan/other
    failure_analysis TEXT,                  -- 详细分析

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replay_date ON replay_results (trade_date);
CREATE INDEX IF NOT EXISTS idx_replay_code ON replay_results (code, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_replay_success ON replay_results (success, trade_date);

COMMENT ON TABLE replay_results IS '每日复盘结果表';

-- ============================================
-- 10. Agent 学习记录表
-- ============================================
CREATE TABLE IF NOT EXISTS agent_learning (
    id SERIAL PRIMARY KEY,
    trade_date DATE NOT NULL,
    agent_type VARCHAR(30) NOT NULL,

    -- 当日统计
    total_signals INT DEFAULT 0,            -- 总信号数
    success_count INT DEFAULT 0,            -- 成功数
    failure_count INT DEFAULT 0,            -- 失败数
    success_rate DECIMAL(5,2),              -- 成功率 %

    -- 权重调整
    old_weight DECIMAL(3,2),                -- 调整前权重
    new_weight DECIMAL(3,2),                -- 调整后权重
    adjustment_reason TEXT,                 -- 调整原因

    -- 参数调整（JSON格式存储）
    params_adjustment JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_learning_date ON agent_learning (trade_date);
CREATE INDEX IF NOT EXISTS idx_agent_learning_type ON agent_learning (agent_type, trade_date DESC);

COMMENT ON TABLE agent_learning IS 'Agent学习与优化记录表';

-- ============================================
-- 11. 系统配置表
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认配置
INSERT INTO system_config (key, value, description) VALUES
    ('monitor_stock_count', '500', '监控股票数量'),
    ('signal_threshold', '0.75', '信号置信度阈值'),
    ('data_collection_interval', '5', '数据采集间隔（秒）'),
    ('replay_time', '15:30', '每日复盘时间')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 12. 数据压缩策略（对历史数据进行压缩，节省空间）
-- ============================================

-- 1分钟K线：7天前的数据启用压缩
ALTER TABLE kline_1min SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'code',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('kline_1min', INTERVAL '7 days');

-- 指标数据：7天前压缩
ALTER TABLE indicators SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'code',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('indicators', INTERVAL '7 days');

-- ============================================
-- 13. 连续聚合策略（自动预计算日K线）
-- ============================================

-- 创建日K线连续聚合视图
CREATE MATERIALIZED VIEW IF NOT EXISTS kline_1d_continuous
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    code,
    first(open, time) as open,
    max(high) as high,
    min(low) as low,
    last(close, time) as close,
    sum(volume) as volume,
    sum(amount) as amount
FROM kline_1min
GROUP BY bucket, code
WITH NO DATA;

-- 添加刷新策略（收盘后刷新）
SELECT add_continuous_aggregate_policy('kline_1d_continuous',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- ============================================
-- 14. 创建辅助函数
-- ============================================

-- 获取某只股票的最新K线数据
CREATE OR REPLACE FUNCTION get_latest_kline(p_code VARCHAR, p_limit INT DEFAULT 100)
RETURNS TABLE (
    time TIMESTAMPTZ,
    code VARCHAR,
    open DECIMAL,
    high DECIMAL,
    low DECIMAL,
    close DECIMAL,
    volume BIGINT,
    amount DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT k.time, k.code, k.open, k.high, k.low, k.close, k.volume, k.amount
    FROM kline_1min k
    WHERE k.code = p_code
    ORDER BY k.time DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 计算某日期范围内的成功率
CREATE OR REPLACE FUNCTION get_success_rate(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    total_signals BIGINT,
    success_count BIGINT,
    success_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_signals,
        COUNT(*) FILTER (WHERE r.success = TRUE) as success_count,
        ROUND(COUNT(*) FILTER (WHERE r.success = TRUE) * 100.0 / NULLIF(COUNT(*), 0), 2) as success_rate
    FROM replay_results r
    WHERE r.trade_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 初始化完成
-- ============================================
SELECT 'Database initialized successfully!' as status;
