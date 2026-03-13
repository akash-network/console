## Commit and PR Conventions

## Commit Messages
- Must comply with `.commitlintrc.json` (extends `@commitlint/config-conventional`)
- Scope is required and must be from the allowed list in `.commitlintrc.json`
- Always check `.commitlintrc.json` for the current list of allowed scopes before committing

## Branch Names
- Format: `(feat|fix|refactor|chore|docs|test)/<scope>-<descriptive-slug>`
- Type should match the conventional commit type (prefer `feat` over `feature`)
- Prefer using a scope from `.commitlintrc.json` when applicable
- Use another reasonable short name if no commitlint scope fits
- The slug should be 3–6 kebab-case words describing *what* the change does
- Example: `fix/dx-close-sequelize-on-dispose` instead of `fix/dx`

## PR Descriptions
- Must use the template from `.github/pull_request_template.md`
- Always read the template before creating a PR to ensure the correct format is used
- Reference Linear issues in the **Why** section using magic keywords + issue ID (e.g., `Fixes CON-123`)
- **Closing keywords** (moves issue to Done on merge): `close`, `closes`, `fix`, `fixes`, `resolve`, `resolves`
- **Non-closing keywords** (links PR without auto-closing): `ref`, `refs`, `part of`, `related to`, `contributes to`
- Pick the right keyword — don't use `Closes` if the PR only partially addresses the issue
