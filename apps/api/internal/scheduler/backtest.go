package scheduler

import (
	"context"
	"log"
	"time"

	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"github.com/maneki/api/internal/service"
)

// BacktestScheduler 回测任务调度器
type BacktestScheduler struct {
	backtestRepo *repository.BacktestRepository
	backtestSvc  *service.BacktestService
	stopCh       chan struct{}
}

// NewBacktestScheduler 创建回测调度器
func NewBacktestScheduler(backtestRepo *repository.BacktestRepository, backtestSvc *service.BacktestService) *BacktestScheduler {
	return &BacktestScheduler{
		backtestRepo: backtestRepo,
		backtestSvc:  backtestSvc,
		stopCh:       make(chan struct{}),
	}
}

// Start 启动调度器
func (s *BacktestScheduler) Start() {
	go s.loop()
}

// Stop 停止调度器
func (s *BacktestScheduler) Stop() {
	close(s.stopCh)
}

func (s *BacktestScheduler) loop() {
	// 首次立即执行一次
	s.pollAndRun()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.pollAndRun()
		case <-s.stopCh:
			return
		}
	}
}

func (s *BacktestScheduler) pollAndRun() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	jobs, err := s.backtestRepo.GetPendingJobs(ctx, 5)
	if err != nil {
		log.Printf("[Backtest] Failed to get pending jobs: %v", err)
		return
	}
	if len(jobs) == 0 {
		return
	}

	for _, job := range jobs {
		jobCopy := job
		s.processJob(ctx, &jobCopy)
	}
}

// processJob 处理单个回测任务
func (s *BacktestScheduler) processJob(ctx context.Context, job *model.BacktestJob) {
	log.Printf("[Backtest] Processing job %d for agent %d", job.ID, job.AgentID)

	// 更新状态为 running
	if err := s.backtestRepo.UpdateJobStatus(ctx, job.ID, "running", 0, ""); err != nil {
		log.Printf("[Backtest] Failed to update job %d to running: %v", job.ID, err)
		return
	}

	if err := s.backtestSvc.RunBacktestForJob(ctx, job); err != nil {
		log.Printf("[Backtest] Job %d failed: %v", job.ID, err)
		_ = s.backtestRepo.UpdateJobStatus(ctx, job.ID, "failed", job.Progress, err.Error())
		return
	}

	log.Printf("[Backtest] Job %d completed", job.ID)
}
