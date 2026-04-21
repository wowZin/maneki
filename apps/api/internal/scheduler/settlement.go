package scheduler

import (
	"context"
	"log"
	"time"

	"github.com/maneki/api/internal/repository"
)

// SettlementScheduler T+1 结算定时任务
type SettlementScheduler struct {
	recordRepo *repository.RebateRecordRepository
	stopCh     chan struct{}
}

// NewSettlementScheduler 创建结算调度器
func NewSettlementScheduler(recordRepo *repository.RebateRecordRepository) *SettlementScheduler {
	return &SettlementScheduler{
		recordRepo: recordRepo,
		stopCh:     make(chan struct{}),
	}
}

// Start 启动定时任务（每小时检查一次，在每天 02:00 执行结算）
func (s *SettlementScheduler) Start() {
	go s.loop()
}

// Stop 停止定时任务
func (s *SettlementScheduler) Stop() {
	close(s.stopCh)
}

func (s *SettlementScheduler) loop() {
	// 首次运行时立即执行一次
	s.runSettlement()

	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// 在每天 02:00-02:59 之间执行
			if time.Now().Hour() == 2 {
				s.runSettlement()
			}
		case <-s.stopCh:
			return
		}
	}
}

func (s *SettlementScheduler) runSettlement() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// T+1 结算：结算昨天及之前创建的 pending 记录
	before := time.Now().Truncate(24 * time.Hour)

	records, err := s.recordRepo.GetPendingForSettlement(ctx, before)
	if err != nil {
		log.Printf("[Settlement] Failed to get pending records: %v", err)
		return
	}
	if len(records) == 0 {
		return
	}

	ids := make([]uint, 0, len(records))
	for _, r := range records {
		ids = append(ids, r.ID)
	}

	if err := s.recordRepo.BatchSettle(ctx, ids); err != nil {
		log.Printf("[Settlement] Failed to settle %d records: %v", len(ids), err)
		return
	}

	log.Printf("[Settlement] Successfully settled %d records", len(ids))
}
