# Feature Specification: Signal Center

**Feature Branch**: `013-signal-center`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "新建分支开发信号中心，信号中心实时更新主agent预测的涨停股票，展示股票的最基础的信息（名称、代码、预测时间），操作上：支持用户选择标记跟随，用户统计用户的命中率"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Real-time Signals (Priority: P1)

As a logged-in user, I want to see a real-time stream of limit-up stock predictions from the main agent, so that I can quickly discover potential trading opportunities.

**Why this priority**: This is the core value proposition of the Signal Center. Without signal visibility, no other feature matters.

**Independent Test**: Can be fully tested by opening the Signal Center page and verifying that prediction signals appear with stock name, code, and prediction time.

**Acceptance Scenarios**:

1. **Given** the main agent has published a limit-up prediction, **When** a user opens the Signal Center, **Then** the signal appears showing the stock name, stock code, and prediction timestamp.
2. **Given** multiple predictions exist, **When** the user views the Signal Center, **Then** signals are displayed in reverse chronological order (newest first).
3. **Given** the Signal Center is open, **When** a new prediction is generated, **Then** the signal list updates automatically without requiring a manual refresh.

---

### User Story 2 - Follow a Signal (Priority: P2)

As a logged-in user, I want to mark a signal as "followed" so that I can track my own performance against the main agent's predictions.

**Why this priority**: Following signals enables user tracking and hit-rate statistics, which is a key engagement and retention feature.

**Independent Test**: Can be fully tested by clicking a "Follow" button on a signal and then verifying it appears in the user's followed list.

**Acceptance Scenarios**:

1. **Given** a signal is displayed, **When** the user clicks the "Follow" button, **Then** the signal is marked as followed and the button state changes to "Following".
2. **Given** a user has followed a signal, **When** they view their followed signals list, **Then** the followed signal appears with its prediction details.
3. **Given** a user has followed a signal, **When** they click "Unfollow", **Then** the signal is removed from their followed list and the button reverts to "Follow".

---

### User Story 3 - View Personal Hit Rate Statistics (Priority: P2)

As a logged-in user, I want to see statistics about how accurate my followed signals have been, so that I can evaluate the effectiveness of my tracking strategy.

**Why this priority**: Hit-rate statistics provide feedback to users and encourage continued engagement with the platform.

**Independent Test**: Can be fully tested by following some signals, waiting for market close results, and then viewing the hit-rate summary.

**Acceptance Scenarios**:

1. **Given** a user has followed signals, **When** they view their Signal Center dashboard, **Then** they see a summary showing total followed, total hit, and hit-rate percentage.
2. **Given** market results are available for a followed signal, **When** the user views signal details, **Then** each signal shows whether it hit the limit-up or not.

---

### Edge Cases

- What happens when no signals have been generated today? Display an empty state message.
- How does the system handle duplicate predictions for the same stock on the same day? Only the latest prediction for that stock/day is shown.
- What if a user tries to follow a signal for a stock they already followed today? Prevent duplicate follows and show a confirmation.
- How does the system handle market close time when determining hit status? Hit status is determined after market close (15:00 China time) based on whether the stock reached the daily limit-up.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Signal Center MUST display real-time limit-up stock predictions from the main agent.
- **FR-002**: Each signal MUST show the stock name, stock code, and prediction timestamp.
- **FR-003**: Signals MUST be displayed in reverse chronological order (newest first).
- **FR-004**: The Signal Center MUST auto-update when new predictions are available without requiring manual refresh.
- **FR-005**: Users MUST be able to click a "Follow" button on any signal to add it to their personal tracking list.
- **FR-006**: Users MUST be able to unfollow a previously followed signal.
- **FR-007**: The system MUST prevent a user from following the same stock multiple times for the same trading day.
- **FR-008**: The system MUST calculate and display the user's personal hit rate based on followed signals.
- **FR-009**: The system MUST show hit status (hit / not hit / pending) for each followed signal after market close.
- **FR-010**: Users MUST be authenticated to follow signals or view personal statistics.

### Key Entities *(include if feature involves data)*

- **Signal**: Represents a limit-up stock prediction from the main agent. Contains stock code, stock name, prediction time, and source agent reference.
- **UserSignal**: Represents a user's decision to follow a specific signal. Contains user ID, signal ID, follow timestamp, and hit status.
- **SignalStatistics**: Aggregated view of a user's follow performance. Contains total followed count, hit count, and calculated hit rate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view new predictions within 5 seconds of the main agent generating them.
- **SC-002**: The follow action completes in under 1 second and provides immediate visual feedback.
- **SC-003**: Hit-rate statistics are accurate and updated within 1 hour after market close.
- **SC-004**: Users can follow/unfollow signals with no more than 2 clicks per action.

## Assumptions

- The main agent prediction system already exists and can provide prediction events.
- Stock market operates on China A-share trading hours (09:30-11:30, 13:00-15:00 CST).
- Users are already authenticated via the existing auth system.
- Real-time updates can be achieved via polling or WebSocket connections.
- Hit status determination relies on existing market data/price services.
