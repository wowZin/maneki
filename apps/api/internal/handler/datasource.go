package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/repository"
)

// DatasourceHandler 数据源管理处理器
type DatasourceHandler struct {
	cfg            *config.Config
	newsRepo       *repository.NewsRepository
	topListRepo    *repository.TopListRepository
	topInstRepo    *repository.TopInstRepository
	hotMoneyRepo   *repository.HotMoneyRepository
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
func NewDatasourceHandler(cfg *config.Config, newsRepo *repository.NewsRepository, topListRepo *repository.TopListRepository, topInstRepo *repository.TopInstRepository, hotMoneyRepo *repository.HotMoneyRepository) *DatasourceHandler {
	return &DatasourceHandler{
		cfg:            cfg,
		newsRepo:       newsRepo,
		topListRepo:    topListRepo,
		topInstRepo:    topInstRepo,
		hotMoneyRepo:   hotMoneyRepo,
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
		// 格式化日期时间: YYYY-MM-dd HH:mm
		datetime := formatNewsDatetime(news.NewsDate, news.PublishTime)

		data = append(data, NewsItem{
			ID:       strconv.Itoa(int(news.ID)),
			Title:    news.Title,
			Content:  news.Content,
			Source:   news.Source,
			Datetime: datetime,
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
	// 调用 service-data 触发同步
	syncURL := h.dataServiceURL + "/api/admin/sync/news"

	// 创建 HTTP 客户端，设置超时
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// 发送 POST 请求
	resp, err := client.Post(syncURL, "application/json", bytes.NewBuffer([]byte("{}")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "调用数据服务失败: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	// 解析响应
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "解析响应失败: " + err.Error(),
		})
		return
	}

	// 检查 service-data 返回的业务码
	code, _ := result["code"].(float64)
	if code != 0 {
		message, _ := result["message"].(string)
		c.JSON(http.StatusOK, gin.H{
			"code":    -1,
			"message": "同步失败: " + message,
			"data":    result["data"],
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "同步任务已完成",
		"data":    result["data"],
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

// GetNewsById 获取单条新闻详情
func (h *DatasourceHandler) GetNewsById(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "无效的新闻ID",
		})
		return
	}

	news, err := h.newsRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "查询失败: " + err.Error(),
		})
		return
	}

	if news == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    -1,
			"message": "新闻不存在",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": NewsItem{
			ID:       strconv.Itoa(int(news.ID)),
			Title:    news.Title,
			Content:  news.Content,
			Source:   news.Source,
			Datetime: formatNewsDatetime(news.NewsDate, news.PublishTime),
			URL:      news.SourceURL,
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

// formatNewsDatetime 格式化新闻日期时间
// 将 YYYYMMDD 和 HH:MM 格式化为 YYYY-MM-dd HH:mm
func formatNewsDatetime(newsDate string, publishTime string) string {
	if len(newsDate) != 8 {
		return newsDate
	}

	// 将 YYYYMMDD 格式化为 YYYY-MM-dd
	formattedDate := newsDate[:4] + "-" + newsDate[4:6] + "-" + newsDate[6:]

	// 如果有发布时间，追加到日期后面
	if publishTime != "" {
		return formattedDate + " " + publishTime
	}

	// 默认返回日期 + 00:00
	return formattedDate + " 00:00"
}

// ========== 龙虎榜相关接口 ==========

// TopListItem 龙虎榜数据项
type TopListItem struct {
	ID            string  `json:"id"`
	TradeDate     string  `json:"trade_date"`
	TSCode        string  `json:"ts_code"`
	Name          string  `json:"name"`
	Close         float64 `json:"close"`
	PctChange     float64 `json:"pct_change"`
	Turnover      float64 `json:"turnover"`
	Amount        float64 `json:"amount"`
	NetBuyAmount  float64 `json:"net_buy_amount"`
	NetSellAmount float64 `json:"net_sell_amount"`
	Reason        string  `json:"reason"`
	Source        string  `json:"source"`
}

// GetTopList 获取龙虎榜列表
func (h *DatasourceHandler) GetTopList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	tsCode := c.Query("ts_code")
	name := c.Query("name")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	minAmount, _ := strconv.ParseFloat(c.DefaultQuery("min_amount", "0"), 64)
	maxAmount, _ := strconv.ParseFloat(c.DefaultQuery("max_amount", "0"), 64)

	// 查询数据库
	query := repository.ListTopListQuery{
		Page:      page,
		PageSize:  pageSize,
		TSCode:    tsCode,
		Name:      name,
		StartDate: startDate,
		EndDate:   endDate,
		MinAmount: minAmount,
		MaxAmount: maxAmount,
	}

	result, err := h.topListRepo.List(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "查询失败: " + err.Error(),
		})
		return
	}

	// 转换为响应格式
	var data []TopListItem
	for _, item := range result.Data {
		data = append(data, TopListItem{
			ID:            strconv.Itoa(int(item.ID)),
			TradeDate:     formatDate(item.TradeDate),
			TSCode:        item.TSCode,
			Name:          item.Name,
			Close:         item.Close,
			PctChange:     item.PctChange,
			Turnover:      item.Turnover,
			Amount:        item.Amount,
			NetBuyAmount:  item.NetBuyAmount,
			NetSellAmount: item.NetSellAmount,
			Reason:        item.Reason,
			Source:        item.Source,
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

// DeleteTopList 删除单条龙虎榜数据
func (h *DatasourceHandler) DeleteTopList(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "无效的数据ID",
		})
		return
	}

	if err := h.topListRepo.Delete(c.Request.Context(), uint(id)); err != nil {
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

// BatchDeleteTopListRequest 批量删除龙虎榜数据请求
type BatchDeleteTopListRequest struct {
	IDs []string `json:"ids" binding:"required"`
}

// BatchDeleteTopList 批量删除龙虎榜数据
func (h *DatasourceHandler) BatchDeleteTopList(c *gin.Context) {
	var req BatchDeleteTopListRequest
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

	affected, err := h.topListRepo.BatchDelete(c.Request.Context(), ids)
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

// SyncTopList 手动同步龙虎榜数据
func (h *DatasourceHandler) SyncTopList(c *gin.Context) {
	tradeDate := c.Query("trade_date")

	// 调用 service-data 触发同步
	syncURL := h.dataServiceURL + "/api/admin/sync/top-list"
	if tradeDate != "" {
		syncURL += "?trade_date=" + tradeDate
	}

	// 创建 HTTP 客户端，设置超时
	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	// 发送 POST 请求
	resp, err := client.Post(syncURL, "application/json", bytes.NewBuffer([]byte("{}")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "调用数据服务失败: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	// 解析响应
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "解析响应失败: " + err.Error(),
		})
		return
	}

	// 检查 service-data 返回的业务码
	code, _ := result["code"].(float64)
	if code != 0 {
		message, _ := result["message"].(string)
		c.JSON(http.StatusOK, gin.H{
			"code":    -1,
			"message": "同步失败: " + message,
			"data":    result["data"],
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "龙虎榜数据同步完成",
		"data":    result["data"],
	})
}

// GetTopListStats 获取龙虎榜统计
func (h *DatasourceHandler) GetTopListStats(c *gin.Context) {
	stats, err := h.topListRepo.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data": gin.H{
				"total":        0,
				"today_count":  0,
				"today_amount": 0,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    stats,
	})
}

// formatDate 将 YYYYMMDD 格式化为 YYYY-MM-dd
func formatDate(date string) string {
	if len(date) != 8 {
		return date
	}
	return date[:4] + "-" + date[4:6] + "-" + date[6:]
}

// ========== 龙虎榜机构交易名单相关接口 ==========

// TopInstItem 龙虎榜机构交易名单数据项
type TopInstItem struct {
	ID       string  `json:"id"`
	TradeDate string `json:"trade_date"`
	TSCode   string  `json:"ts_code"`
	Exalter  string  `json:"exalter"`
	Buy      float64 `json:"buy"`
	BuyRate  float64 `json:"buy_rate"`
	Sell     float64 `json:"sell"`
	SellRate float64 `json:"sell_rate"`
	NetBuy   float64 `json:"net_buy"`
	Side     string  `json:"side"`
	Reason   string  `json:"reason"`
	Source   string  `json:"source"`
}

// GetTopInstList 获取龙虎榜机构交易名单列表
func (h *DatasourceHandler) GetTopInstList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	tsCode := c.Query("ts_code")
	exalter := c.Query("exalter")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	minBuy, _ := strconv.ParseFloat(c.DefaultQuery("min_buy", "0"), 64)
	maxBuy, _ := strconv.ParseFloat(c.DefaultQuery("max_buy", "0"), 64)

	// 查询数据库
	query := repository.ListTopInstQuery{
		Page:      page,
		PageSize:  pageSize,
		TSCode:    tsCode,
		Exalter:   exalter,
		StartDate: startDate,
		EndDate:   endDate,
		MinBuy:    minBuy,
		MaxBuy:    maxBuy,
	}

	result, err := h.topInstRepo.List(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "查询失败: " + err.Error(),
		})
		return
	}

	// 转换为响应格式
	var data []TopInstItem
	for _, item := range result.Data {
		data = append(data, TopInstItem{
			ID:        strconv.Itoa(int(item.ID)),
			TradeDate: formatDate(item.TradeDate),
			TSCode:    item.TSCode,
			Exalter:   item.Exalter,
			Buy:       item.Buy,
			BuyRate:   item.BuyRate,
			Sell:      item.Sell,
			SellRate:  item.SellRate,
			NetBuy:    item.NetBuy,
			Side:      item.Side,
			Reason:    item.Reason,
			Source:    item.Source,
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

// DeleteTopInst 删除单条龙虎榜机构交易名单数据
func (h *DatasourceHandler) DeleteTopInst(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "无效的数据ID",
		})
		return
	}

	if err := h.topInstRepo.Delete(c.Request.Context(), uint(id)); err != nil {
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

// BatchDeleteTopInstRequest 批量删除龙虎榜机构交易名单数据请求
type BatchDeleteTopInstRequest struct {
	IDs []string `json:"ids" binding:"required"`
}

// BatchDeleteTopInst 批量删除龙虎榜机构交易名单数据
func (h *DatasourceHandler) BatchDeleteTopInst(c *gin.Context) {
	var req BatchDeleteTopInstRequest
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

	affected, err := h.topInstRepo.BatchDelete(c.Request.Context(), ids)
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

// SyncTopInst 手动同步龙虎榜机构交易名单数据
func (h *DatasourceHandler) SyncTopInst(c *gin.Context) {
	tradeDate := c.Query("trade_date")

	// 调用 service-data 触发同步
	syncURL := h.dataServiceURL + "/api/admin/sync/top-inst"
	if tradeDate != "" {
		syncURL += "?trade_date=" + tradeDate
	}

	// 创建 HTTP 客户端，设置超时
	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	// 发送 POST 请求
	resp, err := client.Post(syncURL, "application/json", bytes.NewBuffer([]byte("{}")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "调用数据服务失败: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	// 解析响应
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "解析响应失败: " + err.Error(),
		})
		return
	}

	// 检查 service-data 返回的业务码
	code, _ := result["code"].(float64)
	if code != 0 {
		message, _ := result["message"].(string)
		c.JSON(http.StatusOK, gin.H{
			"code":    -1,
			"message": "同步失败: " + message,
			"data":    result["data"],
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "龙虎榜机构交易名单数据同步完成",
		"data":    result["data"],
	})
}

// GetTopInstStats 获取龙虎榜机构交易名单统计
func (h *DatasourceHandler) GetTopInstStats(c *gin.Context) {
	stats, err := h.topInstRepo.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data": gin.H{
				"total":        0,
				"today_count":  0,
				"today_net_buy": 0,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    stats,
	})
}

// ========== 游资名录相关接口 ==========

// HotMoneyItem 游资名录数据项
type HotMoneyItem struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Organizations string `json:"organizations"`
	Source        string `json:"source"`
}

