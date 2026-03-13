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
- Reference Linear issues using magic keywords: `Closes CON-xxx`
- Place the Linear reference in the **Why** section of the PR template
