# API Contract Quality Checklist: Agent Marketplace

**Purpose**: Validate API contract completeness, clarity, and consistency for all marketplace endpoints
**Created**: 2026/04/25
**Feature**: [Link to spec.md](../spec.md) | [API Contracts](../contracts/api-contracts.md)

## Endpoint Completeness

- [ ] CHK001 - Are all marketplace user stories (browse, subscribe, create) fully covered by documented API endpoints? [Completeness, Spec §US1, US2, US3]
- [ ] CHK002 - Are update/edit agent requirements covered by API contracts, or is agent mutation intentionally out of scope? [Completeness, Gap]
- [ ] CHK003 - Are delete/unpublish agent requirements covered by API contracts? [Completeness, Gap]
- [ ] CHK004 - Are batch operations (bulk subscribe, bulk query) requirements defined if needed? [Completeness, Gap]

## Request Specification Quality

- [ ] CHK005 - Are all query parameters for list endpoints explicitly typed with valid ranges (e.g., page_size max 100)? [Clarity, contracts/api-contracts.md §GET /agents]
- [ ] CHK006 - Are enum values for sort_by explicitly listed with their exact database field mappings? [Clarity, contracts/api-contracts.md]
- [ ] CHK007 - Is the behavior when both type and category filters are applied simultaneously specified (AND vs OR logic)? [Clarity, Gap]
- [ ] CHK008 - Are request body field rules for agent creation consistently specified across contracts and data model (max lengths, required/optional)? [Consistency, contracts/api-contracts.md §POST /agents, data-model.md]
- [ ] CHK009 - Is the default behavior for omitted optional fields in agent creation (price default 0, price_type default "onetime") explicitly documented in requirements? [Clarity, contracts/api-contracts.md]

## Response Specification Quality

- [ ] CHK010 - Are all response fields for the marketplace list item explicitly defined with types and nullability? [Completeness, contracts/api-contracts.md §GET /agents]
- [ ] CHK011 - Is the `accuracy` field nullability behavior explicitly documented (null when no snapshot exists)? [Clarity, contracts/api-contracts.md]
- [ ] CHK012 - Are pagination metadata fields (total, page, size) consistently defined across all list endpoints? [Consistency, contracts/api-contracts.md]
- [ ] CHK013 - Are field naming conventions consistent between marketplace list items and detail responses (e.g., author_name vs author.name)? [Consistency, contracts/api-contracts.md]
- [ ] CHK014 - Are response schemas for the "My Subscriptions" endpoint fully specified with all fields? [Completeness, contracts/api-contracts.md §GET /my-subscriptions]

## Error Handling Consistency

- [ ] CHK015 - Are error response formats consistently specified across all endpoints with the same JSON structure? [Consistency, contracts/api-contracts.md §Error Response Standard]
- [ ] CHK016 - Are all expected HTTP status codes documented for each endpoint (400, 401, 403, 404, 409, 500)? [Completeness, contracts/api-contracts.md]
- [ ] CHK017 - Are error message strings standardized and documented (e.g., exact text for "agent not found", "already subscribed")? [Clarity, contracts/api-contracts.md]
- [ ] CHK018 - Is the behavior for validation errors (400) specified with field-level detail vs generic message? [Clarity, contracts/api-contracts.md §POST /agents]
- [ ] CHK019 - Are rate limiting or throttling error responses (429) defined in the error standard? [Completeness, Gap]

## Authentication & Authorization Specification

- [ ] CHK020 - Are authentication requirements clearly marked for each endpoint (public, optional-auth, required-auth)? [Clarity, contracts/api-contracts.md]
- [ ] CHK021 - Is the optional-auth behavior for agent detail (is_subscribed, can_subscribe_free based on login state) explicitly documented? [Clarity, contracts/api-contracts.md §GET /agents/:id]
- [ ] CHK022 - Are the exact VIP/SVIP permission checks specified per endpoint (SVIPAuthMiddleware for creation, VIP check for subscription)? [Clarity, contracts/api-contracts.md]
- [ ] CHK023 - Is the behavior defined for authenticated users with expired VIP attempting to subscribe? [Coverage, Gap]

## API Versioning & Evolution

- [ ] CHK024 - Is an API versioning strategy documented for future marketplace endpoint changes? [Gap]
- [ ] CHK025 - Are breaking vs non-breaking change criteria defined for the marketplace API? [Gap]
- [ ] CHK026 - Are deprecation policies specified for endpoints that may evolve? [Gap]

## Notes

- Items focus on contract quality, not implementation correctness.
- Mandatory gate items for permission-related contracts: CHK020–CHK023.
