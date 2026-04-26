# Feature Specification: Agent Backtest

**Feature Branch**: `014-agent-backtest`  
**Created**: 2026-04-26  
**Status**: Draft  
**Input**: User description: "基于release新建分支开发回测功能，回测不需要单独的菜单（仅对vip及以上用户开放），回测主要是对订购和管理agent的时候使用，例如订购了agent市场的agent，跳转到agent管理页面，然后在agent管理页面开放出回测按钮，点击跳转到回测页；回测支持最大回测近14天的涨停的股票数据（注意不是所有的股票数据）；回测是一个异步长任务的，回测结果按天展示，展示回测进度和友好提示"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trigger Backtest from Agent Management (Priority: P1)

As a VIP user who has subscribed to an agent from the marketplace, I want to run a backtest on that agent so that I can evaluate its historical performance before relying on it for live predictions.

**Why this priority**: This is the entry point of the backtest feature. Without a clear way to initiate backtesting from the agent management context, the feature is undiscoverable.

**Independent Test**: Can be fully tested by subscribing to an agent, navigating to the agent management page, clicking the backtest button, and verifying the backtest page loads with the correct agent context.

**Acceptance Scenarios**:

1. **Given** a VIP user has subscribed to an agent, **When** they navigate to the agent management page, **Then** a "回测" button is visible for that agent.
2. **Given** a non-VIP user has subscribed to an agent, **When** they navigate to the agent management page, **Then** the backtest button is hidden or disabled with a VIP upgrade prompt.
3. **Given** a VIP user clicks the backtest button, **When** the system processes the request, **Then** the user is navigated to the backtest page with the agent pre-selected.

---

### User Story 2 - Configure and Run Backtest (Priority: P1)

As a VIP user on the backtest page, I want to configure the backtest parameters and start an asynchronous backtest job so that I can evaluate the agent against recent historical limit-up data.

**Why this priority**: This is the core of the feature. The configuration and execution must be intuitive and handle the async nature gracefully.

**Independent Test**: Can be fully tested by selecting a date range (up to 14 days), starting the backtest, and verifying the job is accepted and a progress indicator appears.

**Acceptance Scenarios**:

1. **Given** the backtest page is loaded, **When** the user selects a date range within the last 14 days, **Then** the system accepts the configuration.
2. **Given** the user selects a date range exceeding 14 days, **When** they attempt to start the backtest, **Then** the system rejects it with a clear error message.
3. **Given** valid parameters, **When** the user clicks "开始回测", **Then** an async backtest job is created and the UI transitions to a progress view.

---

### User Story 3 - View Backtest Progress (Priority: P2)

As a VIP user who has started a backtest, I want to see real-time progress updates with friendly hints so that I understand the system is working and know when to expect results.

**Why this priority**: Since backtest is a long-running async task, progress visibility prevents user anxiety and reduces support requests.

**Independent Test**: Can be fully tested by starting a backtest and observing the progress bar / status messages update over time.

**Acceptance Scenarios**:

1. **Given** a backtest job is running, **When** the user views the backtest page, **Then** they see a progress indicator (percentage or step-based) and a friendly status message.
2. **Given** the backtest job completes, **When** the user is on the page, **Then** the UI automatically transitions to the results view without requiring manual refresh.
3. **Given** the backtest job fails, **When** the user views the page, **Then** they see an error state with a retry option and a user-friendly explanation.

---

### User Story 4 - View Backtest Results by Day (Priority: P2)

As a VIP user whose backtest has completed, I want to view the results broken down by day so that I can analyze the agent's day-by-day performance on historical limit-up stocks.

**Why this priority**: Day-by-day results enable users to spot patterns (e.g., agent performs better on certain market conditions) and make informed decisions.

**Independent Test**: Can be fully tested by completing a backtest and verifying that results are grouped by date with key metrics per day.

**Acceptance Scenarios**:

1. **Given** a backtest has completed, **When** the user views results, **Then** they see a day-by-day breakdown with metrics for each day.
2. **Given** results for a specific day, **When** the user expands that day, **Then** they see the list of limit-up stocks the agent predicted and whether each prediction was correct.
3. **Given** multiple backtest runs for the same agent, **When** the user views the backtest history, **Then** they can select and compare previous runs.

---

### Edge Cases

- What happens if the user navigates away during backtest? The async job continues in the background; user can return to see progress/results.
- What happens if the user starts a second backtest while one is already running? The system either queues the new job or rejects it with a clear message.
- What happens if there is no limit-up stock data for a selected date? Display an empty state for that day with an explanation.
- How does the system handle VIP expiration during backtest? Backtest initiated while VIP remains valid; results are accessible even if VIP expires afterward.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backtest feature MUST be accessible only to users with VIP level >= 1 (or equivalent tier).
- **FR-002**: The backtest feature MUST NOT have a standalone navigation menu item.
- **FR-003**: The backtest entry point MUST be available on the agent management page for subscribed agents.
- **FR-004**: Users MUST be able to select a date range of up to 14 days for backtesting.
- **FR-005**: The backtest MUST only use historical limit-up stock data (not all stocks).
- **FR-006**: The backtest MUST run as an asynchronous long-running task.
- **FR-007**: The system MUST provide real-time progress updates while the backtest is running.
- **FR-008**: The system MUST display friendly status messages during backtest execution.
- **FR-009**: Backtest results MUST be displayed grouped by day.
- **FR-010**: Each day's results MUST show: total predictions, hit count, miss count, and hit rate.
- **FR-011**: Users MUST be able to view historical backtest results for a given agent.
- **FR-012**: The system MUST persist backtest results so users can view them after navigating away and returning.

### Key Entities *(include if feature involves data)*

- **BacktestJob**: Represents an asynchronous backtest execution. Contains agent reference, date range, status, progress percentage, created/completed timestamps.
- **BacktestResult**: Represents the aggregated outcome of a backtest job. Contains per-day breakdowns and overall summary statistics.
- **BacktestDayResult**: Represents a single day's backtest outcome. Contains date, total predictions, hit count, miss count, hit rate, and detail records.
- **BacktestDetail**: Represents an individual prediction outcome for a specific stock on a specific day. Contains stock code, prediction, actual outcome, and correctness flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: VIP users can initiate a backtest within 3 clicks from the agent management page.
- **SC-002**: Backtest progress updates are visible to users at least every 5 seconds.
- **SC-003**: Backtest results for a 14-day range are available within 2 minutes of job completion.
- **SC-004**: Users can view historical backtest results for any of their subscribed agents without re-running the job.
- **SC-005**: Backtest accuracy calculation matches the production hit-rate computation logic (same data source, same rules).

## Assumptions

- Users understand what "backtest" means in the context of agent evaluation.
- Historical limit-up stock data exists in the system for at least the past 14 days.
- The agent system can replay/re-evaluate agent decisions against historical data.
- VIP status is checked at the time of backtest initiation, not continuously during execution.
- A single user cannot run more than one concurrent backtest per agent (enforced by queue or rejection).