// GetHotMoneyList 获取游资名录列表
func (h *DatasourceHandler) GetHotMoneyList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	name := c.Query("name")

	query := repository.ListHotMoneyQuery{
		Page:     page,
		PageSize: pageSize,
		Name:     name,
	}

	result, err := h.hotMoneyRepo.List(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "查询失败: " + err.Error(),
		})
		return
	}

	var data []HotMoneyItem
	for _, item := range result.Data {
		data = append(data, HotMoneyItem{
			ID:            strconv.Itoa(int(item.ID)),
			Name:          item.Name,
			Description:   item.Description,
			Organizations: item.Organizations,
			Source:        item.Source,
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

// DeleteHotMoney 删除单条游资名录数据
func (h *DatasourceHandler) DeleteHotMoney(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "无效的数据ID",
		})
		return
	}

	if err := h.hotMoneyRepo.Delete(c.Request.Context(), uint(id)); err != nil {
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

// BatchDeleteHotMoneyRequest 批量删除游资名录数据请求
type BatchDeleteHotMoneyRequest struct {
	IDs []string `json:"ids" binding:"required"`
}

// BatchDeleteHotMoney 批量删除游资名录数据
func (h *DatasourceHandler) BatchDeleteHotMoney(c *gin.Context) {
	var req BatchDeleteHotMoneyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	var ids []uint
	for _, idStr := range req.IDs {
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			continue
		}
		ids = append(ids, uint(id))
	}

	affected, err := h.hotMoneyRepo.BatchDelete(c.Request.Context(), ids)
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

// SyncHotMoney 手动同步游资名录数据
func (h *DatasourceHandler) SyncHotMoney(c *gin.Context) {
	syncURL := h.dataServiceURL + "/api/admin/sync/hot-money"

	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	resp, err := client.Post(syncURL, "application/json", bytes.NewBuffer([]byte("{}")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "调用数据服务失败: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "解析响应失败: " + err.Error(),
		})
		return
	}

	code, _ := result["code"].(float64)
	if code != 0 {
		message, _ := result["message"].(string)
		c.JSON(http.StatusOK, gin.H{
			"code":    -1,
			"message": "同步失败: " + message,
			"data":    result["data"],
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "游资名录数据同步完成",
		"data":    result["data"],
	})
}

// GetHotMoneyStats 获取游资名录统计
func (h *DatasourceHandler) GetHotMoneyStats(c *gin.Context) {
	stats, err := h.hotMoneyRepo.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data": gin.H{
				"total": 0,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    stats,
	})
}
