-- Migration 007: 用户认证体系重构
-- 支持双登录方式（短信验证码 + 密码），简化注册流程

-- 1. 删除 full_name 列（如果存在）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE users DROP COLUMN full_name;
    END IF;
END $$;

-- 2. 移除 email 的唯一约束，保留普通索引
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    SELECT indexname INTO idx_name
    FROM pg_indexes
    WHERE tablename = 'users' AND indexdef LIKE '%UNIQUE%email%';
    
    IF idx_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', idx_name);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. 移除 username 的唯一约束，保留普通索引
DO $$
DECLARE
    idx_name TEXT;
BEGIN
    SELECT indexname INTO idx_name
    FROM pg_indexes
    WHERE tablename = 'users' AND indexdef LIKE '%UNIQUE%username%';
    
    IF idx_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', idx_name);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 4. 添加 nickname 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);

-- 5. 确保 hashed_password 可为空（GORM 默认可为空，此步骤为保险）
-- hashed_password 在 GORM 中已是 string 类型，默认可为空，无需额外操作
