package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// OverviewRepository 首页概览数据访问层
type OverviewRepository struct {
	db *gorm.DB
}

// NewOverviewRepository 创建概览数据仓库
func NewOverviewRepository(db *gorm.DB) *OverviewRepository {
	return &OverviewRepository{db: db}
}

// ============================================
// 打板预测正确率趋势 (US1)
// ============================================

// AccuracyTrendItem 正确率趋势单项
type AccuracyTrendItem struct {
	Date             string  `json:"date"`
	Accuracy         float64 `json:"accuracy"`
	TotalPredictions int64   `json:"total_predictions"`
	HitCount         int64   `json:"hit_count"`
}

// GetAccuracyTrend 获取指定时间范围内的打板预测正确率趋势
func (r *OverviewRepository) GetAccuracyTrend(ctx context.Context, startDate, endDate time.Time) ([]AccuracyTrendItem, error) {
	var items []AccuracyTrendItem
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			DATE(created_at)::text AS date,
			CASE
				WHEN COUNT(*) = 0 THEN 0
				ELSE ROUND(COUNT(*) FILTER (WHERE is_valid = true)::numeric / COUNT(*)::numeric, 4)
			END AS accuracy,
			COUNT(*) AS total_predictions,
			COUNT(*) FILTER (WHERE is_valid = true) AS hit_count
		FROM signals
		WHERE signal_type = 'watch'
		  AND DATE(created_at) BETWEEN ? AND ?
		GROUP BY DATE(created_at)
		ORDER BY DATE(created_at) ASC
	`, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).Scan(&items).Error
	return items, err
}

// GetOverallAccuracy 获取整体正确率
func (r *OverviewRepository) GetOverallAccuracy(ctx context.Context, startDate, endDate time.Time) (float64, error) {
	var result struct {
		Accuracy float64
	}
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			CASE
				WHEN COUNT(*) = 0 THEN 0
				ELSE ROUND(COUNT(*) FILTER (WHERE is_valid = true)::numeric / COUNT(*)::numeric, 4)
			END AS accuracy
		FROM signals
		WHERE signal_type = 'watch'
		  AND DATE(created_at) BETWEEN ? AND ?
	`, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).Scan(&result).Error
	return result.Accuracy, err
}

// ============================================
// 用户选中涨停股票趋势 (US2)
// ============================================

// UserTrackingTrendItem 用户追踪趋势单项
type UserTrackingTrendItem struct {
	Date         string  `json:"date"`
	TrackedCount int64   `json:"tracked_count"`
	HitCount     int64   `json:"hit_count"`
	HitRate      float64 `json:"hit_rate"`
}

