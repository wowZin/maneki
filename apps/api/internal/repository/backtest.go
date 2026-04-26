package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maneki/api/internal/model"
	"gorm.io/gorm"
)

// BacktestRepository 回测数据访问层
type BacktestRepository struct {
	db *gorm.DB
}

// NewBacktestRepository 创建回测仓库
func NewBacktestRepository(db *gorm.DB) *BacktestRepository {
	return &BacktestRepository{db: db}
}

// CreateJob 创建回测任务
func (r *BacktestRepository) CreateJob(ctx context.Context, job *model.BacktestJob) error {
	return r.db.WithContext(ctx).Create(job).Error
}

// GetJobByID 根据ID获取回测任务
func (r *BacktestRepository) GetJobByID(ctx context.Context, id uint) (*model.BacktestJob, error) {
	var job model.BacktestJob
	if err := r.db.WithContext(ctx).First(&job, id).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

// UpdateJob 更新回测任务
func (r *BacktestRepository) UpdateJob(ctx context.Context, job *model.BacktestJob) error {
	return r.db.WithContext(ctx).Save(job).Error
}

// UpdateJobStatus 更新回测任务状态和进度
func (r *BacktestRepository) UpdateJobStatus(ctx context.Context, id uint, status string, progress int, errorMsg string) error {
	updates := map[string]interface{}{
		"status":   status,
		"progress": progress,
	}
	if errorMsg != "" {
		updates["error_msg"] = errorMsg
	}
	if status == "running" {
		now := time.Now()
		updates["started_at"] = &now
	}
	if status == "completed" || status == "failed" {
		now := time.Now()
		updates["completed_at"] = &now
	}
	return r.db.WithContext(ctx).Model(&model.BacktestJob{}).Where("id = ?", id).Updates(updates).Error
}

// UpdateJobProgress 仅更新进度
func (r *BacktestRepository) UpdateJobProgress(ctx context.Context, id uint, progress int) error {
	return r.db.WithContext(ctx).Model(&model.BacktestJob{}).Where("id = ?", id).Update("progress", progress).Error
}

// GetPendingJobs 获取待执行的回测任务
func (r *BacktestRepository) GetPendingJobs(ctx context.Context, limit int) ([]model.BacktestJob, error) {
	var jobs []model.BacktestJob
	if err := r.db.WithContext(ctx).
		Where("status = ?", "pending").
		Order("created_at ASC").
		Limit(limit).
		Find(&jobs).Error; err != nil {
		return nil, err
	}
	return jobs, nil
}

// ListUserJobs 列出用户的回测任务历史
func (r *BacktestRepository) ListUserJobs(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.BacktestJob, int64, error) {
	var jobs []model.BacktestJob
	var total int64

	if err := r.db.WithContext(ctx).Model(&model.BacktestJob{}).
		Where("user_id = ?", userID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&jobs).Error; err != nil {
		return nil, 0, err
	}

	return jobs, total, nil
}

// HasRunningJob 检查用户是否有正在运行的回测任务（针对同一Agent）
func (r *BacktestRepository) HasRunningJob(ctx context.Context, userID uuid.UUID, agentID uint) (bool, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.BacktestJob{}).
		Where("user_id = ? AND agent_id = ? AND status IN (?)", userID, agentID, []string{"pending", "running"}).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// CreateResult 创建回测结果
func (r *BacktestRepository) CreateResult(ctx context.Context, result *model.BacktestResult) error {
	return r.db.WithContext(ctx).Create(result).Error
}

// GetResultByJobID 根据任务ID获取回测结果
func (r *BacktestRepository) GetResultByJobID(ctx context.Context, jobID uint) (*model.BacktestResult, error) {
	var result model.BacktestResult
	if err := r.db.WithContext(ctx).Where("job_id = ?", jobID).First(&result).Error; err != nil {
		return nil, err
	}
	return &result, nil
}

// CreateDayResults 批量创建按天回测结果
func (r *BacktestRepository) CreateDayResults(ctx context.Context, dayResults []model.BacktestDayResult) error {
	if len(dayResults) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(dayResults, 100).Error
}

// GetDayResultsByResultID 获取某回测结果的按天详情
func (r *BacktestRepository) GetDayResultsByResultID(ctx context.Context, resultID uint) ([]model.BacktestDayResult, error) {
	var results []model.BacktestDayResult
	if err := r.db.WithContext(ctx).
		Where("result_id = ?", resultID).
		Order("date ASC").
		Find(&results).Error; err != nil {
		return nil, err
	}
	return results, nil
}

// GetAgentNameByID 根据AgentID获取Agent名称
func (r *BacktestRepository) GetAgentNameByID(ctx context.Context, agentID uint) (string, error) {
	var agent model.Agent
	if err := r.db.WithContext(ctx).Select("name").First(&agent, agentID).Error; err != nil {
		return "", err
	}
	return agent.Name, nil
}

// GetSignalsWithDecisionsByDate 获取某日期范围内某agent_type的信号及决策（用于回测计算）
func (r *BacktestRepository) GetSignalsWithDecisionsByDate(ctx context.Context, agentType string, startDate, endDate time.Time) ([]model.Signal, error) {
	var signals []model.Signal
	if err := r.db.WithContext(ctx).
		Preload("Decisions", "agent_type = ?", agentType).
		Preload("Stock").
		Where("signal_type = ? AND DATE(created_at) BETWEEN ? AND ?", "watch", startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).
		Order("created_at ASC").
		Find(&signals).Error; err != nil {
		return nil, err
	}
	return signals, nil
}

// GetSignalsByAgentAndDateRange 按agent_id关联的agent_type查询信号（回测计算）
func (r *BacktestRepository) GetSignalsByAgentAndDateRange(ctx context.Context, agentID uint, startDate, endDate time.Time) ([]model.Signal, error) {
	// 先获取Agent的type
	var agent model.Agent
	if err := r.db.WithContext(ctx).Select("type").First(&agent, agentID).Error; err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}
	return r.GetSignalsWithDecisionsByDate(ctx, agent.Type, startDate, endDate)
}
