package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/maneki/api/internal/model"
)

// TopListRepository 龙虎榜数据访问层
type TopListRepository struct {
	db *gorm.DB
}

// NewTopListRepository 创建龙虎榜仓库
func NewTopListRepository(db *gorm.DB) *TopListRepository {
	return &TopListRepository{db: db}
}

// ListTopListQuery 龙虎榜列表查询参数
type ListTopListQuery struct {
	Page       int
	PageSize   int
	TSCode     string
	Name       string
	StartDate  string
	EndDate    string
	MinAmount  float64
	MaxAmount  float64
}

// ListTopListResult 龙虎榜列表查询结果
type ListTopListResult struct {
	Data     []model.TopList
	Total    int64
	Page     int
	PageSize int
}

// List 获取龙虎榜列表
func (r *TopListRepository) List(ctx context.Context, query ListTopListQuery) (*ListTopListResult, error) {
	db := r.db.WithContext(ctx).Model(&model.TopList{})

	// 股票代码筛选
	if query.TSCode != "" {
		db = db.Where("ts_code LIKE ?", "%"+query.TSCode+"%")
	}

	// 股票名称筛选
	if query.Name != "" {
		db = db.Where("name LIKE ?", "%"+query.Name+"%")
	}

	// 日期范围
	if query.StartDate != "" {
		db = db.Where("trade_date >= ?", query.StartDate)
	}
	if query.EndDate != "" {
		db = db.Where("trade_date <= ?", query.EndDate)
	}

	// 成交额范围
	if query.MinAmount > 0 {
		db = db.Where("amount >= ?", query.MinAmount)
	}
	if query.MaxAmount > 0 {
		db = db.Where("amount <= ?", query.MaxAmount)
	}

	// 计算总数
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	// 分页查询
	var data []model.TopList
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("trade_date DESC, amount DESC").
		Offset(offset).
		Limit(query.PageSize).
		Find(&data).Error; err != nil {
		return nil, err
	}

	return &ListTopListResult{
		Data:     data,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
	}, nil
}

// GetByID 根据ID获取龙虎榜数据
func (r *TopListRepository) GetByID(ctx context.Context, id uint) (*model.TopList, error) {
	var data model.TopList
	if err := r.db.WithContext(ctx).First(&data, id).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

// Delete 删除单条龙虎榜数据
func (r *TopListRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&model.TopList{}, id).Error
}

// BatchDelete 批量删除龙虎榜数据
func (r *TopListRepository) BatchDelete(ctx context.Context, ids []uint) (int64, error) {
	result := r.db.WithContext(ctx).Where("id IN ?", ids).Delete(&model.TopList{})
	return result.RowsAffected, result.Error
}

// Create 创建龙虎榜数据
func (r *TopListRepository) Create(ctx context.Context, data *model.TopList) error {
	return r.db.WithContext(ctx).Create(data).Error
}

// CreateBatch 批量创建龙虎榜数据
func (r *TopListRepository) CreateBatch(ctx context.Context, dataList []*model.TopList) error {
	return r.db.WithContext(ctx).CreateInBatches(dataList, 100).Error
}

// GetStats 获取龙虎榜统计
func (r *TopListRepository) GetStats(ctx context.Context) (map[string]interface{}, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.TopList{}).Count(&total).Error; err != nil {
		return nil, err
	}

	// 今日数据
	var todayCount int64
	today := time.Now().Format("20060102")
	if err := r.db.WithContext(ctx).Model(&model.TopList{}).
		Where("trade_date = ?", today).
		Count(&todayCount).Error; err != nil {
		return nil, err
	}

	// 今日总成交额
	var todayAmount float64
	if err := r.db.WithContext(ctx).Model(&model.TopList{}).
		Where("trade_date = ?", today).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&todayAmount).Error; err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total":        total,
		"today_count":  todayCount,
		"today_amount": todayAmount,
	}, nil
}

// GetByTradeDateAndCode 根据交易日期和代码查询
func (r *TopListRepository) GetByTradeDateAndCode(ctx context.Context, tradeDate, tsCode string) (*model.TopList, error) {
	var data model.TopList
	if err := r.db.WithContext(ctx).
		Where("trade_date = ? AND ts_code = ?", tradeDate, tsCode).
		First(&data).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &data, nil
}

// GetLatestTradeDate 获取最新交易日期
func (r *TopListRepository) GetLatestTradeDate(ctx context.Context) (string, error) {
	var result struct {
		TradeDate string
	}
	if err := r.db.WithContext(ctx).Model(&model.TopList{}).
		Select("trade_date").
		Order("trade_date DESC").
		Limit(1).
		Scan(&result).Error; err != nil {
		return "", err
	}
	return result.TradeDate, nil
}
