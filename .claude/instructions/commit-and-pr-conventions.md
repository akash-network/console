## Commit and PR Conventions

## Commit Messages
- Must comply with `.commitlintrc.json` (extends `@commitlint/config-conventional`)
- Scope is required and must be from the allowed list in `.commitlintrc.json`
- Always check `.commitlintrc.json` for the current list of allowed scopes before committing

## Branch Names
- Format: `(feature|fix)/<scope>`
- Prefer using a scope from `.commitlintrc.json` when applicable
- Use another reasonable short name if no commitlint scope fits

## PR Descriptions
- Must use the template from `.github/pull_request_template.md`
- Always read the template before creating a PR to ensure the correct format is used
