package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"github.com/maneki/api/internal/service"
	"github.com/maneki/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupBacktestService(t *testing.T) (*service.BacktestService, *testutil.TestServer) {
	ts := testutil.NewTestServer(t)

	backtestRepo := repository.NewBacktestRepository(ts.DB)
	agentRepo := repository.NewAgentRepository(ts.DB)
	subRepo := repository.NewAgentSubscriptionRepository(ts.DB)
	userRepo := repository.NewUserRepository(ts.DB)

	svc := service.NewBacktestService(backtestRepo, agentRepo, subRepo, userRepo)
	return svc, ts
}

// TestCreateBacktest_UserNotFound 测试用户不存在时不应 panic
func TestCreateBacktest_UserNotFound(t *testing.T) {
	svc, ts := setupBacktestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	fakeUserID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	req := &service.CreateBacktestRequest{
		AgentID:   1,
		StartDate: "2026-04-01",
		EndDate:   "2026-04-07",
	}

	_, err := svc.CreateBacktest(ctx, fakeUserID, req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "用户不存在")
}

// TestCreateBacktest_NonVIP 测试非 VIP 用户被拒绝
func TestCreateBacktest_NonVIP(t *testing.T) {
	svc, ts := setupBacktestService(t)
	defer ts.Cleanup()

	ctx := context.Background()

	// 创建普通用户
	user := &model.User{
		ID:        uuid.New(),
		Nickname:  "普通用户",
		Email:     "free@example.com",
		VIPLevel:  0,
		IsActive:  true,
	}
	require.NoError(t, ts.DB.Create(user).Error)

	req := &service.CreateBacktestRequest{
		AgentID:   1,
		StartDate: "2026-04-01",
		EndDate:   "2026-04-07",
	}

	_, err := svc.CreateBacktest(ctx, user.ID, req)
	require.Error(t, err)
	assert.Equal(t, "VIP_REQUIRED", err.Error())
}

// TestCreateBacktest_VIPWithoutSubscription 测试 VIP 但未订阅 Agent
func TestCreateBacktest_VIPWithoutSubscription(t *testing.T) {
	svc, ts := setupBacktestService(t)
	defer ts.Cleanup()

	ctx := context.Background()

	// 创建 VIP 用户
	user := &model.User{
		ID:        uuid.New(),
		Nickname:  "VIP用户",
		Email:     "vip@example.com",
		VIPLevel:  1,
		IsActive:  true,
	}
	require.NoError(t, ts.DB.Create(user).Error)

	// 创建 Agent
	agent := &model.Agent{
		Name:     "测试Agent",
		Type:     "technical",
		IsActive: true,
	}
	require.NoError(t, ts.DB.Create(agent).Error)

	req := &service.CreateBacktestRequest{
		AgentID:   agent.ID,
		StartDate: "2026-04-01",
		EndDate:   "2026-04-07",
	}

	_, err := svc.CreateBacktest(ctx, user.ID, req)
	require.Error(t, err)
	assert.Equal(t, "SUBSCRIPTION_REQUIRED", err.Error())
}

// TestCreateBacktest_DateRange_Max14Days 测试日期范围不能超过14天
func TestCreateBacktest_DateRange_Max14Days(t *testing.T) {
	svc, ts := setupBacktestService(t)
	defer ts.Cleanup()

	ctx := context.Background()

	// 创建 VIP 用户
	user := &model.User{
		ID:        uuid.New(),
		Nickname:  "VIP用户",
		Email:     "vip@example.com",
		VIPLevel:  1,
		IsActive:  true,
	}
	require.NoError(t, ts.DB.Create(user).Error)

	// 创建 Agent
	agent := &model.Agent{
		Name:     "测试Agent",
		Type:     "technical",
		IsActive: true,
	}
	require.NoError(t, ts.DB.Create(agent).Error)

	// 创建订阅
	sub := &model.AgentSubscription{
		UserID:  user.ID,
		AgentID: agent.ID,
		Status:  "active",
	}
	require.NoError(t, ts.DB.Create(sub).Error)

	// 正好14天应该通过
	req14 := &service.CreateBacktestRequest{
		AgentID:   agent.ID,
		StartDate: "2026-04-01",
		EndDate:   "2026-04-15", // 15天（含两端）
	}
	_, err := svc.CreateBacktest(ctx, user.ID, req14)
	assert.Error(t, err, "15天的日期范围应该被拒绝")
	assert.Equal(t, "INVALID_DATE_RANGE", err.Error())

	// 13天应该通过
	req13 := &service.CreateBacktestRequest{
		AgentID:   agent.ID,
		StartDate: "2026-04-01",
		EndDate:   "2026-04-14", // 14天（含两端）
	}
	job, err := svc.CreateBacktest(ctx, user.ID, req13)
	require.NoError(t, err, "14天的日期范围应该被允许")
	assert.NotNil(t, job)
	assert.Equal(t, "pending", job.Status)
}

