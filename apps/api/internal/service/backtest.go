package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
)

// BacktestService 回测服务
type BacktestService struct {
	backtestRepo *repository.BacktestRepository
	agentRepo    *repository.AgentRepository
	subRepo      *repository.AgentSubscriptionRepository
	userRepo     *repository.UserRepository
}

// NewBacktestService 创建回测服务
func NewBacktestService(
	backtestRepo *repository.BacktestRepository,
	agentRepo *repository.AgentRepository,
	subRepo *repository.AgentSubscriptionRepository,
	userRepo *repository.UserRepository,
) *BacktestService {
	return &BacktestService{
		backtestRepo: backtestRepo,
		agentRepo:    agentRepo,
		subRepo:      subRepo,
		userRepo:     userRepo,
	}
}

// CreateBacktestRequest 创建回测请求
type CreateBacktestRequest struct {
	AgentID   uint   `json:"agent_id"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

// CreateBacktest 创建回测任务（校验VIP、订阅、日期范围等）
func (s *BacktestService) CreateBacktest(ctx context.Context, userID uuid.UUID, req *CreateBacktestRequest) (*model.BacktestJob, error) {
	// 1. 校验VIP
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("用户不存在")
	}
	if user == nil {
		return nil, fmt.Errorf("用户不存在")
	}
	if !user.IsVIP() {
		return nil, fmt.Errorf("VIP_REQUIRED")
	}

	// 2. 校验订阅
	hasSub, err := s.subRepo.CheckExistingSubscription(ctx, userID, req.AgentID)
	if err != nil {
		return nil, err
	}
	if !hasSub {
		return nil, fmt.Errorf("SUBSCRIPTION_REQUIRED")
	}

	// 3. 校验日期范围
	start, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		return nil, fmt.Errorf("开始日期格式错误")
	}
	end, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		return nil, fmt.Errorf("结束日期格式错误")
	}
	if end.Before(start) {
		return nil, fmt.Errorf("结束日期不能早于开始日期")
	}
	maxEnd := start.AddDate(0, 0, 13)
	if end.After(maxEnd) {
		return nil, fmt.Errorf("INVALID_DATE_RANGE")
	}

	// 4. 检查是否已有运行中的任务
	hasRunning, err := s.backtestRepo.HasRunningJob(ctx, userID, req.AgentID)
	if err != nil {
		return nil, err
	}
	if hasRunning {
		return nil, fmt.Errorf("JOB_ALREADY_RUNNING")
	}

	// 5. 创建任务
	params := model.BacktestParams{
		StartDate: req.StartDate,
		EndDate:   req.EndDate,
	}
	paramsJSON, _ := json.Marshal(params)
	paramsMap := make(map[string]interface{})
	_ = json.Unmarshal(paramsJSON, &paramsMap)

	job := &model.BacktestJob{
		UserID:  userID,
		AgentID: req.AgentID,
		Status:  "pending",
		Params:  paramsMap,
	}
	if err := s.backtestRepo.CreateJob(ctx, job); err != nil {
		return nil, err
	}
	return job, nil
}

// ListUserBacktests 列出用户回测历史
func (s *BacktestService) ListUserBacktests(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.BacktestJob, int64, error) {
	return s.backtestRepo.ListUserJobs(ctx, userID, limit, offset)
}

// GetBacktest 获取回测任务详情（带用户权限校验）
func (s *BacktestService) GetBacktest(ctx context.Context, id uint, userID uuid.UUID) (*model.BacktestJob, error) {
	job, err := s.backtestRepo.GetJobByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if job.UserID != userID {
		return nil, fmt.Errorf("FORBIDDEN")
	}
	return job, nil
}

// GetAgentName 获取Agent名称
func (s *BacktestService) GetAgentName(ctx context.Context, agentID uint) (string, error) {
	return s.backtestRepo.GetAgentNameByID(ctx, agentID)
}

// GetBacktestWithResult 获取回测任务及结果（带用户权限校验）
func (s *BacktestService) GetBacktestWithResult(ctx context.Context, id uint, userID uuid.UUID) (*model.BacktestJob, *model.BacktestResult, []model.BacktestDayResult, error) {
	job, err := s.backtestRepo.GetJobByID(ctx, id)
	if err != nil {
		return nil, nil, nil, err
	}

	if job.UserID != userID {
		return nil, nil, nil, fmt.Errorf("FORBIDDEN")
	}

	if job.Status != "completed" {
		return job, nil, nil, nil
	}

	result, err := s.backtestRepo.GetResultByJobID(ctx, id)
	if err != nil {
		return job, nil, nil, nil
	}

	days, err := s.backtestRepo.GetDayResultsByResultID(ctx, result.ID)
	if err != nil {
		return job, result, nil, err
	}

	return job, result, days, nil
}

// RunBacktestForJob 执行回测计算（由scheduler调用）
func (s *BacktestService) RunBacktestForJob(ctx context.Context, job *model.BacktestJob) error {
	// 解析参数
	startDateStr, _ := job.Params["start_date"].(string)
	endDateStr, _ := job.Params["end_date"].(string)
	startDate, _ := time.Parse("2006-01-02", startDateStr)
	endDate, _ := time.Parse("2006-01-02", endDateStr)

	// 获取Agent类型对应的信号和决策
	signals, err := s.backtestRepo.GetSignalsByAgentAndDateRange(ctx, job.AgentID, startDate, endDate)
	if err != nil {
		return fmt.Errorf("获取信号数据失败: %w", err)
	}

	// 按日期分组信号
	type dayKey string
	signalsByDay := make(map[dayKey][]model.Signal)
	for _, sig := range signals {
		dk := dayKey(sig.CreatedAt.Format("2006-01-02"))
		signalsByDay[dk] = append(signalsByDay[dk], sig)
	}

	// 生成日期列表（包含无信号的日期）
	var dateList []time.Time
	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		dateList = append(dateList, d)
	}

	totalDays := len(dateList)
	if totalDays == 0 {
		totalDays = 1
	}

	var dayResults []model.BacktestDayResult
	var totalSignals, totalHit, totalMiss int

	for i, d := range dateList {
		dk := dayKey(d.Format("2006-01-02"))
		daySignals := signalsByDay[dk]

		var dayHit, dayMiss int
		var details []model.BacktestDetailItem

		for _, sig := range daySignals {
			for _, dec := range sig.Decisions {
				hit := sig.IsValid
				detail := model.BacktestDetailItem{
					StockCode: sig.Code,
					StockName: "",
					Decision:  dec.Decision,
					Score:     0,
					Reasoning: dec.Reasoning,
					ActualHit: hit,
				}
				if dec.Score != nil {
					detail.Score = *dec.Score
				}
				if sig.Stock.Name != "" {
					detail.StockName = sig.Stock.Name
				}
				details = append(details, detail)

				if hit {
					dayHit++
				} else {
					dayMiss++
				}
			}
		}

		dayTotal := dayHit + dayMiss
		hitRate := 0.0
		if dayTotal > 0 {
			hitRate = float64(dayHit) / float64(dayTotal)
		}

		dayResults = append(dayResults, model.BacktestDayResult{
			Date:         d,
			TotalSignals: dayTotal,
			HitCount:     dayHit,
			MissCount:    dayMiss,
			HitRate:      hitRate,
			Details:      detailsToJSON(details),
		})

		totalSignals += dayTotal
		totalHit += dayHit
		totalMiss += dayMiss

		// 更新进度
		progress := int(float64(i+1) / float64(totalDays) * 100)
		if progress > 100 {
			progress = 100
		}
		_ = s.backtestRepo.UpdateJobProgress(ctx, job.ID, progress)
	}

	overallHitRate := 0.0
	if totalSignals > 0 {
		overallHitRate = float64(totalHit) / float64(totalSignals)
	}

	// 保存结果
	result := &model.BacktestResult{
		JobID:          job.ID,
		AgentID:        job.AgentID,
		TotalDays:      totalDays,
		TotalSignals:   totalSignals,
		TotalHit:       totalHit,
		TotalMiss:      totalMiss,
		OverallHitRate: overallHitRate,
	}
	if err := s.backtestRepo.CreateResult(ctx, result); err != nil {
		return fmt.Errorf("保存回测结果失败: %w", err)
	}

	// 保存按天结果
	for i := range dayResults {
		dayResults[i].ResultID = result.ID
	}
	if err := s.backtestRepo.CreateDayResults(ctx, dayResults); err != nil {
		return fmt.Errorf("保存按天结果失败: %w", err)
	}

	// 更新任务状态为完成
	if err := s.backtestRepo.UpdateJobStatus(ctx, job.ID, "completed", 100, ""); err != nil {
		return fmt.Errorf("更新任务状态失败: %w", err)
	}

	return nil
}

func detailsToJSON(details []model.BacktestDetailItem) []byte {
	if len(details) == 0 {
		return nil
	}
	bytes, _ := json.Marshal(details)
	return bytes
}
