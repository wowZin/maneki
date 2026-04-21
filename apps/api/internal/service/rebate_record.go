package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"github.com/redis/go-redis/v9"
)

// RebateRecordService 返佣记录服务
type RebateRecordService struct {
	recordRepo  *repository.RebateRecordRepository
	ruleRepo    *repository.RebateRuleRepository
	antiArbRepo *repository.AntiArbitrageRuleRepository
	auditRepo   *repository.RebateAuditLogRepository
	redis       *redis.Client
	calc        *RebateCalculator
}

// NewRebateRecordService 创建返佣记录服务
func NewRebateRecordService(
	recordRepo *repository.RebateRecordRepository,
	ruleRepo *repository.RebateRuleRepository,
	antiArbRepo *repository.AntiArbitrageRuleRepository,
	auditRepo *repository.RebateAuditLogRepository,
	redis *redis.Client,
) *RebateRecordService {
	return &RebateRecordService{
		recordRepo:  recordRepo,
		ruleRepo:    ruleRepo,
		antiArbRepo: antiArbRepo,
		auditRepo:   auditRepo,
		redis:       redis,
		calc:        NewRebateCalculator(),
	}
}

// CalculateRebate 计算返佣（供内部调用）
func (s *RebateRecordService) CalculateRebate(ctx context.Context, subscriptionID, agentID, creatorID, userID uint, quantity int, ip string, deviceID string) (*model.RebateRecord, error) {
	now := time.Now()
	// 查找生效规则（优先专属，fallback 全局）
	rule, err := s.ruleRepo.FindActiveByAgent(ctx, agentID, now)
	if err != nil {
		return nil, err
	}
	if rule == nil {
		rule, err = s.ruleRepo.FindActiveGlobal(ctx, now)
		if err != nil {
			return nil, err
		}
	}
	if rule == nil {
		return nil, errors.New("未找到生效的返佣规则")
	}

	amount, err := s.calc.Calculate(rule, quantity)
	if err != nil {
		return nil, err
	}

	record := &model.RebateRecord{
		SubscriptionID: subscriptionID,
		AgentID:        agentID,
		CreatorID:      creatorID,
		Quantity:       quantity,
		UnitPrice:      rule.UnitPrice,
		Amount:         amount,
		RebateRuleID:   rule.ID,
		Status:         model.RebateRecordStatusPending,
	}

	// 防套利检查
	arbitrageTags, action, err := s.checkAntiArbitrage(ctx, userID, creatorID, agentID, ip, deviceID, now)
	if err != nil {
		return nil, err
	}

	if len(arbitrageTags) > 0 {
		record.ArbitrageTags = arbitrageTags
		if action == "block" {
			record.Status = model.RebateRecordStatusBlocked
			record.Amount = 0
		} else {
			record.Status = model.RebateRecordStatusReviewing
		}
	}

	if err := s.recordRepo.Create(ctx, record); err != nil {
		return nil, err
	}

	// 如果正常通过，增加 Redis 计数器
	if record.Status == model.RebateRecordStatusPending {
		s.incrRedisCounters(ctx, ip, deviceID, userID)
	}

	return record, nil
}

// checkAntiArbitrage 执行防套利检查
func (s *RebateRecordService) checkAntiArbitrage(ctx context.Context, userID, creatorID, agentID uint, ip, deviceID string, now time.Time) (model.StringArray, string, error) {
	rules, err := s.antiArbRepo.ListActive(ctx)
	if err != nil {
		return nil, "", err
	}

	var tags []string
	var finalAction string

	for _, rule := range rules {
		triggered := false

		switch rule.StrategyType {
		case model.AntiArbitrageSelfSubscribe:
			if userID == creatorID {
				triggered = true
			}
		case model.AntiArbitrageIPFreq:
			triggered = s.checkIPFreq(ctx, ip, rule.RuleParams)
		case model.AntiArbitrageNewUserThreshold:
			triggered = s.checkNewUserThreshold(ctx, userID, rule.RuleParams)
		case model.AntiArbitrageLinkedAccount:
			// 占位，暂不实现
		}

		if triggered {
			tags = append(tags, string(rule.StrategyType))
			if finalAction == "" || rule.Action == model.AntiArbitrageActionBlock {
				finalAction = string(rule.Action)
			}
		}
	}

	if len(tags) == 0 {
		return nil, "", nil
	}

	return model.StringArray(tags), finalAction, nil
}

