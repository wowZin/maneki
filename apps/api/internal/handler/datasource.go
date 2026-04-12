package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/repository"
)

// DatasourceHandler 数据源管理处理器
type DatasourceHandler struct {
	cfg        *config.Config
	newsRepo   *repository.NewsRepository
	dataServiceURL string
}

// NewsItem 新闻项
type NewsItem struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Content  string `json:"content"`
	Source   string `json:"source"`
	Datetime string `json:"datetime"`
	URL      string `json:"url,omitempty"`
}

// NewDatasourceHandler 创建数据源管理处理器
func NewDatasourceHandler(cfg *config.Config, newsRepo *repository.NewsRepository) *DatasourceHandler {
	return &DatasourceHandler{
		cfg:        cfg,
		newsRepo:   newsRepo,
		dataServiceURL: cfg.DataSource.DataServiceURL,
	}
}

// GetNewsList 获取新闻列表
func (h *DatasourceHandler) GetNewsList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	keyword := c.Query("keyword")
	source := c.Query("source")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")

	// 查询数据库
	query := repository.ListNewsQuery{
		Page:      page,
		PageSize:  pageSize,
		Keyword:   keyword,
		Source:    source,
		StartDate: startDate,
		EndDate:   endDate,
	}

	result, err := h.newsRepo.List(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "查询失败: " + err.Error(),
		})
		return
	}

	// 转换为响应格式
	var data []NewsItem
	for _, news := range result.Data {
		data = append(data, NewsItem{
			ID:       strconv.Itoa(int(news.ID)),
			Title:    news.Title,
			Content:  news.Content,
			Source:   news.Source,
			Datetime: news.NewsDate,
			URL:      news.SourceURL,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"code":     0,
		"message":  "success",
		"data":     data,
		"total":    result.Total,
		"page":     result.Page,
		"pageSize": result.PageSize,
	})
}

// DeleteNews 删除单条新闻
func (h *DatasourceHandler) DeleteNews(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "无效的新闻ID",
		})
		return
	}

	if err := h.newsRepo.Delete(c.Request.Context(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "删除失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "删除成功",
	})
}

// BatchDeleteNewsRequest 批量删除新闻请求
type BatchDeleteNewsRequest struct {
	IDs []string `json:"ids" binding:"required"`
}

// BatchDeleteNews 批量删除新闻
func (h *DatasourceHandler) BatchDeleteNews(c *gin.Context) {
	var req BatchDeleteNewsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 转换 ID 列表
	var ids []uint
	for _, idStr := range req.IDs {
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			continue
		}
		ids = append(ids, uint(id))
	}

	affected, err := h.newsRepo.BatchDelete(c.Request.Context(), ids)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "批量删除失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "批量删除成功",
		"count":   affected,
	})
}

// SyncNews 手动同步新闻
func (h *DatasourceHandler) SyncNews(c *gin.Context) {
	// TODO: 通过 HTTP 调用 data-service 触发同步
	// 或者将同步任务加入消息队列

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "同步任务已触发",
	})
}

// GetDataSourceStatus 获取数据源状态
func (h *DatasourceHandler) GetDataSourceStatus(c *gin.Context) {
	// 检查 data-service 是否可用
	// TODO: 实现健康检查逻辑

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"tushare": "available",
			"akshare": "available",
			"redis":   "connected",
			"db":      "connected",
		},
	})
}

// GetStats 获取数据统计
func (h *DatasourceHandler) GetStats(c *gin.Context) {
	// 获取新闻统计
	newsStats, err := h.newsRepo.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data": gin.H{
				"news_total":      0,
				"news_today":      0,
				"kline_records":   0,
				"last_sync_time":  time.Now().Format("2006-01-02 15:04:05"),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"news_total":      newsStats["total"],
			"news_today":      newsStats["today_count"],
			"kline_records":   0, // TODO: 从 KLine 表获取
			"last_sync_time":  time.Now().Format("2006-01-02 15:04:05"),
		},
	})
}