// TestCreateBacktest_EndDateBeforeStart 测试结束日期早于开始日期
func TestCreateBacktest_EndDateBeforeStart(t *testing.T) {
	svc, ts := setupBacktestService(t)
	defer ts.Cleanup()

	ctx := context.Background()

	user := &model.User{
		ID:        uuid.New(),
		Nickname:  "VIP用户",
		Email:     "vip@example.com",
		VIPLevel:  1,
		IsActive:  true,
	}
	require.NoError(t, ts.DB.Create(user).Error)

	agent := &model.Agent{
		Name:     "测试Agent",
		Type:     "technical",
		IsActive: true,
	}
	require.NoError(t, ts.DB.Create(agent).Error)

	sub := &model.AgentSubscription{
		UserID:  user.ID,
		AgentID: agent.ID,
		Status:  "active",
	}
	require.NoError(t, ts.DB.Create(sub).Error)

	req := &service.CreateBacktestRequest{
		AgentID:   agent.ID,
		StartDate: "2026-04-10",
		EndDate:   "2026-04-01",
	}

	_, err := svc.CreateBacktest(ctx, user.ID, req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "结束日期不能早于开始日期")
}

// TestCreateBacktest_ConcurrentJobProtection 测试并发回测任务保护
func TestCreateBacktest_ConcurrentJobProtection(t *testing.T) {
	svc, ts := setupBacktestService(t)
	defer ts.Cleanup()

	ctx := context.Background()

	user := &model.User{
		ID:        uuid.New(),
		Nickname:  "VIP用户",
		Email:     "vip@example.com",
		VIPLevel:  1,
		IsActive:  true,
	}
	require.NoError(t, ts.DB.Create(user).Error)

	agent := &model.Agent{
		Name:     "测试Agent",
		Type:     "technical",
		IsActive: true,
	}
	require.NoError(t, ts.DB.Create(agent).Error)

	sub := &model.AgentSubscription{
		UserID:  user.ID,
		AgentID: agent.ID,
		Status:  "active",
	}
	require.NoError(t, ts.DB.Create(sub).Error)

	// 创建第一个任务
	req := &service.CreateBacktestRequest{
		AgentID:   agent.ID,
		StartDate: "2026-04-01",
		EndDate:   "2026-04-07",
	}
	job1, err := svc.CreateBacktest(ctx, user.ID, req)
	require.NoError(t, err)
	assert.NotNil(t, job1)

	// 再创建第二个任务应该被拒绝
	_, err = svc.CreateBacktest(ctx, user.ID, req)
	require.Error(t, err)
	assert.Equal(t, "JOB_ALREADY_RUNNING", err.Error())
}

// TestCreateBacktest_Success 测试正常创建回测任务
func TestCreateBacktest_Success(t *testing.T) {
	svc, ts := setupBacktestService(t)
	defer ts.Cleanup()

	ctx := context.Background()

	user := &model.User{
		ID:        uuid.New(),
		Nickname:  "VIP用户",
		Email:     "vip@example.com",
		VIPLevel:  1,
		IsActive:  true,
	}
	require.NoError(t, ts.DB.Create(user).Error)

	agent := &model.Agent{
		Name:     "测试Agent",
		Type:     "technical",
		IsActive: true,
	}
	require.NoError(t, ts.DB.Create(agent).Error)

	sub := &model.AgentSubscription{
		UserID:  user.ID,
		AgentID: agent.ID,
		Status:  "active",
	}
	require.NoError(t, ts.DB.Create(sub).Error)

	req := &service.CreateBacktestRequest{
		AgentID:   agent.ID,
		StartDate: "2026-04-01",
		EndDate:   "2026-04-07",
	}

	job, err := svc.CreateBacktest(ctx, user.ID, req)
	require.NoError(t, err)
	assert.NotNil(t, job)
	assert.Equal(t, user.ID, job.UserID)
	assert.Equal(t, agent.ID, job.AgentID)
	assert.Equal(t, "pending", job.Status)
	assert.Equal(t, 0, job.Progress)

	// 验证参数
	startDate, ok := job.Params["start_date"].(string)
	require.True(t, ok)
	assert.Equal(t, "2026-04-01", startDate)
}