// GetUserTrackingTrend 获取用户选中涨停股票的趋势统计
func (r *OverviewRepository) GetUserTrackingTrend(ctx context.Context, userID uuid.UUID, startDate, endDate time.Time) ([]UserTrackingTrendItem, error) {
	var items []UserTrackingTrendItem
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			track_date::text AS date,
			COUNT(*) AS tracked_count,
			COUNT(*) FILTER (WHERE hit_status = true) AS hit_count,
			CASE
				WHEN COUNT(*) = 0 THEN 0
				ELSE ROUND(COUNT(*) FILTER (WHERE hit_status = true)::numeric / COUNT(*)::numeric, 4)
			END AS hit_rate
		FROM user_stock_trackings
		WHERE user_id = ?
		  AND track_date BETWEEN ? AND ?
		GROUP BY track_date
		ORDER BY track_date ASC
	`, userID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).Scan(&items).Error
	return items, err
}

// GetUserTrackingSummary 获取用户追踪汇总统计
func (r *OverviewRepository) GetUserTrackingSummary(ctx context.Context, userID uuid.UUID, startDate, endDate time.Time) (totalTracked, totalHit int64, overallHitRate float64, err error) {
	var result struct {
		TotalTracked   int64
		TotalHit       int64
		OverallHitRate float64
	}
	err = r.db.WithContext(ctx).Raw(`
		SELECT
			COUNT(*) AS total_tracked,
			COUNT(*) FILTER (WHERE hit_status = true) AS total_hit,
			CASE
				WHEN COUNT(*) = 0 THEN 0
				ELSE ROUND(COUNT(*) FILTER (WHERE hit_status = true)::numeric / COUNT(*)::numeric, 4)
			END AS overall_hit_rate
		FROM user_stock_trackings
		WHERE user_id = ?
		  AND track_date BETWEEN ? AND ?
	`, userID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).Scan(&result).Error
	return result.TotalTracked, result.TotalHit, result.OverallHitRate, err
}

// UserTrackingDetailItem 用户追踪明细单项
type UserTrackingDetailItem struct {
	StockCode   string    `json:"stock_code"`
	StockName   string    `json:"stock_name"`
	TrackedAt   time.Time `json:"tracked_at"`
	HitStatus   *bool     `json:"hit_status,omitempty"`
	ChangePct   float64   `json:"change_pct"`
	ClosePrice  float64   `json:"close_price"`
}

// GetUserTrackingDetail 获取指定日期用户选中股票的明细列表
func (r *OverviewRepository) GetUserTrackingDetail(ctx context.Context, userID uuid.UUID, date time.Time, page, pageSize int) ([]UserTrackingDetailItem, int64, error) {
	var total int64
	var items []UserTrackingDetailItem

	offset := (page - 1) * pageSize
	trackDate := date.Format("2006-01-02")

	err := r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM user_stock_trackings WHERE user_id = ? AND track_date = ?
	`, userID, trackDate).Scan(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = r.db.WithContext(ctx).Raw(`
		SELECT
			ust.stock_code,
			COALESCE(s.name, '') AS stock_name,
			ust.created_at AS tracked_at,
			ust.hit_status,
			COALESCE(k.close, 0) AS close_price,
			CASE
				WHEN k.open = 0 OR k.open IS NULL THEN 0
				ELSE ROUND(((k.close - k.open) / k.open * 100)::numeric, 2)
			END AS change_pct
		FROM user_stock_trackings ust
		LEFT JOIN stocks s ON ust.stock_code = s.code
		LEFT JOIN kline_1d k ON ust.stock_code = k.code AND k.date = ust.track_date
		WHERE ust.user_id = ?
		  AND ust.track_date = ?
		ORDER BY ust.created_at DESC
		LIMIT ? OFFSET ?
	`, userID, trackDate, pageSize, offset).Scan(&items).Error

	return items, total, err
}

// ============================================
// Agent 命中率 (US3)
// ============================================

// AgentPerformanceItem Agent表现单项
type AgentPerformanceItem struct {
	AgentID           uint    `json:"agent_id"`
	AgentName         string  `json:"agent_name"`
	AgentType         string  `json:"agent_type"`
	TotalPredictions  int64   `json:"total_predictions"`
	HitCount          int64   `json:"hit_count"`
	HitRate           float64 `json:"hit_rate"`
	PrevHitRate       float64 `json:"prev_hit_rate"`
	Trend             string  `json:"trend"`
	Rank              int     `json:"rank"`
}

// GetAgentPerformance 获取各Agent的命中率排名
func (r *OverviewRepository) GetAgentPerformance(ctx context.Context, startDate, endDate time.Time, sortBy string, limit int) ([]AgentPerformanceItem, error) {
	var items []AgentPerformanceItem

	orderClause := "hit_rate DESC"
	if sortBy == "total_predictions" {
		orderClause = "total_predictions DESC"
	}

	err := r.db.WithContext(ctx).Raw(fmt.Sprintf(`
		WITH current_period AS (
			SELECT
				ad.agent_type,
				COUNT(*) AS total_predictions,
				COUNT(*) FILTER (WHERE s.is_valid = true) AS hit_count,
				CASE
					WHEN COUNT(*) = 0 THEN 0
					ELSE ROUND(COUNT(*) FILTER (WHERE s.is_valid = true)::numeric / COUNT(*)::numeric, 4)
				END AS hit_rate
			FROM agent_decisions ad
			JOIN signals s ON ad.signal_id = s.id
			WHERE DATE(s.created_at) BETWEEN ? AND ?
			  AND ad.decision = 'buy'
			GROUP BY ad.agent_type
		),
		prev_period AS (
			SELECT
				ad.agent_type,
				CASE
					WHEN COUNT(*) = 0 THEN 0
					ELSE ROUND(COUNT(*) FILTER (WHERE s.is_valid = true)::numeric / COUNT(*)::numeric, 4)
				END AS hit_rate
			FROM agent_decisions ad
			JOIN signals s ON ad.signal_id = s.id
			WHERE DATE(s.created_at) BETWEEN ? AND ?
			  AND ad.decision = 'buy'
			GROUP BY ad.agent_type
		)
		SELECT
			ROW_NUMBER() OVER (ORDER BY cp.hit_rate DESC) AS rank,
			COALESCE(a.id, 0) AS agent_id,
			COALESCE(a.name, cp.agent_type) AS agent_name,
			cp.agent_type,
			cp.total_predictions,
			cp.hit_count,
			cp.hit_rate,
			COALESCE(pp.hit_rate, 0) AS prev_hit_rate,
			CASE
				WHEN cp.hit_rate > COALESCE(pp.hit_rate, 0) + 0.01 THEN 'up'
				WHEN cp.hit_rate < COALESCE(pp.hit_rate, 0) - 0.01 THEN 'down'
				ELSE 'stable'
			END AS trend
		FROM current_period cp
		LEFT JOIN prev_period pp ON cp.agent_type = pp.agent_type
		LEFT JOIN agents a ON cp.agent_type = a.type
		ORDER BY %s
		LIMIT ?
	`, orderClause),
		startDate.Format("2006-01-02"), endDate.Format("2006-01-02"),
		startDate.Add(-(endDate.Sub(startDate))).Format("2006-01-02"), startDate.Add(-time.Hour*24).Format("2006-01-02"),
		limit,
	).Scan(&items).Error

	return items, err
}

