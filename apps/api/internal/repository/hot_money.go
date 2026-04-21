package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/maneki/api/internal/model"
)

// HotMoneyRepository 游资名录数据访问层
type HotMoneyRepository struct {
	db *gorm.DB
}

// NewHotMoneyRepository 创建游资名录仓库
func NewHotMoneyRepository(db *gorm.DB) *HotMoneyRepository {
	return &HotMoneyRepository{db: db}
}

// ListHotMoneyQuery 游资名录列表查询参数
type ListHotMoneyQuery struct {
	Page     int
	PageSize int
	Name     string
}

// ListHotMoneyResult 游资名录列表查询结果
type ListHotMoneyResult struct {
	Data     []model.HotMoney
	Total    int64
	Page     int
	PageSize int
}

// List 获取游资名录列表
func (r *HotMoneyRepository) List(ctx context.Context, query ListHotMoneyQuery) (*ListHotMoneyResult, error) {
	db := r.db.WithContext(ctx).Model(&model.HotMoney{})

	// 名称筛选
	if query.Name != "" {
		db = db.Where("name LIKE ?", "%"+query.Name+"%")
	}

	// 计算总数
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	// 分页查询
	var data []model.HotMoney
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("id DESC").
		Offset(offset).
		Limit(query.PageSize).
		Find(&data).Error; err != nil {
		return nil, err
	}

	return &ListHotMoneyResult{
		Data:     data,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
	}, nil
}

// GetByID 根据ID获取游资名录数据
func (r *HotMoneyRepository) GetByID(ctx context.Context, id uint) (*model.HotMoney, error) {
	var data model.HotMoney
	if err := r.db.WithContext(ctx).First(&data, id).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

// Delete 删除单条游资名录数据
func (r *HotMoneyRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&model.HotMoney{}, id).Error
}

// BatchDelete 批量删除游资名录数据
func (r *HotMoneyRepository) BatchDelete(ctx context.Context, ids []uint) (int64, error) {
	result := r.db.WithContext(ctx).Where("id IN ?", ids).Delete(&model.HotMoney{})
	return result.RowsAffected, result.Error
}

// Create 创建游资名录数据
func (r *HotMoneyRepository) Create(ctx context.Context, data *model.HotMoney) error {
	return r.db.WithContext(ctx).Create(data).Error
}

// CreateBatch 批量创建游资名录数据
func (r *HotMoneyRepository) CreateBatch(ctx context.Context, dataList []*model.HotMoney) error {
	return r.db.WithContext(ctx).CreateInBatches(dataList, 100).Error
}

// GetStats 获取游资名录统计
func (r *HotMoneyRepository) GetStats(ctx context.Context) (map[string]interface{}, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.HotMoney{}).Count(&total).Error; err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total": total,
	}, nil
}
