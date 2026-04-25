package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maneki/api/internal/repository"
	"github.com/redis/go-redis/v9"
)

// OverviewService 首页概览服务
type OverviewService struct {
	overviewRepo *repository.OverviewRepository
	redis        *redis.Client
}

// NewOverviewService 创建概览服务
func NewOverviewService(overviewRepo *repository.OverviewRepository, redis *redis.Client) *OverviewService {
	return &OverviewService{
		overviewRepo: overviewRepo,
		redis:        redis,
	}
}

// parsePeriod 解析时间维度参数为起止日期
func parsePeriod(period string) (startDate, endDate time.Time) {
	endDate = time.Now().Truncate(24 * time.Hour)
	switch period {
	case "30d":
		startDate = endDate.AddDate(0, 0, -29)
	case "90d":
		startDate = endDate.AddDate(0, 0, -89)
	case "1y":
		startDate = endDate.AddDate(-1, 0, 0)
	default: // "7d"
		startDate = endDate.AddDate(0, 0, -6)
	}
	return startDate, endDate
}

// ============================================
// 打板预测正确率趋势 (US1)
// ============================================

// AccuracyTrendResponse 正确率趋势响应
type AccuracyTrendResponse struct {
	Period          string                           `json:"period"`
	Data            []repository.AccuracyTrendItem   `json:"data"`
	OverallAccuracy float64                          `json:"overall_accuracy"`
	UpdatedAt       string                           `json:"updated_at"`
}

// GetAccuracyTrend 获取打板预测正确率趋势
func (s *OverviewService) GetAccuracyTrend(ctx context.Context, period string) (*AccuracyTrendResponse, error) {
	startDate, endDate := parsePeriod(period)

	data, err := s.overviewRepo.GetAccuracyTrend(ctx, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("get accuracy trend failed: %w", err)
	}

	overall, err := s.overviewRepo.GetOverallAccuracy(ctx, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("get overall accuracy failed: %w", err)
	}

	return &AccuracyTrendResponse{
		Period:          period,
		Data:            data,
		OverallAccuracy: overall,
		UpdatedAt:       time.Now().Format(time.RFC3339),
	}, nil
}

// ============================================
// 用户选中涨停股票趋势 (US2)
// ============================================

// UserTrackingTrendResponse 用户追踪趋势响应
type UserTrackingTrendResponse struct {
	Period      string                              `json:"period"`
	Data        []repository.UserTrackingTrendItem  `json:"data"`
	Summary     UserTrackingSummary                 `json:"summary"`
	UpdatedAt   string                              `json:"updated_at"`
}

// UserTrackingSummary 用户追踪汇总
type UserTrackingSummary struct {
	TotalTracked   int64   `json:"total_tracked"`
	TotalHit       int64   `json:"total_hit"`
	OverallHitRate float64 `json:"overall_hit_rate"`
}

// GetUserTrackingTrend 获取用户选中涨停股票趋势
func (s *OverviewService) GetUserTrackingTrend(ctx context.Context, userID uuid.UUID, period string) (*UserTrackingTrendResponse, error) {
	startDate, endDate := parsePeriod(period)

	data, err := s.overviewRepo.GetUserTrackingTrend(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("get user tracking trend failed: %w", err)
	}

	totalTracked, totalHit, overallHitRate, err := s.overviewRepo.GetUserTrackingSummary(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("get user tracking summary failed: %w", err)
	}

	return &UserTrackingTrendResponse{
		Period: period,
		Data:   data,
		Summary: UserTrackingSummary{
			TotalTracked:   totalTracked,
			TotalHit:       totalHit,
			OverallHitRate: overallHitRate,
		},
		UpdatedAt: time.Now().Format(time.RFC3339),
	}, nil
}

// UserTrackingDetailResponse 用户追踪明细响应
type UserTrackingDetailResponse struct {
	Date       string                              `json:"date"`
	Items      []repository.UserTrackingDetailItem `json:"items"`
	Pagination PaginationMeta                      `json:"pagination"`
}

// PaginationMeta 分页元数据
type PaginationMeta struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

// GetUserTrackingDetail 获取用户选中股票明细
func (s *OverviewService) GetUserTrackingDetail(ctx context.Context, userID uuid.UUID, date time.Time, page, pageSize int) (*UserTrackingDetailResponse, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	items, total, err := s.overviewRepo.GetUserTrackingDetail(ctx, userID, date, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("get user tracking detail failed: %w", err)
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	return &UserTrackingDetailResponse{
		Date:  date.Format("2006-01-02"),
		Items: items,
		Pagination: PaginationMeta{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: totalPages,
		},
	}, nil
}

// ============================================
// Agent 命中率 (US3)
// ============================================

// AgentPerformanceResponse Agent命中率响应
type AgentPerformanceResponse struct {
	Period    string                             `json:"period"`
	Agents    []repository.AgentPerformanceItem  `json:"agents"`
	UpdatedAt string                             `json:"updated_at"`
}

// GetAgentPerformance 获取Agent命中率
func (s *OverviewService) GetAgentPerformance(ctx context.Context, period, sortBy string, limit int) (*AgentPerformanceResponse, error) {
	startDate, endDate := parsePeriod(period)
	if limit < 1 || limit > 50 {
		limit = 20
	}

	agents, err := s.overviewRepo.GetAgentPerformance(ctx, startDate, endDate, sortBy, limit)
	if err != nil {
		return nil, fmt.Errorf("get agent performance failed: %w", err)
	}

	return &AgentPerformanceResponse{
		Period:    period,
		Agents:    agents,
		UpdatedAt: time.Now().Format(time.RFC3339),
	}, nil
}

// ============================================
// 热门股票 (US4)
// ============================================

// HotStocksResponse 热门股票响应
type HotStocksResponse struct {
	Items        []repository.HotStockItem `json:"items"`
	CalculatedAt string                    `json:"calculated_at"`
}

// GetHotStocks 获取热门股票
func (s *OverviewService) GetHotStocks(ctx context.Context, limit int) (*HotStocksResponse, error) {
	if limit < 1 || limit > 50 {
		limit = 20
	}

	items, err := s.overviewRepo.GetHotStocks(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("get hot stocks failed: %w", err)
	}

	return &HotStocksResponse{
		Items:        items,
		CalculatedAt: time.Now().Format(time.RFC3339),
	}, nil
}

// ============================================
// 实时信号 (US5)
// ============================================

// RealtimeSignalsResponse 实时信号响应
type RealtimeSignalsResponse struct {
	Items    []repository.RealtimeSignalItem `json:"items"`
	HasMore  bool                            `json:"has_more"`
	LatestID uint                            `json:"latest_id"`
}

// GetRealtimeSignals 获取实时信号
func (s *OverviewService) GetRealtimeSignals(ctx context.Context, afterID uint, limit int) (*RealtimeSignalsResponse, error) {
	if limit < 1 || limit > 50 {
		limit = 10
	}

	items, hasMore, err := s.overviewRepo.GetRealtimeSignals(ctx, afterID, limit)
	if err != nil {
		return nil, fmt.Errorf("get realtime signals failed: %w", err)
	}

	var latestID uint
	if len(items) > 0 {
		latestID = items[0].ID
	}

	return &RealtimeSignalsResponse{
		Items:    items,
		HasMore:  hasMore,
		LatestID: latestID,
	}, nil
}