func (s *RebateRecordService) checkIPFreq(ctx context.Context, ip string, params model.JSON) bool {
	if ip == "" {
		return false
	}
	var p model.IPFreqParams
	paramsBytes, err := json.Marshal(params)
	if err != nil {
		return false
	}
	if err := json.Unmarshal(paramsBytes, &p); err != nil {
		return false
	}
	if p.WindowHours <= 0 || p.MaxCount <= 0 {
		return false
	}

	key := fmt.Sprintf("rebate:ip:%s:%s", ip, time.Now().Format("20060102"))
	count, err := s.redis.Get(ctx, key).Int64()
	if err != nil {
		count = 0
	}
	return int(count) >= p.MaxCount
}

func (s *RebateRecordService) checkNewUserThreshold(ctx context.Context, userID uint, params model.JSON) bool {
	var p model.NewUserThresholdParams
	paramsBytes, err := json.Marshal(params)
	if err != nil {
		return false
	}
	if err := json.Unmarshal(paramsBytes, &p); err != nil {
		return false
	}
	if p.WindowDays <= 0 || p.MaxSubscriptions <= 0 {
		return false
	}

	key := fmt.Sprintf("rebate:user:%d:count", userID)
	count, err := s.redis.Get(ctx, key).Int64()
	if err != nil {
		count = 0
	}
	return int(count) >= p.MaxSubscriptions
}

func (s *RebateRecordService) incrRedisCounters(ctx context.Context, ip, deviceID string, userID uint) {
	date := time.Now().Format("20060102")
	if ip != "" {
		key := fmt.Sprintf("rebate:ip:%s:%s", ip, date)
		s.redis.Incr(ctx, key)
		s.redis.Expire(ctx, key, 48*time.Hour)
	}
	if deviceID != "" {
		key := fmt.Sprintf("rebate:device:%s:%s", deviceID, date)
		s.redis.Incr(ctx, key)
		s.redis.Expire(ctx, key, 48*time.Hour)
	}
	key := fmt.Sprintf("rebate:user:%d:count", userID)
	s.redis.Incr(ctx, key)
	s.redis.Expire(ctx, key, 7*24*time.Hour)
}

// ListRecords 获取返佣记录列表
func (s *RebateRecordService) ListRecords(ctx context.Context, filters map[string]interface{}, page, pageSize int) ([]*model.RebateRecord, int64, error) {
	return s.recordRepo.List(ctx, filters, page, pageSize)
}

// GetRecord 获取返佣记录详情
func (s *RebateRecordService) GetRecord(ctx context.Context, id uint) (*model.RebateRecord, error) {
	return s.recordRepo.GetByID(ctx, id)
}

// ReviewRecord 审核返佣记录
func (s *RebateRecordService) ReviewRecord(ctx context.Context, id uint, conclusion string, remark string, adminID uint) error {
	record, err := s.recordRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if record == nil {
		return errors.New("记录不存在")
	}
	if !record.CanReview() {
		return errors.New("该记录不可审核")
	}

	var status model.RebateRecordStatus
	if conclusion == "normal" {
		status = model.RebateRecordStatusPending
	} else if conclusion == "arbitrage" {
		status = model.RebateRecordStatusBlocked
		record.Amount = 0
	} else {
		return errors.New("无效的审核结论")
	}

	if err := s.recordRepo.Review(ctx, id, status, adminID); err != nil {
		return err
	}

	auditLog := &model.RebateAuditLog{
		RebateRecordID: id,
		AdminID:        adminID,
		AdminName:      "",
		Conclusion:     model.RebateAuditConclusion(conclusion),
		Remark:         remark,
	}
	return s.auditRepo.Create(ctx, auditLog)
}

// ExportRecords 导出返佣记录
func (s *RebateRecordService) ExportRecords(ctx context.Context, filters map[string]interface{}) ([]*model.RebateRecord, error) {
	records, _, err := s.recordRepo.List(ctx, filters, 1, 100000)
	return records, err
}
