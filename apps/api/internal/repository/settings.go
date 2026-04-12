package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"gorm.io/gorm"

	"github.com/maneki/api/internal/model"
)

// SettingsRepository 设置数据访问层
type SettingsRepository struct {
	db *gorm.DB
}

// NewSettingsRepository 创建设置仓库
func NewSettingsRepository(db *gorm.DB) *SettingsRepository {
	return &SettingsRepository{db: db}
}

// Get 获取设置值
func (r *SettingsRepository) Get(ctx context.Context, settingsType string, key string) (*model.Settings, error) {
	var settings model.Settings
	if err := r.db.WithContext(ctx).Where("type = ? AND key = ?", settingsType, key).First(&settings).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &settings, nil
}

// GetJSON 获取设置值并解析为JSON
func (r *SettingsRepository) GetJSON(ctx context.Context, settingsType string, key string, v interface{}) error {
	settings, err := r.Get(ctx, settingsType, key)
	if err != nil {
		return err
	}
	if settings == nil {
		return fmt.Errorf("settings not found: %s.%s", settingsType, key)
	}
	return json.Unmarshal([]byte(settings.Value), v)
}

// Set 设置值
func (r *SettingsRepository) Set(ctx context.Context, settingsType string, key string, value interface{}) error {
	// 序列化为JSON
	valueBytes, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	// 检查是否已存在
	var existing model.Settings
	result := r.db.WithContext(ctx).Where("type = ? AND key = ?", settingsType, key).First(&existing)

	if result.Error == nil {
		// 更新
		existing.Value = string(valueBytes)
		return r.db.WithContext(ctx).Save(&existing).Error
	}

	if result.Error == gorm.ErrRecordNotFound {
		// 创建
		settings := model.Settings{
			Type:  settingsType,
			Key:   key,
			Value: string(valueBytes),
		}
		return r.db.WithContext(ctx).Create(&settings).Error
	}

	return result.Error
}

// GetNewsSyncSettings 获取新闻同步设置
func (r *SettingsRepository) GetNewsSyncSettings(ctx context.Context) (*model.NewsSyncSettings, error) {
	var settings model.NewsSyncSettings
	
	// 尝试从数据库获取
	if err := r.GetJSON(ctx, "news_sync", "config", &settings); err != nil {
		// 如果没有设置，返回默认值
		return r.GetDefaultNewsSyncSettings(), nil
	}
	
	return &settings, nil
}

// GetDefaultNewsSyncSettings 获取默认新闻同步设置
func (r *SettingsRepository) GetDefaultNewsSyncSettings() *model.NewsSyncSettings {
	return &model.NewsSyncSettings{
		TimeMode:      "interval",
		IntervalHours: 1,
		Sources:       []string{"global_futu", "global_ths", "global_cls", "global_sina"},
	}
}

// SaveNewsSyncSettings 保存新闻同步设置
func (r *SettingsRepository) SaveNewsSyncSettings(ctx context.Context, settings *model.NewsSyncSettings) error {
	return r.Set(ctx, "news_sync", "config", settings)
}
