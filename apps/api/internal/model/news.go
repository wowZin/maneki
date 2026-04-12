package model

import (
	"time"
)

// News 新闻资讯模型
type News struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Title     string    `json:"title" gorm:"size:500;index"`                       // 新闻标题
	Content   string    `json:"content" gorm:"type:text"`                          // 新闻内容
	Source    string    `json:"source" gorm:"size:50;index"`                       // 信息来源
	SourceURL string    `json:"source_url" gorm:"size:1000"`                       // 原文链接
	NewsDate  string    `json:"news_date" gorm:"size:8;index;index:idx_source_date"` // 新闻日期 YYYYMMDD
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (News) TableName() string {
	return "news"
}

// ToResponse 转换为响应格式
func (n *News) ToResponse() map[string]interface{} {
	return map[string]interface{}{
		"id":       n.ID,
		"title":    n.Title,
		"content":  n.Content,
		"source":   n.Source,
		"url":      n.SourceURL,
		"datetime": n.NewsDate,
	}
}
