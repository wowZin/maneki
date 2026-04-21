-- Migration: 006_add_user_levels
-- Feature: 用户等级字典表
-- Date: 2026-04-22

-- 用户等级字典表
CREATE TABLE IF NOT EXISTS user_levels (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    name        VARCHAR(50)  NOT NULL,
    level_value INT          NOT NULL UNIQUE,
    color       VARCHAR(20)  NOT NULL DEFAULT 'default',
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 初始数据
INSERT INTO user_levels (code, name, level_value, color, sort_order) VALUES
('free', '普通用户', 0, 'default', 0),
('vip',  'VIP',      1, 'blue',    1),
('svip', 'SVIP',     2, 'purple',  2)
ON CONFLICT (code) DO NOTHING;

-- 等级值索引（加速查询）
CREATE INDEX IF NOT EXISTS idx_user_levels_value ON user_levels(level_value);