// TestCreateBacktest_VIPExpired 测试 VIP 已过期
func TestCreateBacktest_VIPExpired(t *testing.T) {
	svc, ts := setupBacktestService(t)
	defer ts.Cleanup()

	ctx := context.Background()

	past := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	user := &model.User{
		ID:          uuid.New(),
		Nickname:    "过期VIP",
		Email:       "expired@example.com",
		VIPLevel:    1,
		VIPExpireAt: &past,
		IsActive:    true,
	}
	require.NoError(t, ts.DB.Create(user).Error)

	agent := &model.Agent{
		Name:     "测试Agent",
		Type:     "technical",
		IsActive: true,
	}
	require.NoError(t, ts.DB.Create(agent).Error)

	sub := &model.AgentSubscription{
		UserID:  user.ID,
		AgentID: agent.ID,
		Status:  "active",
	}
	require.NoError(t, ts.DB.Create(sub).Error)

	req := &service.CreateBacktestRequest{
		AgentID:   agent.ID,
		StartDate: "2026-04-01",
		EndDate:   "2026-04-07",
	}

	_, err := svc.CreateBacktest(ctx, user.ID, req)
	require.Error(t, err)
	assert.Equal(t, "VIP_REQUIRED", err.Error())
}

// TestBacktest_AccessControl 测试用户不能访问其他用户的回测任务
func TestBacktest_AccessControl(t *testing.T) {
	svc, ts := setupBacktestService(t)
	defer ts.Cleanup()

	ctx := context.Background()

	// 创建用户A（VIP）
	userA := &model.User{
		ID:               uuid.New(),
		Nickname:         "用户A",
		Email:            "a@example.com",
		Phone:            "13800000001",
		VIPLevel:         1,
		IsActive:         true,
		WechatUnionid:    "unionid_a",
		WechatMpOpenid:   "mp_openid_a",
		WechatMiniOpenid: "mini_openid_a",
		WechatOpenOpenid: "openid_a",
	}
	require.NoError(t, ts.DB.Create(userA).Error)

	// 创建用户B（VIP）
	userB := &model.User{
		ID:               uuid.New(),
		Nickname:         "用户B",
		Email:            "b@example.com",
		Phone:            "13800000002",
		VIPLevel:         1,
		IsActive:         true,
		WechatUnionid:    "unionid_b",
		WechatMpOpenid:   "mp_openid_b",
		WechatMiniOpenid: "mini_openid_b",
		WechatOpenOpenid: "openid_b",
	}
	require.NoError(t, ts.DB.Create(userB).Error)

	// 创建 Agent
	agent := &model.Agent{
		Name:     "测试Agent",
		Type:     "technical",
		IsActive: true,
	}
	require.NoError(t, ts.DB.Create(agent).Error)

	// 用户A订阅
	subA := &model.AgentSubscription{
		UserID:  userA.ID,
		AgentID: agent.ID,
		Status:  "active",
	}
	require.NoError(t, ts.DB.Create(subA).Error)

	// 用户B订阅
	subB := &model.AgentSubscription{
		UserID:  userB.ID,
		AgentID: agent.ID,
		Status:  "active",
	}
	require.NoError(t, ts.DB.Create(subB).Error)

	// 用户A创建回测任务
	req := &service.CreateBacktestRequest{
		AgentID:   agent.ID,
		StartDate: "2026-04-01",
		EndDate:   "2026-04-07",
	}
	job, err := svc.CreateBacktest(ctx, userA.ID, req)
	require.NoError(t, err)
	require.NotNil(t, job)

	// 用户B尝试访问用户A的任务应该被拒绝
	_, _, _, err = svc.GetBacktestWithResult(ctx, job.ID, userB.ID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "FORBIDDEN")

	// 用户A访问自己的任务应该成功
	_, _, _, err = svc.GetBacktestWithResult(ctx, job.ID, userA.ID)
	require.NoError(t, err)
}