// ============================================
// 热门股票 (US4)
// ============================================

// HotStockItem 热门股票单项
type HotStockItem struct {
	Rank      int     `json:"rank"`
	StockCode string  `json:"stock_code"`
	StockName string  `json:"stock_name"`
	HeatScore float64 `json:"heat_score"`
	Price     float64 `json:"price"`
	ChangePct float64 `json:"change_pct"`
	Volume    float64 `json:"volume"`
}

// GetHotStocks 获取热门股票榜单
func (r *OverviewRepository) GetHotStocks(ctx context.Context, limit int) ([]HotStockItem, error) {
	var items []HotStockItem
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			hs.rank,
			hs.stock_code,
			COALESCE(s.name, '') AS stock_name,
			hs.heat_score,
			hs.price,
			hs.change_pct,
			hs.volume
		FROM hot_stocks hs
		LEFT JOIN stocks s ON hs.stock_code = s.code
		ORDER BY hs.rank ASC
		LIMIT ?
	`, limit).Scan(&items).Error
	return items, err
}

// ============================================
// 实时信号 (US5)
// ============================================

// RealtimeSignalItem 实时信号单项
type RealtimeSignalItem struct {
	ID           uint      `json:"id"`
	SignalType   string    `json:"signal_type"`
	StockCode    string    `json:"stock_code"`
	StockName    string    `json:"stock_name"`
	Confidence   float64   `json:"confidence"`
	TriggerPrice *float64  `json:"trigger_price,omitempty"`
	Reason       string    `json:"reason"`
	CreatedAt    time.Time `json:"created_at"`
}

// GetRealtimeSignals 获取最新的实时信号列表
func (r *OverviewRepository) GetRealtimeSignals(ctx context.Context, afterID uint, limit int) ([]RealtimeSignalItem, bool, error) {
	var items []RealtimeSignalItem
	var hasMore bool

	query := r.db.WithContext(ctx).Raw(`
		SELECT
			s.id,
			s.signal_type,
			s.code AS stock_code,
			COALESCE(st.name, '') AS stock_name,
			s.confidence,
			s.trigger_price,
			COALESCE(s.reason, '') AS reason,
			s.created_at
		FROM signals s
		LEFT JOIN stocks st ON s.code = st.code
		WHERE s.id <= (SELECT MAX(id) FROM signals)
		ORDER BY s.id DESC
		LIMIT ?
	`, limit+1)

	if afterID > 0 {
		query = r.db.WithContext(ctx).Raw(`
			SELECT
				s.id,
				s.signal_type,
				s.code AS stock_code,
				COALESCE(st.name, '') AS stock_name,
				s.confidence,
				s.trigger_price,
				COALESCE(s.reason, '') AS reason,
				s.created_at
			FROM signals s
			LEFT JOIN stocks st ON s.code = st.code
			WHERE s.id > ?
			ORDER BY s.id DESC
			LIMIT ?
		`, afterID, limit+1)
	}

	err := query.Scan(&items).Error
	if err != nil {
		return nil, false, err
	}

	if len(items) > limit {
		hasMore = true
		items = items[:limit]
	}

	return items, hasMore, nil
}
