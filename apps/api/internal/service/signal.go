package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maneki/api/internal/repository"
)

// SignalService 信号中心服务
type SignalService struct {
	signalRepo   *repository.SignalRepository
	overviewRepo *repository.OverviewRepository
}

// NewSignalService 创建信号中心服务
func NewSignalService(signalRepo *repository.SignalRepository, overviewRepo *repository.OverviewRepository) *SignalService {
	return &SignalService{
		signalRepo:   signalRepo,
		overviewRepo: overviewRepo,
	}
}

// ============================================
// 信号列表 (US1)
// ============================================

// SignalsResponse 信号列表响应
type SignalsResponse struct {
	Items    []repository.SignalItem `json:"items"`
	HasMore  bool                    `json:"has_more"`
	LatestID uint                    `json:"latest_id"`
}

// GetSignals 获取信号列表
func (s *SignalService) GetSignals(ctx context.Context, userID *uuid.UUID, afterID uint, limit int) (*SignalsResponse, error) {
	if limit < 1 || limit > 50 {
		limit = 20
	}

	items, hasMore, err := s.signalRepo.GetSignals(ctx, afterID, limit)
	if err != nil {
		return nil, fmt.Errorf("get signals failed: %w", err)
	}

	// 如果用户已登录，标记已关注的信号
	if userID != nil {
		now := time.Now().Truncate(24 * time.Hour)
		followedCodes, err := s.signalRepo.GetFollowedStockCodes(ctx, *userID, now)
		if err == nil {
			for i := range items {
				items[i].IsFollowed = followedCodes[items[i].StockCode]
			}
		}
	}

	var latestID uint
	if len(items) > 0 {
		latestID = items[0].ID
	}

	return &SignalsResponse{
		Items:    items,
		HasMore:  hasMore,
		LatestID: latestID,
	}, nil
}

// ============================================
// 关注/取消关注 (US2)
// ============================================

// FollowResponse 关注响应
type FollowResponse struct {
	Success    bool   `json:"success"`
	TrackingID uint   `json:"tracking_id"`
	StockCode  string `json:"stock_code"`
	StockName  string `json:"stock_name"`
	TrackDate  string `json:"track_date"`
}

// FollowSignal 关注信号
func (s *SignalService) FollowSignal(ctx context.Context, userID uuid.UUID, signalID uint) (*FollowResponse, error) {
	// 查找信号
	signal, err := s.signalRepo.FindSignalByID(ctx, signalID)
	if err != nil {
		return nil, fmt.Errorf("signal not found")
	}

	// 检查今日是否已关注该股票
	now := time.Now().Truncate(24 * time.Hour)
	alreadyFollowed, err := s.signalRepo.CheckFollowed(ctx, userID, signal.StockCode, now)
	if err != nil {
		return nil, fmt.Errorf("check followed failed: %w", err)
	}
	if alreadyFollowed {
		return nil, fmt.Errorf("ALREADY_FOLLOWED")
	}

	// 创建关注记录
	trackingID, err := s.signalRepo.FollowSignal(ctx, userID, signalID, signal.StockCode, now)
	if err != nil {
		return nil, fmt.Errorf("follow signal failed: %w", err)
	}

	return &FollowResponse{
		Success:    true,
		TrackingID: trackingID,
		StockCode:  signal.StockCode,
		StockName:  signal.StockName,
		TrackDate:  now.Format("2006-01-02"),
	}, nil
}

// UnfollowSignal 取消关注
func (s *SignalService) UnfollowSignal(ctx context.Context, userID uuid.UUID, signalID uint) error {
	// 查找信号获取股票代码
	signal, err := s.signalRepo.FindSignalByID(ctx, signalID)
	if err != nil {
		return fmt.Errorf("signal not found")
	}

	now := time.Now().Truncate(24 * time.Hour)
	return s.signalRepo.UnfollowSignal(ctx, userID, signal.StockCode, now)
}

// ============================================
// 我的关注与统计 (US3)
// ============================================

// MyFollowsResponse 我的关注响应
type MyFollowsResponse struct {
	Items []repository.MyFollowItem `json:"items"`
	Total int                       `json:"total"`
}

// GetMyFollows 获取我的今日关注
func (s *SignalService) GetMyFollows(ctx context.Context, userID uuid.UUID) (*MyFollowsResponse, error) {
	now := time.Now().Truncate(24 * time.Hour)
	items, err := s.signalRepo.GetMyFollows(ctx, userID, now)
	if err != nil {
		return nil, fmt.Errorf("get my follows failed: %w", err)
	}
	return &MyFollowsResponse{
		Items: items,
		Total: len(items),
	}, nil
}

// MyStatsResponse 我的统计响应
type MyStatsResponse struct {
	Period         string  `json:"period"`
	TotalFollowed  int64   `json:"total_followed"`
	TotalHit       int64   `json:"total_hit"`
	OverallHitRate float64 `json:"overall_hit_rate"`
	UpdatedAt      string  `json:"updated_at"`
}

// GetMyStats 获取我的统计
func (s *SignalService) GetMyStats(ctx context.Context, userID uuid.UUID, period string) (*MyStatsResponse, error) {
	startDate, endDate := parsePeriod(period)

	stats, err := s.signalRepo.GetMyStats(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("get my stats failed: %w", err)
	}

	return &MyStatsResponse{
		Period:         period,
		TotalFollowed:  stats.TotalFollowed,
		TotalHit:       stats.TotalHit,
		OverallHitRate: stats.OverallHitRate,
		UpdatedAt:      time.Now().Format(time.RFC3339),
	}, nil
}
