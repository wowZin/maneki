# Security & Permission Requirements Quality Checklist: Agent Marketplace

**Purpose**: Validate security requirements completeness, with mandatory gating for VIP/SVIP permission boundaries
**Created**: 2026/04/25
**Feature**: [Link to spec.md](../spec.md)

## VIP/SVIP Permission Boundaries (Mandatory Gates)

- [ ] CHK001 - Are VIP free subscription eligibility criteria explicitly defined with all boundary conditions (vip_level >= 1 AND vip_expire_at valid)? [Clarity, Spec §FR-006]
- [ ] CHK002 - Is the behavior specified when a VIP user's subscription expires mid-session (grace period vs immediate revocation)? [Coverage, Spec §Edge Cases]
- [ ] CHK003 - Are SVIP creation permission requirements defined with clear validation rules (vip_level >= 2 AND valid expiration)? [Clarity, Spec §FR-009]
- [ ] CHK004 - Is the enforcement mechanism for SVIP creation specified (middleware check, frontend guard, or both)? [Clarity, Spec §FR-012]
- [ ] CHK005 - Are requirements defined for non-SVIP users attempting direct URL access to the creation endpoint? [Coverage, Spec §FR-012]
- [ ] CHK006 - Are requirements defined for preventing privilege escalation (e.g., manipulating request to set price = 0 without VIP)? [Coverage, Gap]
- [ ] CHK007 - Are subscription duplicate-prevention requirements specified (same user cannot subscribe twice to same agent)? [Completeness, Spec §US2]
- [ ] CHK008 - Are requirements defined for preventing cross-user subscription manipulation (User A subscribing on behalf of User B)? [Coverage, Gap]

## Data Exposure & Privacy

- [ ] CHK009 - Are data exposure boundaries defined for agent detail responses (what non-owners can see vs owners)? [Completeness, Spec §FR-005]
- [ ] CHK010 - Is the prompt field exposure requirement specified (visible to all users vs subscribers only)? [Clarity, Spec §FR-005]
- [ ] CHK011 - Are user personal data exposure requirements defined (what author information is public: username, nickname, avatar)? [Clarity, contracts/api-contracts.md §GET /agents/:id]
- [ ] CHK012 - Are requirements defined for protecting user subscription lists from other users' view? [Completeness, Spec §FR-013]
- [ ] CHK013 - Are requirements defined for agent owner privacy (can owners see subscriber lists)? [Gap]

## Input Validation & Sanitization

- [ ] CHK014 - Are input sanitization requirements specified for the agent creation form fields (name, description, prompt)? [Completeness, Spec §FR-010]
- [ ] CHK015 - Are XSS prevention requirements defined for user-generated content (agent name, description, prompt rendered in HTML)? [Coverage, Gap]
- [ ] CHK016 - Are SQL injection prevention requirements defined for sort/filter parameters passed to list endpoints? [Coverage, Gap]
- [ ] CHK017 - Are requirements defined for preventing oversized payloads (e.g., extremely long prompt text)? [Coverage, Gap]
- [ ] CHK018 - Are file upload validation requirements specified if avatar upload is supported? [Coverage, Gap]

## Audit & Accountability

- [ ] CHK019 - Are audit logging requirements defined for subscription actions (who subscribed to what and when)? [Gap]
- [ ] CHK020 - Are audit logging requirements defined for agent creation/modification actions? [Gap]

## Notes

- CHK001–CHK008 are **mandatory gates**: security requirements must be unambiguous and complete before implementation proceeds.
- All items validate requirements quality, not implementation security testing.
