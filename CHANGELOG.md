# Changelog

All notable changes to `peopleforce-mcp` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] — 2026-04-22

### Added
- **Automatic retries with exponential backoff and jitter** for `429`, `5xx`, and network errors. `Retry-After` (numeric seconds and HTTP-date) is honoured. Configurable via `PEOPLEFORCE_MAX_RETRIES` (default `3`) and `PEOPLEFORCE_RETRY_BASE_MS` (default `500`).
- **Per-request timeout** via `AbortController`, configurable with `PEOPLEFORCE_TIMEOUT_MS` (default `15000`). Timed-out requests are retried subject to the retry budget.
- `PeopleForceError.attempts` — the number of attempts made before the error was raised, for diagnostics.
- **Biome** for linting + formatting, wired into a dedicated `lint` CI job.
- **CI hardening**: explicit `permissions: contents: read` on all workflow jobs (closes three CodeQL alerts).
- **Dependabot** config for weekly `npm` + monthly `github-actions` updates, grouped into `runtime` / `dev` bundles. Major-version npm bumps are ignored by default (security advisories still flow through).
- **GitHub community files**: issue templates (bug report / feature request / question with PII redaction checklist), PR template, `CODEOWNERS`, private security contact in issue-template config.
- **Social preview image** (`assets/social-preview.png`) plus the reproducible Python generator and the `Connective Silence` design philosophy.
- Documentation: environment-variable reference table in README, updated `.env.example`.

### Changed
- `PeopleForceClient` constructor now accepts an options object `{ baseUrl, timeoutMs, maxRetries, retryBaseMs, fetch, sleep }`. The legacy `(apiKey, baseUrl: string)` signature is still accepted for back-compat.
- Example prompts and tool descriptions no longer reference real employee identifiers or internal emails; placeholders are used throughout.

### Security
- Enabled and validated GitHub secret scanning, Dependabot alerts, private vulnerability reporting, and CodeQL default setup against the repository.
- `main` is protected by a branch ruleset: required PRs, required status checks (`lint` + 3 test matrix jobs), blocked force-pushes, restricted deletions. Admin bypass limited to pull-request flow.

### Tests
- 14 tests total (up from 9). New coverage for exponential backoff, `Retry-After` parsing, non-retryable status codes, timeout handling, and attempts-counter semantics.

## [0.1.0] — 2026-04-22

### Added
- Initial release of the PeopleForce MCP server.
- 28 read-only tools covering PeopleForce v3 API:
  - Core: `list_employees`, `get_employee`, `find_employee_by_email`, `list_employee_positions`, `list_employee_documents`, `list_employee_assets`.
  - Time-off: `list_leave_requests`, `list_leave_types`, `list_holidays`.
  - Reference data: `list_departments`, `list_positions`, `list_locations`, `list_divisions`, `list_teams`, `list_job_levels`, `list_job_profiles`, `list_legal_entities`, `list_employment_types`, `list_genders`, `list_skills`, `list_competencies`, `list_assets`, `list_tasks`.
  - Recruitment / ATS: `list_recruitment_vacancies`, `list_recruitment_candidates`, `list_recruitment_pipelines`, `list_recruitment_sources`.
  - Escape hatch: `api_request` for any GET endpoint not covered above.
- Built-in pagination (`page` / `per_page`), client-side email lookup workflow tool.
- Actionable error messages for `401` and `404` with hints.
- Node.js 18+ compatible, TypeScript source with full type safety.
- Smoke tests for the HTTP client and for the stdio server manifest.
