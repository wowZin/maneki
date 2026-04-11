package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/service"
)

// StockHandler 股票处理器
type StockHandler struct {
	dataProvider *service.DataProvider
}

// NewStockHandler 创建股票处理器
func NewStockHandler(dp *service.DataProvider) *StockHandler {
	return &StockHandler{dataProvider: dp}
}

// GetKLine 获取K线数据
// GET /api/v1/stocks/:code/kline?days=30
func (h *StockHandler) GetKLine(c *gin.Context) {
	code := c.Param("code")
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))

	// 获取当前用户（从JWT）
	user := getCurrentUser(c)

	klines, err := h.dataProvider.GetKLine(c.Request.Context(), user, code, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": code,
		"data": klines,
	})
}

// GetRealtimeQuote 获取实时行情
// GET /api/v1/stocks/quotes?codes=000001,000002
func (h *StockHandler) GetRealtimeQuote(c *gin.Context) {
	codesStr := c.Query("codes")
	if codesStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "codes required"})
		return
	}

	// 解析代码列表
	codes := parseCodes(codesStr)
	if len(codes) == 0 || len(codes) > 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "codes count must be 1-10"})
		return
	}

	user := getCurrentUser(c)

	quotes, err := h.dataProvider.GetRealtimeQuote(c.Request.Context(), user, codes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": quotes})
}

// SyncStock 手动同步股票数据（管理员）
// POST /api/v1/admin/stocks/:code/sync
func (h *StockHandler) SyncStock(c *gin.Context) {
	code := c.Param("code")

	if err := h.dataProvider.SyncStockData(c.Request.Context(), code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "sync started"})
}

// 辅助函数
func getCurrentUser(c *gin.Context) *model.User {
	// 实际应从JWT解析
	// 这里简化处理
	user, exists := c.Get("user")
	if exists {
		return user.(*model.User)
	}
	// 返回免费用户
	return &model.User{VIPLevel: 0}
}

func parseCodes(codesStr string) []string {
	// 实现代码分割逻辑
	return strings.Split(codesStr, ",")
}
