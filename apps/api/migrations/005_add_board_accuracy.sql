-- Migration: 005_add_board_accuracy
-- Feature: 用户管理增强 - 等级、准确率与 Agent 数据
-- Date: 2026-04-21

-- 为用户表新增打板准确率字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS board_accuracy DECIMAL(5,2);

-- 为准确率字段添加索引，支持按准确率排序查询
CREATE INDEX IF NOT EXISTS idx_users_board_accuracy ON users(board_accuracy DESC NULLS LAST);
