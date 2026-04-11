package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Agent struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
}

func ListAgents(c *gin.Context) {
	agents := []Agent{
		{ID: "1", Name: "技术分析助手", Description: "专业的技术分析AI", Price: 99.0},
		{ID: "2", Name: "市场情绪分析", Description: "实时情绪指标分析", Price: 149.0},
	}
	c.JSON(http.StatusOK, gin.H{"data": agents})
}

func GetAgent(c *gin.Context) {
	id := c.Param("id")
	agent := Agent{ID: id, Name: "技术分析助手", Description: "专业的技术分析AI", Price: 99.0}
	c.JSON(http.StatusOK, gin.H{"data": agent})
}
