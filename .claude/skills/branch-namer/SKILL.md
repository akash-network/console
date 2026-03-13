---
name: branch-namer
description: >
  Generate descriptive git branch names that follow the project's naming convention.
  Use this skill whenever the user asks to create a branch, name a branch, start working
  on a feature or fix, checkout a new branch, or when you're about to run `git checkout -b`
  or `git switch -c`. Also trigger when you see a vague branch name like `fix/auth` or
  `feature/billing` that lacks a description of what's actually changing — the branch name
  should always tell you *what* the change does, not just its category.
---

# Branch Namer

## The Problem

Branch names like `fix/dx` or `feature/billing` are technically valid but practically useless. When you scan a list of branches, you should immediately understand what each one is about without having to look up the PR or commit history.

## Branch Name Format

```
<type>/<scope>-<descriptive-slug>
```

**Components:**

- **type**: One of the conventional commit types listed below. Use the same type you'd use in the commit message. Prefer `feat` over `feature` for consistency with commit conventions. **Pick the type carefully — it controls CI/CD behavior:**

  | Type | Triggers Release? | Changelog | Auto-approve eligible |
  |------|-------------------|-----------|----------------------|
  | `feat` | Yes (minor bump) | Visible | No |
  | `fix` | Yes (patch bump) | Visible | No |
  | `refactor` | Yes (patch bump) | Visible | No |
  | `chore` | No release | Hidden | Yes* |
  | `test` | No release | Hidden | Yes* |
  | `docs` | No release | Hidden | Yes* |

  *Auto-approve requires `experienced-contributor` label, small PR size, and restricted file scope.

  Use `chore`/`test`/`docs` for internal changes that shouldn't ship a release (CI config tweaks, test-only changes, README updates). Use `refactor` only when you're restructuring production code — it triggers a patch release even though nothing user-facing changed.
- **scope**: A category from the project's `.commitlintrc.json` `scope-enum` list. Read this file to get the current allowed scopes. If nothing fits, use a short reasonable name. For app-specific changes, you can use a sub-path like `fix/provider-console/min-balance-issue`.
- **descriptive-slug**: 3–6 words in kebab-case that describe *what* the change does. This is the part that matters most.

## How to Write the Slug

The slug should answer: "What does this branch do?" in a few words. Think of it like a compressed commit message subject.

**Principles:**
- Lead with a verb when natural: `add-`, `close-`, `remove-`, `update-`, `handle-`, `migrate-`
- Drop articles (a, an, the) and filler words
- Use domain terms the team recognizes (e.g., `sequelize`, `stripe`, `managed-wallet`)
- Keep it under ~50 characters total (type + scope + slug)
- Don't repeat the type in the slug — `fix/auth-fix-login-redirect` → `fix/auth-login-redirect`

## Examples

| PR / Task Description                              | Bad Branch Name      | Good Branch Name                              |
|-----------------------------------------------------|----------------------|-----------------------------------------------|
| Close Sequelize connection on container dispose     | `fix/dx`             | `fix/dx-close-sequelize-on-dispose`           |
| Redirect unauthenticated users to login on /api-keys| `fix/auth`           | `fix/auth-redirect-unauthenticated-to-login`  |
| Add Stripe payment method to billing               | `feat/billing`       | `feat/billing-add-stripe-payment-method`      |
| Handle MissingStateCookieError during auth          | `fix/auth`           | `fix/auth-handle-missing-state-cookie`        |
| Granular skip labels for security scan workflow     | `chore/ci`           | `chore/ci-granular-skip-labels-security`      |
| Use local instrumentation package in indexer        | `refactor/indexer`   | `refactor/indexer-use-local-instrumentation`  |
| Migrate deploy-web from deprecated SDL class        | `refactor/sdl`       | `refactor/sdl-migrate-deploy-web-generate-manifest` |
| Switch notifications build from webpack to tsup     | `refactor/notifications` | `refactor/notifications-switch-webpack-to-tsup` |
| Add ACT support for authorizations                  | `feat/wallet`        | `feat/wallet-add-act-authorization-support`   |

## Workflow

1. **Read `.commitlintrc.json`** to get the allowed scopes for the current project
2. **Determine the type** — `feat`, `fix`, `refactor`, `chore`, `docs`, or `test`?
3. **Pick the scope** — which area of the codebase does this touch?
4. **Write the slug** — compress the task description into 3–6 kebab-case words
5. **Check the total length** — aim for under 50 characters
6. **Suggest the branch name** to the user before creating it