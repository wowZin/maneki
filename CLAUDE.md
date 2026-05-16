<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
- specs/014-agent-backtest/plan.md
- specs/014-agent-backtest/data-model.md
- specs/014-agent-backtest/research.md
<!-- SPECKIT END -->

## Architecture

Read `/Users/zhangying/projects/maneki/docs/architecture.md` for the system architecture overview.

## Module Specifications

Implementation modules are specified under `/Users/zhangying/projects/maneki/specs`. When implementing a feature, read the relevant module directory for its `plan.md`, `spec.md`, and other design artifacts.

## Development Constraints

- Every feature must include unit tests.
- Every functional module must include end-to-end (e2e) tests. Use **Playwright** to connect to Chrome via the Chrome DevTools Protocol (CDP) and simulate real user behavior. Avoid purely scripted/automated test flows.
- If issues are discovered during testing, investigate the root cause and fix them.
