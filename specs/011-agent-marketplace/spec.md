# Feature Specification: Agent Marketplace

**Feature Branch**: `011-agent-marketplace`  
**Created**: 2026/04/25  
**Status**: Draft  
**Input**: User description: "设计agent市场，1. 展示agent市场排名，给出agent的基本信息，预测准确率，作者，评分，支持vip及以上用户免费订阅2. 给超级vip用户展示创作agent的按钮，3. 新开页面制作agent页面，参考admin-web agent 的字段和设计"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Agent Marketplace & Ranking (Priority: P1)

As a platform user, I want to browse the agent marketplace and view a ranked list of all available prediction agents, so that I can discover high-quality agents and decide which ones to subscribe to.

**Why this priority**: The marketplace listing is the core entry point for all users. Without it, no one can discover or subscribe to agents. It delivers immediate value by surfacing agent quality signals (accuracy, rating, usage) to help users make informed choices.

**Independent Test**: Can be fully tested by visiting the marketplace page and seeing a ranked list of agents with name, avatar, type, prediction accuracy, author name, rating, and subscription status. Sorting and filtering should work without requiring subscription or creation features.

**Acceptance Scenarios**:

1. **Given** the user is on the marketplace page, **When** the page loads, **Then** a ranked list of active agents is displayed with name, avatar, type badge, prediction accuracy, author name, star rating, and use count.
2. **Given** the marketplace list is displayed, **When** the user clicks a sort option (e.g., "Most Accurate", "Most Popular", "Highest Rated"), **Then** the list reorders accordingly.
3. **Given** the marketplace list is displayed, **When** the user selects a type/category filter, **Then** only agents matching the filter criteria are shown.
4. **Given** the user is browsing an agent card, **When** they click on it, **Then** they are taken to the agent detail page showing full information and a subscribe button.
5. **Given** the user is viewing an agent detail page, **When** the agent is marked as official or featured, **Then** a corresponding badge is displayed next to the agent name.

---

### User Story 2 - VIP Free Subscription (Priority: P1)

As a VIP or SVIP user, I want to subscribe to marketplace agents for free, so that I can use premium prediction capabilities without additional per-agent charges.

**Why this priority**: Free subscription is a key value proposition of the VIP membership tier. It directly converts marketplace discovery into active usage for paying users, increasing retention and VIP perceived value.

**Independent Test**: Can be fully tested by logging in as a VIP user, navigating to an agent detail page, clicking subscribe, and verifying the subscription is created with a zero price. Non-VIP users should see a price or upgrade prompt.

**Acceptance Scenarios**:

1. **Given** a logged-in user with VIP level >= 1 and valid expiration, **When** they click "Subscribe" on any agent detail page, **Then** a free subscription is created immediately without payment flow, and the agent appears in their subscribed list.
2. **Given** a logged-in user with VIP level >= 1 and valid expiration, **When** they view any agent detail page, **Then** the subscribe button shows "免费订阅" (Free Subscribe) instead of a price.
3. **Given** a logged-in free user (VIP level 0), **When** they view an agent detail page with price > 0, **Then** they see the actual price and a prompt suggesting VIP upgrade for free access.
4. **Given** a logged-in free user (VIP level 0), **When** they view an official or featured agent, **Then** they can subscribe for free (these are already free to all users).
5. **Given** a VIP user's subscription is active, **When** they view their subscribed agents list, **Then** the agent appears with "已订阅" status and can be used in the platform.

---

### User Story 3 - Super VIP Creates Agent (Priority: P2)

As a Super VIP user, I want to create and publish my own prediction agent to the marketplace, so that I can monetize my strategies and contribute to the community.

**Why this priority**: Agent creation empowers top-tier users and enriches the marketplace supply. It builds a creator ecosystem around the platform. P2 because it depends on the marketplace existing first and targets a smaller user segment (SVIP only).

**Independent Test**: Can be fully tested by logging in as an SVIP user, clicking "Create Agent", filling out the creation form with name, description, type, category, model, and prompt, saving it, and then seeing the new agent appear in the marketplace listing under their authorship.

**Acceptance Scenarios**:

1. **Given** a logged-in user with VIP level >= 2 (SVIP) and valid expiration, **When** they are on the marketplace page, **Then** a "创建 Agent" button is visible in the top-right corner.
2. **Given** a logged-in user with VIP level < 2, **When** they are on the marketplace page, **Then** no "创建 Agent" button is shown.
3. **Given** an SVIP user clicks "创建 Agent", **When** the creation form loads, **Then** it displays fields for: name (max 30 chars, unique), description (max 300 chars), type (technical/fundamental/sentiment/capital/decision/custom), category (trend/volume/breakout/sentiment/custom), model selection (qwen-turbo/qwen-plus/qwen-max/gpt-4o/gpt-4o-mini), and prompt with edit/preview tabs (Markdown supported).
4. **Given** an SVIP user fills out the creation form with valid data, **When** they click save, **Then** the agent is created, published to the marketplace, and the user is redirected to the marketplace page.
5. **Given** an SVIP user tries to create an agent with a duplicate name, **When** they submit the form, **Then** an error message "Agent 名称已存在" is shown and the form is not submitted.
6. **Given** an SVIP user creates a new agent, **When** the agent is published, **Then** it appears in the marketplace with the creator as author, initial rating of 5.0, and use count of 0.

