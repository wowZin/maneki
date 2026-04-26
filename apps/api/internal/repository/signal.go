package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SignalRepository 信号中心数据访问层
type SignalRepository struct {
	db *gorm.DB
}

// NewSignalRepository 创建信号中心仓库
func NewSignalRepository(db *gorm.DB) *SignalRepository {
	return &SignalRepository{db: db}
}

// SignalItem 信号列表项
type SignalItem struct {
	ID           uint      `json:"id"`
	StockCode    string    `json:"stock_code"`
	StockName    string    `json:"stock_name"`
	SignalType   string    `json:"signal_type"`
	Confidence   float64   `json:"confidence"`
	TriggerPrice *float64  `json:"trigger_price,omitempty"`
	Reason       string    `json:"reason"`
	CreatedAt    time.Time `json:"created_at"`
	IsFollowed   bool      `json:"is_followed"`
}

// GetSignals 获取信号列表（按 watch 类型过滤）
func (r *SignalRepository) GetSignals(ctx context.Context, afterID uint, limit int) ([]SignalItem, bool, error) {
	var items []SignalItem
	var hasMore bool

	query := r.db.WithContext(ctx).Raw(`
		SELECT
			s.id,
			s.code AS stock_code,
			COALESCE(st.name, '') AS stock_name,
			s.signal_type,
			s.confidence,
			s.trigger_price,
			COALESCE(s.reason, '') AS reason,
			s.created_at,
			false AS is_followed
		FROM signals s
		LEFT JOIN stocks st ON s.code = st.code
		WHERE s.signal_type = 'watch'
		ORDER BY s.id DESC
		LIMIT ?
	`, limit+1)

	if afterID > 0 {
		query = r.db.WithContext(ctx).Raw(`
			SELECT
				s.id,
				s.code AS stock_code,
				COALESCE(st.name, '') AS stock_name,
				s.signal_type,
				s.confidence,
				s.trigger_price,
				COALESCE(s.reason, '') AS reason,
				s.created_at,
				false AS is_followed
			FROM signals s
			LEFT JOIN stocks st ON s.code = st.code
			WHERE s.signal_type = 'watch'
			  AND s.id > ?
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

// CheckFollowed 检查用户是否已关注某股票（今日）
func (r *SignalRepository) CheckFollowed(ctx context.Context, userID uuid.UUID, stockCode string, date time.Time) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) FROM user_stock_trackings
		WHERE user_id = ? AND stock_code = ? AND track_date = ?
	`, userID, stockCode, date.Format("2006-01-02")).Scan(&count).Error
	return count > 0, err
}

// GetFollowedStockCodes 获取用户今日已关注的股票代码集合
func (r *SignalRepository) GetFollowedStockCodes(ctx context.Context, userID uuid.UUID, date time.Time) (map[string]bool, error) {
	type trackingCode struct {
		StockCode string `json:"stock_code"`
	}
	var trackings []trackingCode
	err := r.db.WithContext(ctx).Raw(`
		SELECT stock_code FROM user_stock_trackings
		WHERE user_id = ? AND track_date = ?
	`, userID, date.Format("2006-01-02")).Scan(&trackings).Error
	if err != nil {
		return nil, err
	}
	codes := make(map[string]bool, len(trackings))
	for _, t := range trackings {
		codes[t.StockCode] = true
	}
	return codes, nil
}

// FollowSignal 关注信号
func (r *SignalRepository) FollowSignal(ctx context.Context, userID uuid.UUID, signalID uint, stockCode string, date time.Time) (uint, error) {
	var trackingID uint
	err := r.db.WithContext(ctx).Raw(`
		INSERT INTO user_stock_trackings (user_id, stock_code, track_date, signal_id, created_at)
		VALUES (?, ?, ?, ?, NOW())
		RETURNING id
	`, userID, stockCode, date.Format("2006-01-02"), signalID).Scan(&trackingID).Error
	if err != nil {
		return 0, err
	}
	return trackingID, nil
}

// UnfollowSignal 取消关注
func (r *SignalRepository) UnfollowSignal(ctx context.Context, userID uuid.UUID, stockCode string, date time.Time) error {
	return r.db.WithContext(ctx).Exec(`
		DELETE FROM user_stock_trackings
		WHERE user_id = ? AND stock_code = ? AND track_date = ?
	`, userID, stockCode, date.Format("2006-01-02")).Error
}

// MyFollowItem 我的关注项
type MyFollowItem struct {
	TrackingID uint      `json:"tracking_id"`
	SignalID   uint      `json:"signal_id"`
	StockCode  string    `json:"stock_code"`
	StockName  string    `json:"stock_name"`
	Confidence float64   `json:"confidence"`
	Reason     string    `json:"reason"`
	CreatedAt  time.Time `json:"created_at"`
	HitStatus  *bool     `json:"hit_status,omitempty"`
}

// GetMyFollows 获取用户今日关注列表
func (r *SignalRepository) GetMyFollows(ctx context.Context, userID uuid.UUID, date time.Time) ([]MyFollowItem, error) {
	var items []MyFollowItem
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			ust.id AS tracking_id,
			COALESCE(ust.signal_id, 0) AS signal_id,
			ust.stock_code,
			COALESCE(s.name, '') AS stock_name,
			COALESCE(sig.confidence, 0) AS confidence,
			COALESCE(sig.reason, '') AS reason,
			COALESCE(sig.created_at, ust.created_at) AS created_at,
			ust.hit_status
		FROM user_stock_trackings ust
		LEFT JOIN stocks s ON ust.stock_code = s.code
		LEFT JOIN signals sig ON ust.signal_id = sig.id
		WHERE ust.user_id = ?
		  AND ust.track_date = ?
		ORDER BY ust.created_at DESC
	`, userID, date.Format("2006-01-02")).Scan(&items).Error
	return items, err
}

// MyStats 个人统计
type MyStats struct {
	TotalFollowed    int64   `json:"total_followed"`
	TotalHit         int64   `json:"total_hit"`
	OverallHitRate   float64 `json:"overall_hit_rate"`
}

// GetMyStats 获取用户统计（复用现有追踪表聚合）
func (r *SignalRepository) GetMyStats(ctx context.Context, userID uuid.UUID, startDate, endDate time.Time) (*MyStats, error) {
	var result MyStats
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			COUNT(*) AS total_followed,
			COUNT(*) FILTER (WHERE hit_status = true) AS total_hit,
			CASE
				WHEN COUNT(*) = 0 THEN 0
				ELSE ROUND(COUNT(*) FILTER (WHERE hit_status = true)::numeric / COUNT(*)::numeric, 4)
			END AS overall_hit_rate
		FROM user_stock_trackings
		WHERE user_id = ?
		  AND track_date BETWEEN ? AND ?
	`, userID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).Scan(&result).Error
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// parsePeriod 解析时间维度参数为起止日期（复用 overview 逻辑）
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

// FindSignalByID 根据ID查找信号
func (r *SignalRepository) FindSignalByID(ctx context.Context, id uint) (*SignalItem, error) {
	var item SignalItem
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			s.id,
			s.code AS stock_code,
			COALESCE(st.name, '') AS stock_name,
			s.signal_type,
			s.confidence,
			s.trigger_price,
			COALESCE(s.reason, '') AS reason,
			s.created_at,
			false AS is_followed
		FROM signals s
		LEFT JOIN stocks st ON s.code = st.code
		WHERE s.id = ?
	`, id).Scan(&item).Error
	if err != nil {
		return nil, err
	}
	if item.ID == 0 {
		return nil, fmt.Errorf("signal not found")
	}
	return &item, nil
}
