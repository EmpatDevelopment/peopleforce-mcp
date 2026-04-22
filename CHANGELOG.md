# Changelog

All notable changes to `peopleforce-mcp` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-04-22

### Added
- Initial release of the PeopleForce MCP server.
- 27 read-only tools covering PeopleForce v3 API:
  - Core: `list_employees`, `get_employee`, `find_employee_by_email`, `list_employee_positions`, `list_employee_documents`, `list_employee_assets`.
  - Time-off: `list_leave_requests`, `list_leave_types`, `list_holidays`.
  - Reference data: `list_departments`, `list_positions`, `list_locations`, `list_divisions`, `list_teams`, `list_job_levels`, `list_job_profiles`, `list_legal_entities`, `list_employment_types`, `list_genders`, `list_skills`, `list_competencies`, `list_assets`, `list_tasks`.
  - Recruitment / ATS: `list_recruitment_vacancies`, `list_recruitment_candidates`, `list_recruitment_pipelines`, `list_recruitment_sources`.
  - Escape hatch: `api_request` for any GET endpoint not covered above.
- Built-in pagination (`page` / `per_page`), client-side email lookup workflow tool.
- Actionable error messages for 401 / 404 with hints.
- Node.js 18+ compatible, TypeScript source with full type safety.
- Smoke tests for the HTTP client and for the stdio server manifest.