---

### Edge Cases

- What happens when a VIP user's subscription expires while they have active agent subscriptions? Their existing subscriptions should remain usable until expiry, but new free subscriptions are blocked until renewal.
- How does the system handle an agent whose owner deletes their account? The agent remains visible in the marketplace with an "anonymous" or "former user" author label.
- What if an SVIP user downgrades to VIP? They retain their created agents and can continue managing them, but cannot create new ones until they upgrade back.
- How are agents with zero predictions handled in accuracy ranking? They should appear at the bottom of accuracy-sorted lists with "N/A" or "暂无数据" for accuracy.
- What if the marketplace has no agents? Display an empty state with a friendly message and a prompt for SVIP users to create the first agent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a marketplace page listing all active agents (`is_active = true`) in a ranked card or table layout.
- **FR-002**: Each agent card MUST show: name, avatar, type badge, category badge, prediction accuracy (derived from historical performance), author display name, star rating, and total use count.
- **FR-003**: The marketplace MUST support sorting by: prediction accuracy (descending), popularity/use count (descending), rating (descending), and creation date (newest first).
- **FR-004**: The marketplace MUST support filtering by agent type and category.
- **FR-005**: Clicking an agent card MUST navigate to an agent detail page showing full agent information and subscription controls.
- **FR-006**: VIP users (VIP level >= 1 with valid expiration) MUST be able to subscribe to any non-free agent at zero cost without a payment flow.
- **FR-007**: Free users MUST see the actual price for paid agents and be prompted to upgrade to VIP for free access.
- **FR-008**: Official (`is_official = true`) and featured (`is_featured = true`) agents MUST be free for all users regardless of VIP level.
- **FR-009**: SVIP users (VIP level >= 2 with valid expiration) MUST see a "Create Agent" button on the marketplace page.
- **FR-010**: The agent creation form MUST include fields: name (required, unique, max 30 chars), description (optional, max 300 chars), type (required), category (optional), model (optional), and prompt (required) with edit/preview tabs supporting Markdown.
- **FR-011**: Upon creation, the new agent MUST be published to the marketplace with `is_active = true` and the creator's user ID as `owner_id`.
- **FR-012**: The system MUST prevent non-SVIP users from accessing the agent creation page via URL navigation.
- **FR-013**: Subscribed agents MUST appear in the user's personal agent list for use within the platform.

### Key Entities

- **Agent**: Represents a prediction agent in the marketplace. Key attributes: name, description, avatar, type, category, prompt, model, price, price_type, is_active, is_featured, is_official, use_count, rating, rating_count, owner_id (author).
- **AgentSubscription**: Records a user's subscription to an agent. Key attributes: user_id, agent_id, start_date, end_date, status, price (0 for VIP free subscriptions).
- **User**: Existing entity. VIP-related attributes: vip_level (0=free, 1=vip, 2=svip), vip_expire_at.
- **AgentPerformanceSnapshot**: Existing entity (from homepage-overview). Used to derive each agent's prediction accuracy for marketplace ranking.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can discover and evaluate agents from the marketplace in under 30 seconds (time to understand top-ranked agent's accuracy, rating, and author).
- **SC-002**: VIP users can subscribe to any agent with a single click, completing the subscription in under 3 seconds.
- **SC-003**: SVIP users can create and publish a new agent through the creation form in under 5 minutes.
- **SC-004**: The marketplace page loads its initial ranked list in under 2 seconds for up to 100 agents.
- **SC-005**: At least 3 sort/filter options are available and each reorders the list within 1 second.

## Assumptions

- The existing `agents` table schema (name, description, avatar, type, category, prompt, model, price, price_type, is_active, is_featured, is_official, use_count, rating, rating_count, owner_id) is sufficient for marketplace listing and creation; no new fields are needed.
- The existing `agent_subscriptions` table is sufficient for tracking VIP free subscriptions; only the `price` field will be set to 0 for VIP users.
- Agent prediction accuracy is derived from the existing `agent_performance_snapshots` table (hit_rate field), falling back to "N/A" if no snapshot exists.
- The VIP tier system uses `vip_level` (0=free, 1=vip, 2=svip) with `vip_expire_at` for expiration checking, as already implemented in the user model.
- Agent creation by SVIP users results in publicly visible marketplace agents; there is no "private/draft" agent state in v1.
- The frontend design for agent creation references the existing admin-web `AgentCreate.tsx` form fields and layout, adapted for the main web app's styling system.
