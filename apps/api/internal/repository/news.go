package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/maneki/api/internal/model"
)

// NewsRepository 新闻数据访问层
type NewsRepository struct {
	db *gorm.DB
}

// NewNewsRepository 创建新闻仓库
func NewNewsRepository(db *gorm.DB) *NewsRepository {
	return &NewsRepository{db: db}
}

// ListNewsQuery 新闻列表查询参数
type ListNewsQuery struct {
	Page      int
	PageSize  int
	Keyword   string
	Source    string
	StartDate string
	EndDate   string
}

// ListNewsResult 新闻列表查询结果
type ListNewsResult struct {
	Data     []model.News
	Total    int64
	Page     int
	PageSize int
}

// List 获取新闻列表
func (r *NewsRepository) List(ctx context.Context, query ListNewsQuery) (*ListNewsResult, error) {
	db := r.db.WithContext(ctx).Model(&model.News{})

	// 关键词搜索
	if query.Keyword != "" {
		db = db.Where("title LIKE ? OR content LIKE ?", 
			"%"+query.Keyword+"%", "%"+query.Keyword+"%")
	}

	// 来源筛选
	if query.Source != "" {
		db = db.Where("source = ?", query.Source)
	}

	// 日期范围
	if query.StartDate != "" {
		db = db.Where("news_date >= ?", query.StartDate)
	}
	if query.EndDate != "" {
		db = db.Where("news_date <= ?", query.EndDate)
	}

	// 计算总数
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	// 分页查询
	var news []model.News
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("news_date DESC, id DESC").
		Offset(offset).
		Limit(query.PageSize).
		Find(&news).Error; err != nil {
		return nil, err
	}

	return &ListNewsResult{
		Data:     news,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
	}, nil
}

// GetByID 根据ID获取新闻
func (r *NewsRepository) GetByID(ctx context.Context, id uint) (*model.News, error) {
	var news model.News
	if err := r.db.WithContext(ctx).First(&news, id).Error; err != nil {
		return nil, err
	}
	return &news, nil
}

// Delete 删除单条新闻
func (r *NewsRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&model.News{}, id).Error
}

// BatchDelete 批量删除新闻
func (r *NewsRepository) BatchDelete(ctx context.Context, ids []uint) (int64, error) {
	result := r.db.WithContext(ctx).Where("id IN ?", ids).Delete(&model.News{})
	return result.RowsAffected, result.Error
}

// Create 创建新闻
func (r *NewsRepository) Create(ctx context.Context, news *model.News) error {
	return r.db.WithContext(ctx).Create(news).Error
}

// CreateBatch 批量创建新闻
func (r *NewsRepository) CreateBatch(ctx context.Context, newsList []*model.News) error {
	return r.db.WithContext(ctx).CreateInBatches(newsList, 100).Error
}

// GetStats 获取新闻统计
func (r *NewsRepository) GetStats(ctx context.Context) (map[string]interface{}, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.News{}).Count(&total).Error; err != nil {
		return nil, err
	}

	// 今日新增
	var todayCount int64
	today := time.Now().Format("20060102")
	if err := r.db.WithContext(ctx).Model(&model.News{}).
		Where("news_date = ?", today).
		Count(&todayCount).Error; err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total":       total,
		"today_count": todayCount,
	}, nil
}
