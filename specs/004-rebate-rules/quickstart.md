# Quickstart: Rebate Rules Module

**Feature**: 系统设置 - 返佣规则模块

## Local Development Setup

### 1. Database Migration

The rebate module adds 4 new tables. Run the following migration or rely on GORM AutoMigrate:

```sql
-- RebateRule
CREATE TABLE rebate_rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    agent_id BIGINT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('active', 'inactive')),
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rebate_rules_active_global ON rebate_rules(status) WHERE status = 'active' AND agent_id IS NULL;
CREATE UNIQUE INDEX idx_rebate_rules_active_agent ON rebate_rules(agent_id, status) WHERE status = 'active' AND agent_id IS NOT NULL;

-- IncentiveRule
CREATE TABLE incentive_rules (
    id BIGSERIAL PRIMARY KEY,
    rebate_rule_id BIGINT NOT NULL REFERENCES rebate_rules(id) ON DELETE CASCADE,
    range_start INTEGER NOT NULL CHECK (range_start >= 1),
    range_end INTEGER NULL CHECK (range_end IS NULL OR range_end >= range_start),
    coefficient DECIMAL(5,2) NOT NULL DEFAULT 1.00 CHECK (coefficient >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(rebate_rule_id, range_start)
);

-- RebateRecord
CREATE TABLE rebate_records (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT NOT NULL UNIQUE,
    agent_id BIGINT NOT NULL,
    creator_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    unit_price DECIMAL(10,2) NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
    rebate_rule_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'settled', 'blocked', 'reviewing', 'refunded')),
    arbitrage_tags JSONB NULL,
    reviewed_by BIGINT NULL,
    reviewed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_rebate_records_status_created ON rebate_records(status, created_at);

-- AntiArbitrageRule
CREATE TABLE anti_arbitrage_rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    strategy_type VARCHAR(32) NOT NULL CHECK (strategy_type IN ('self_subscribe', 'ip_freq', 'new_user_threshold', 'linked_account')),
    rule_params JSONB NOT NULL,
    action VARCHAR(16) NOT NULL CHECK (action IN ('block', 'review')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('active', 'inactive')),
    priority INTEGER NOT NULL DEFAULT 0,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RebateAuditLog
CREATE TABLE rebate_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    rebate_record_id BIGINT NOT NULL REFERENCES rebate_records(id),
    admin_id BIGINT NOT NULL,
    admin_name VARCHAR(64) NOT NULL,
    conclusion VARCHAR(16) NOT NULL CHECK (conclusion IN ('normal', 'arbitrage')),
    remark TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2. Seed Data (for development)

```sql
-- Global rebate rule
INSERT INTO rebate_rules (name, unit_price, agent_id, start_at, end_at, status, created_by)
VALUES ('默认全局返佣规则', 5.00, NULL, '2026-01-01', '2026-12-31', 'active', 1);

-- Incentive rules
INSERT INTO incentive_rules (rebate_rule_id, range_start, range_end, coefficient)
VALUES (1, 1, 10, 1.00), (1, 11, 50, 1.20), (1, 51, NULL, 1.50);

-- Anti-arbitrage rules
INSERT INTO anti_arbitrage_rules (name, strategy_type, rule_params, action, status, priority, created_by)
VALUES
('创作者自订阅拦截', 'self_subscribe', '{}', 'block', 'active', 100, 1),
('同一IP 24小时限制', 'ip_freq', '{"window_hours": 24, "max_count": 3}', 'block', 'active', 90, 1),
('新用户7天阈值', 'new_user_threshold', '{"window_days": 7, "max_subscriptions": 10}', 'review', 'active', 80, 1);
```

### 3. Testing Rebate Calculation

```bash
# Create a subscription and trigger rebate calculation
curl -X POST http://localhost:8080/api/v1/internal/rebate/calculate \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
  -d '{
    "subscription_id": 1,
    "agent_id": 1,
    "creator_id": 1,
    "user_id": 2,
    "quantity": 30,
    "ip": "192.168.1.1",
    "device_id": "device-123",
    "subscribed_at": "2026-04-19T10:00:00Z"
  }'
```

Expected response for quantity=30 with default rules:
```json
{
  "rebate_record_id": 1,
  "amount": "170.00",
  "status": "pending",
  "arbitrage_tags": []
}
```
Calculation: 10 × 5 × 1.0 + 20 × 5 × 1.2 = 50 + 120 = 170

### 4. T+1 Settlement Job

A daily cron job or scheduled task should run at 00:05 to update pending records:

```sql
UPDATE rebate_records
SET status = 'settled', settled_at = now()
WHERE status = 'pending'
  AND created_at < CURRENT_DATE;
```
