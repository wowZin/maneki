# Tasks: 灵动欢迎页（Landing Page）

**Feature**: 灵动欢迎页（Landing Page）
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)
**Branch**: `009-animated-landing-page` | **Date**: 2026-04-23

---

## Dependency Graph

```
Phase 1: Setup
    |
    v
Phase 2: Foundational (AnimatedBackground, PricingCard, types)
    |       |       |       |
    v       v       v       v
Phase 3: US1    Phase 4: US2    Phase 5: US3    Phase 6: US4
(Hero)        (Pricing)      (PricingPage)   (A11y/Perf)
    |               |               |               |
    +---------------+---------------+---------------+
                    |
                    v
            Phase 7: Polish
```

**Execution Order**: Phase 1 → Phase 2 → (Phase 3, Phase 4, Phase 5, Phase 6 可部分并行) → Phase 7

**Story Dependencies**:
- US1 (Hero) 是 US2 (Pricing on Landing) 的前置依赖（PricingSection 在 LandingPage 内）
- US2 和 US3 可并行（不同页面，共享 PricingCard 组件）
- US4 (A11y/Perf) 可与其他故事并行，但需等 AnimatedBackground 完成

---

## Phase 1: Setup (路由与目录初始化)

**Goal**: 初始化 LandingPage 目录，调整路由使未登录用户访问 `/` 看到 LandingPage。

- [X] T001 [P] Create `apps/web/src/pages/LandingPage/` directory with `index.tsx` scaffold and subfolders `HeroSection/`, `PricingSection/`
- [X] T002 Adjust `apps/web/src/App.tsx` routing: unauthenticated `/` renders `LandingPage`; authenticated `/` enters `Layout` with `Dashboard`; keep `/pricing`, `/login`, `/register` as public routes

---

## Phase 2: Foundational (共享组件与类型)

**Goal**: 创建可复用的动画背景组件、提取定价卡片、确认类型定义 — 所有用户故事共享。

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `apps/web/src/components/AnimatedBackground/index.tsx` with `variant` prop (`mesh` default) and CSS Modules base styles; add `reducedMotion` prop support
- [X] T004 [P] Create `apps/web/src/components/AnimatedBackground/mesh.module.css` — pure CSS flowing mesh gradient animation using `@keyframes` and `transform`
- [X] T005 [P] Verify `apps/web/src/services/pricing.ts` exports `PricingConfigResponse` and `MembershipPlan` types; add `PricingTier` type alias in `apps/web/src/types/pricing.ts` if needed for shared usage
- [X] T006 [P] Extract reusable `PricingCard` component from existing `apps/web/src/pages/Pricing/index.tsx` into `apps/web/src/components/PricingCard/index.tsx` with props: `plan`, `isCurrent`, `onCTAClick`, `ctaText`

**Checkpoint**: Foundation ready — AnimatedBackground renders, PricingCard is reusable, types are consistent.

---

## Phase 3: User Story 1 — 首屏沉浸体验 (Priority: P1) 🎯 MVP

**Goal**: Users see a stunning Hero area occupying ~2/3 of the viewport with animated CSS background and centered Slogan.

**Independent Test**: Open `/` as unauthenticated user. Hero area fills ~66vh, Slogan is prominent, CSS animation loops smoothly. Scroll down transitions naturally.

### Implementation for User Story 1

- [X] T007 [P] [US1] Create `apps/web/src/pages/LandingPage/HeroSection/Slogan.tsx` — main title (≥48px desktop) and subtitle (≥18px) centered with brand copy
- [X] T008 [US1] Create `apps/web/src/pages/LandingPage/HeroSection/index.tsx` — Hero container (~66vh) integrating `AnimatedBackground` (variant="mesh") + `Slogan`; add scroll-down hint chevron
- [X] T009 [US1] Wire up `apps/web/src/pages/LandingPage/index.tsx` to render `HeroSection`; add scroll-to-pricing anchor link `#pricing`
- [X] T010 [P] [US1] Add responsive styles to `HeroSection`: font sizes scale down on tablet/mobile; animation degrades gracefully but remains visible

