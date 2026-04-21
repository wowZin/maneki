package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/maneki/api/internal/model"
)

// TopInstRepository 龙虎榜机构交易名单数据访问层
type TopInstRepository struct {
	db *gorm.DB
}

// NewTopInstRepository 创建龙虎榜机构交易名单仓库
func NewTopInstRepository(db *gorm.DB) *TopInstRepository {
	return &TopInstRepository{db: db}
}

// ListTopInstQuery 龙虎榜机构交易名单列表查询参数
type ListTopInstQuery struct {
	Page      int
	PageSize  int
	TSCode    string
	Exalter   string
	StartDate string
	EndDate   string
	MinBuy    float64
	MaxBuy    float64
}

// ListTopInstResult 龙虎榜机构交易名单列表查询结果
type ListTopInstResult struct {
	Data     []model.TopInst
	Total    int64
	Page     int
	PageSize int
}

// List 获取龙虎榜机构交易名单列表
func (r *TopInstRepository) List(ctx context.Context, query ListTopInstQuery) (*ListTopInstResult, error) {
	db := r.db.WithContext(ctx).Model(&model.TopInst{})

	// 股票代码筛选
	if query.TSCode != "" {
		db = db.Where("ts_code LIKE ?", "%"+query.TSCode+"%")
	}

	// 营业部筛选
	if query.Exalter != "" {
		db = db.Where("exalter LIKE ?", "%"+query.Exalter+"%")
	}

	// 日期范围
	if query.StartDate != "" {
		db = db.Where("trade_date >= ?", query.StartDate)
	}
	if query.EndDate != "" {
		db = db.Where("trade_date <= ?", query.EndDate)
	}

	// 买入额范围
	if query.MinBuy > 0 {
		db = db.Where("buy >= ?", query.MinBuy)
	}
	if query.MaxBuy > 0 {
		db = db.Where("buy <= ?", query.MaxBuy)
	}

	// 计算总数
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	// 分页查询
	var data []model.TopInst
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("trade_date DESC, net_buy DESC").
		Offset(offset).
		Limit(query.PageSize).
		Find(&data).Error; err != nil {
		return nil, err
	}

	return &ListTopInstResult{
		Data:     data,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
	}, nil
}

// GetByID 根据ID获取龙虎榜机构交易名单数据
func (r *TopInstRepository) GetByID(ctx context.Context, id uint) (*model.TopInst, error) {
	var data model.TopInst
	if err := r.db.WithContext(ctx).First(&data, id).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

// Delete 删除单条龙虎榜机构交易名单数据
func (r *TopInstRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&model.TopInst{}, id).Error
}

// BatchDelete 批量删除龙虎榜机构交易名单数据
func (r *TopInstRepository) BatchDelete(ctx context.Context, ids []uint) (int64, error) {
	result := r.db.WithContext(ctx).Where("id IN ?", ids).Delete(&model.TopInst{})
	return result.RowsAffected, result.Error
}

// Create 创建龙虎榜机构交易名单数据
func (r *TopInstRepository) Create(ctx context.Context, data *model.TopInst) error {
	return r.db.WithContext(ctx).Create(data).Error
}

// CreateBatch 批量创建龙虎榜机构交易名单数据
func (r *TopInstRepository) CreateBatch(ctx context.Context, dataList []*model.TopInst) error {
	return r.db.WithContext(ctx).CreateInBatches(dataList, 100).Error
}

// GetStats 获取龙虎榜机构交易名单统计
func (r *TopInstRepository) GetStats(ctx context.Context) (map[string]interface{}, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.TopInst{}).Count(&total).Error; err != nil {
		return nil, err
	}

	// 今日数据
	var todayCount int64
	today := time.Now().Format("20060102")
	if err := r.db.WithContext(ctx).Model(&model.TopInst{}).
		Where("trade_date = ?", today).
		Count(&todayCount).Error; err != nil {
		return nil, err
	}

	// 今日净买入额
	var todayNetBuy float64
	if err := r.db.WithContext(ctx).Model(&model.TopInst{}).
		Where("trade_date = ?", today).
		Select("COALESCE(SUM(net_buy), 0)").
		Scan(&todayNetBuy).Error; err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total":        total,
		"today_count":  todayCount,
		"today_net_buy": todayNetBuy,
	}, nil
}

// GetByTradeDateAndCode 根据交易日期和代码查询
func (r *TopInstRepository) GetByTradeDateAndCode(ctx context.Context, tradeDate, tsCode string) ([]model.TopInst, error) {
	var data []model.TopInst
	if err := r.db.WithContext(ctx).
		Where("trade_date = ? AND ts_code = ?", tradeDate, tsCode).
		Find(&data).Error; err != nil {
		return nil, err
	}
	return data, nil
}