**Checkpoint**: At this point, US1 should be fully functional. Unauthenticated users see the animated Hero on `/`.

---

## Phase 4: User Story 2 — 定价展示与转化 (Priority: P2)

**Goal**: LandingPage scrolls down to a pricing section with tier cards, CTA logic varies by auth state.

**Independent Test**: Scroll down on LandingPage. Pricing cards display tier names, prices, feature lists. Clicking CTA as unauthenticated redirects to `/login`; as authenticated redirects to `/pricing`.

### Implementation for User Story 2

- [X] T011 [P] [US2] Create `apps/web/src/pages/LandingPage/PricingSection/index.tsx` — simplified pricing display reusing `PricingCard`; fetch data via `pricingApi.getPricingConfig()`; show 2–3 tiers
- [X] T012 [US2] Implement CTA logic in `PricingSection`: if `isAuthenticated === false`, button navigates to `/login`; if `isAuthenticated === true`, button navigates to `/pricing`
- [X] T013 [US2] Add smooth visual transition between `HeroSection` and `PricingSection` (gradient fade, divider, or natural whitespace) and ensure `#pricing` anchor scrolls correctly
- [X] T014 [P] [US2] Make `PricingSection` responsive: 3 columns on desktop, 2 on tablet, 1 on mobile; cards have hover lift/glow effect

**Checkpoint**: LandingPage is complete — Hero + Pricing flow works end-to-end for both auth states.

---

## Phase 5: User Story 3 — 独立定价页增强 (Priority: P2)

**Goal**: Existing `/pricing` page gets a user status summary bar and smarter CTA states for logged-in users.

**Independent Test**: Logged-in user visits `/pricing`. Top bar shows current tier and expiry. Current tier card is highlighted as "current plan". Upgrade buttons work.

### Implementation for User Story 3

- [X] T015 [P] [US3] Create `apps/web/src/pages/Pricing/UserStatusBar.tsx` — displays current user tier name, avatar, expiry date from `useAuthStore` user data; shows "expired" warning if applicable
- [X] T016 [US3] Integrate `UserStatusBar` into existing `apps/web/src/pages/Pricing/index.tsx` at the top of the page
- [X] T017 [US3] Enhance existing Pricing page CTA logic: current user tier shows disabled "当前方案" badge; other tiers show "升级" CTA; highest tier shows "您已享受全部权益"
- [X] T018 [US3] Add `/pricing` navigation link to `apps/web/src/components/Layout/` header or sidebar menu, visible when authenticated

**Checkpoint**: Pricing page is polished for logged-in users. Navigation is discoverable.

---

## Phase 6: User Story 4 — 性能与可访问性 (Priority: P3)

**Goal**: Animations respect user motion preferences; page is keyboard-navigable and performant.

**Independent Test**: Enable macOS "Reduce Motion". Reload `/`. Animation stops, static gradient remains, all text readable. Tab through pricing cards — all buttons are focusable.

### Implementation for User Story 4

- [X] T019 [P] [US4] Add `prefers-reduced-motion` media query to `AnimatedBackground` — pause `@keyframes`, show static gradient fallback; ensure zero layout shift
- [X] T020 [P] [US4] Add accessibility attributes to LandingPage and PricingPage: `aria-label` on CTA buttons, keyboard `Tab` focus styles on `PricingCard`, semantic `<main>` / `<section>` landmarks
- [X] T021 [P] [US4] Verify WeChat WebView compatibility: CSS animations render without JS errors; test on iOS Safari and Android Chrome

**Checkpoint**: All accessibility and performance requirements met.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: SEO, analytics, final cleanup.

- [X] T022 [P] Add SEO meta tags to LandingPage (`<title>Maneki - 智能股票分析平台</title>`, `<meta name="description">`) and PricingPage (`<title>会员定价 - Maneki</title>`)
- [ ] T023 [P] Add analytics tracking: `IntersectionObserver` on `HeroSection` to record dwell time ≥5s; click tracking on all pricing CTA buttons with tier ID
- [ ] T024 [P] Review and unify Chinese copy across LandingPage and PricingPage for consistency

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
  - AnimatedBackground (T003/T004) must complete before HeroSection (T008)
  - PricingCard extraction (T006) must complete before PricingSection (T011) and Pricing page enhancements (T016/T017)
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion
  - US1 (P1) must complete before US2 (Pricing on LandingPage)
  - US2 and US3 can run in parallel (different pages, same shared components)
  - US4 can run in parallel with US2/US3 (different concerns, no file conflicts)
- **Polish (Phase 7)**: Depends on all user stories being functional

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories. MVP.
- **User Story 2 (P2)**: Can start after US1 has HeroSection working (needs LandingPage layout).
- **User Story 3 (P2)**: Can start in parallel with US2. Only depends on PricingCard (T006) from Foundational.
- **User Story 4 (P3)**: Can start in parallel with US1/US2/US3. Only depends on AnimatedBackground (T003/T004).

### Within Each User Story

- US1: T007 (Slogan) and T008 (Hero container) are sequential; T010 (responsive) can run in parallel with T009 (wire up)
- US2: T011 (PricingSection) → T012 (CTA logic) → T013 (transition) — sequential; T014 (responsive) parallel with T013
- US3: T015 (UserStatusBar) and T018 (nav link) can run in parallel; T016 (integrate) and T017 (CTA logic) sequential after T015
- US4: All tasks (T019–T021) are parallel (different files, no dependencies)

### Parallel Opportunities

- All Setup tasks (T001–T002) can run in parallel
- All Foundational tasks (T003–T006) can run in parallel
- US1 tasks T007/T010 can run in parallel; US2 task T014 can run in parallel with T012/T013
- US3 tasks T015/T018 can run in parallel
- All US4 tasks (T019–T021) can run in parallel
- All Polish tasks (T022–T024) can run in parallel

---

## Parallel Example: User Story 1 + Foundational

```bash
# Launch in parallel:
Task: "Create AnimatedBackground component with mesh gradient CSS"
Task: "Extract PricingCard from existing Pricing page"
Task: "Create Slogan component"

# Then, after AnimatedBackground ready:
Task: "Create HeroSection integrating AnimatedBackground + Slogan"

# Then:
Task: "Wire up LandingPage index with HeroSection"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (routing + directory)
2. Complete Phase 2: Foundational (AnimatedBackground + types)
3. Complete Phase 3: User Story 1 (HeroSection with animated background + Slogan)
4. **STOP and VALIDATE**: Open `/` as unauthenticated user — verify animation, Slogan visibility, responsiveness
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test animated Hero on all screen sizes → Deploy/Demo (MVP!)
3. Add User Story 2 → Add pricing section to LandingPage → Deploy/Demo
4. Add User Story 3 → Enhance existing `/pricing` page for logged-in users → Deploy/Demo
5. Add User Story 4 → Accessibility + performance polish → Deploy/Demo
6. Add Polish phase → SEO + analytics → Final deploy

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: T007 + T008 + T009 (HeroSection + LandingPage wiring)
   - Developer B: T011 + T012 + T013 (LandingPage PricingSection)
   - Developer C: T015 + T016 + T017 + T018 (Pricing page enhancements + nav)
3. After US1/US2/US3 work:
   - Developer A: T019 + T020 (A11y)
   - Developer B: T021 (WeChat compat)
   - Developer C: T022 + T023 + T024 (SEO + analytics + copy)
4. Final review together

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing `pages/Pricing/index.tsx` already has a complete pricing page — US3 is mostly enhancement (UserStatusBar + CTA states + nav link), not a rewrite
- The current `App.tsx` routes `/` through `ProtectedRoute` → always redirects unauthenticated to `/login`. T002 changes this so `/` is public and shows LandingPage for unauthenticated users.
