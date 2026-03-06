---
name: linear-issue
description: Plan, create, and improve Linear issues by analyzing the codebase and breaking work into small, reviewable chunks. Use this skill whenever the user wants to create a Linear issue, improve an existing one, file a bug, plan a feature, create a chore/enabler, or mentions "linear issue", "file an issue", "create a ticket", "log a bug", "new issue", "plan this work", "improve this issue", or "clean up this ticket". Also trigger when the user says "I found a bug", "we need a ticket for...", "can you create an issue for...", "break this down into issues", or pastes a Linear issue URL/ID. This is the required way to create and maintain issues — it ensures every issue follows the team's format and is scoped for small PRs.
---

# Linear Issue Planner & Creator

This skill does three things: **plans** the technical work by analyzing the codebase, **creates** well-structured Linear issues scoped for small reviewable PRs, and **improves** existing issues to match the team's standards.

The goal is consistency across the team — every issue has the right structure, a clear technical plan, and is small enough that the resulting PR is easy to review.

## Modes

This skill operates in two modes. Detect which one based on what the user asks:

1. **Create mode** — User wants new issues. Follow the full workflow below (Phase 1–5).
2. **Improve mode** — User references an existing Linear issue (by ID like `ENG-123`, or URL). Follow the Improve Existing Issues workflow instead.

## Issue Types

There are three templates. Pick the one that matches what the user describes:

- **Bug** — Something is broken or behaving incorrectly
- **Feature / Story** — New functionality or enhancement driven by a user need
- **Enabler / Chore** — Internal improvement, tech debt, refactoring, CI/infra work

If the user doesn't specify a type, infer it from context. A report about something not working → Bug. A request for new behavior → Feature. Internal cleanup or tooling → Enabler.

## Workflow

### Phase 1: Gather Context

#### From the user
Ask the user what they need. If they give enough context upfront, don't interrogate — fill in what you can and confirm the rest.

#### From observability tools (when relevant)
Before diving into code, check if observability data can inform the issue — especially for bugs and production incidents.

**Grafana** — Use when investigating errors, performance issues, or production behavior:
- `mcp__grafana__query_loki_logs` — Search logs for errors, stack traces, or specific request patterns
- `mcp__grafana__find_error_pattern_logs` — Find elevated error patterns in Loki
- `mcp__grafana__find_slow_requests` — Find slow requests in Tempo
- `mcp__grafana__query_prometheus` — Check metrics (error rates, latency, resource usage)
- `mcp__grafana__search_dashboards` — Find relevant dashboards for the affected service
- `mcp__grafana__list_alert_rules` — Check if there are existing alerts for this area
- `mcp__grafana__list_incidents` — Check for related active incidents

**Amplitude** — Use when understanding user behavior or impact:
- `mcp__claude_ai_Amplitude__query_dataset` — Query event data to understand scope/frequency
- `mcp__claude_ai_Amplitude__get_session_replays` — Watch session replays of the issue
- `mcp__claude_ai_Amplitude__search` — Find relevant charts or experiments
- `mcp__claude_ai_Amplitude__get_feedback_insights` — Check if users have reported this

Use ToolSearch to load these tools before calling them. Only query what's relevant — don't run every tool on every issue. For bugs, Grafana logs and error patterns are usually most valuable. For features, Amplitude usage data helps scope the impact.

Include findings in the issue description — link to specific dashboards, paste key log lines, or note error rates. This gives reviewers and implementers real data instead of guesses.

#### From the codebase
Explore the codebase to understand what exists and what needs to change. This is the most important step — good issues come from understanding the code, not guessing.

Use Glob, Grep, and Read to:
- Find the files and modules that will need changes
- Understand existing patterns, abstractions, and conventions in the affected area
- Identify dependencies between components
- Spot potential edge cases or risks
- Check for existing tests that will need updating

For features/enablers, also look for:
- Similar implementations to follow as a pattern
- Shared utilities or abstractions that should be reused
- Database schemas that may need migration
- API contracts that may need versioning

### Phase 2: Technical Plan

Based on your codebase analysis, create a technical plan. This plan lives in the **parent issue** (if breaking into sub-issues) or in the issue's Notes section (if it's a single issue).

The plan should include:
- **Files to change** — list the specific files with a brief note on what changes
- **Approach** — how to implement it (which patterns to follow, which abstractions to use)
- **Risks / edge cases** — anything tricky the implementer should know
- **Dependencies** — does this depend on or block other work?

### Phase 3: Break Into Small Issues

This is critical. Every issue should map to a **single small PR** that's easy to review. The repo has an automated PR size labeler — aim for **S** or **M** PRs. **Avoid L and XL at all costs.**

**PR size labels** (from `.github/workflows/labeler.yml`, excludes lock files and drizzle migration meta):

| Label | Lines changed | Target |
|-------|--------------|--------|
| **XS** | < 50 | Ideal for config changes, one-liner fixes |
| **S** | 50–199 | Ideal for most issues |
| **M** | 200–499 | Acceptable for features with tests |
| **L** | 500–999 | Too large — split further |
| **XL** | 1000+ | Never — always split |

When estimating, count additions + deletions across all non-excluded files. If an issue would likely produce an L or XL PR, it **must** be split into smaller issues.

**How to split:**
- **By layer** — schema/migration first, then backend logic, then API endpoint, then frontend
- **By feature boundary** — each independent piece of functionality gets its own issue
- **By risk** — risky changes (migrations, breaking API changes) get isolated into their own issue
- **Enablers first** — if the feature needs refactoring or new abstractions, those go in a separate preceding issue

**Issue ordering:**
- Number the issues or note dependencies explicitly (e.g., "blocked by #1")
- The first issue should be the one that can be started immediately
- Each issue should be mergeable on its own without breaking anything

**When NOT to split:**
- Simple bug fixes that touch 1-3 files and stay under 200 lines — just create one issue
- Small chores that are already atomic

### Phase 4: Fill Templates & Create Issues

For each issue, fill the appropriate template.

#### Bug

```markdown
## What's broken
[One sentence. Link to Sentry/Grafana logs if available.]

## Repro
1. ...
2. ...

## Expected vs Actual
Expected: ...
Actual: ...

## Technical Analysis
[What you found in the codebase — root cause, affected files, relevant code paths.]

## Scope
- App: <app>
- Area: <area>
```

#### Feature / Story

```markdown
## Why
[One sentence on the user problem or business need.]

## What
[What we're building. Link Figma/discussion if applicable.]

## Technical Plan
[Files to change, approach, patterns to follow. Keep it concise but specific.]

## Acceptance Criteria
- [ ] ...
- [ ] ...

## Scope
- App: <app>
- Area: <area>

## Notes
[Dependencies, migrations, edge cases, observability data.]
```

#### Enabler / Chore

```markdown
## Why
[What this unblocks or improves.]

## What
- [ ] Task 1
- [ ] Task 2

## Technical Plan
[Files to change, approach, patterns to follow.]

## Scope
- App: <app>
- Area: <area>
```

**Drop any section that has no content** — empty placeholders are worse than no section.

### Phase 5: Confirm & Create

Show the user ALL issues you plan to create — titles, descriptions, and ordering. Let them adjust before you create anything.

Then create each issue using the Linear CLI:

```bash
cat <<'EOF' > /tmp/linear-issue-desc.md
<description content>
EOF

linear issue create \
  --title "<title>" \
  --description-file /tmp/linear-issue-desc.md \
  --no-interactive \
  [--priority <1-4>] \
  [--label "<label>"] \
  [--team "<team>"] \
  [--assignee "<assignee>"] \
  [--project "<project>"] \
  [--parent "<parent-issue-id>"]
```

Always use `--description-file` (not inline `--description`) and `--no-interactive`.

For multi-issue plans, create the parent issue first, then create child issues with `--parent` pointing to the parent's ID.

After creation, clean up temp files and show the user all issue identifiers/URLs.

## Valid Values

### Apps (Scope > App)
- deploy-web
- api
- indexer
- stats-web
- notifications
- provider-console
- provider-proxy
- log-collector
- tx-signer

### Areas (Scope > Area) — from .commitlintrc.json
- network
- wallet
- sdl
- user
- auth
- billing
- provider
- deployment
- indexer
- certificate
- dx
- config
- stats
- release
- ci
- repo
- styling
- observability
- analytics
- template
- notifications
- alert
- notification-channel
- jwt
- log-collector
- bid
- onboarding
- managed-wallet

These area values are kept in sync with the project's commitlint scopes so that issue labels and commit messages align.

## Labeling Convention

When the user specifies an issue type, suggest adding a label that matches:
- Bug → label `bug`
- Feature / Story → label `feature`
- Enabler / Chore → label `chore`

Only suggest — don't force it. The user's workspace may have different label names.

## Improve Existing Issues

When the user references an existing issue, the goal is to bring it up to team standards — add missing sections, enrich with codebase analysis, and optionally split it into smaller issues.

### Step 1: Fetch the issue

```bash
linear issue view <issue-id> --json --no-pager
```

This returns the full issue data as JSON including title, description, state, labels, assignee, parent, and sub-issues.

### Step 2: Analyze gaps

Compare the current description against the appropriate template (Bug / Feature / Enabler). Identify:
- **Missing sections** — e.g., no Scope, no Acceptance Criteria, no Technical Plan
- **Vague content** — sections that exist but lack specifics (e.g., "fix the bug" with no repro steps)
- **Missing codebase analysis** — no file references, no technical plan
- **Too large** — the issue describes work that should be multiple PRs
- **Wrong format** — uses non-standard headers or structure

### Step 3: Enrich

Run the same codebase analysis and observability queries as in Create mode (Phase 1). Use the findings to:
- Add a **Technical Plan** or **Technical Analysis** section with specific files and approach
- Fill in missing **Scope** (App + Area)
- Add concrete **Acceptance Criteria** if missing
- Add **observability data** (Grafana log links, Amplitude usage data) if relevant
- Tighten vague descriptions with specifics from the code

### Step 4: Split if needed

If the issue is too large for a single PR, propose splitting it into child issues following the same rules as Phase 3 in Create mode. Present the split plan to the user before executing.

### Step 5: Confirm & Update

Show the user a diff — what the description looks like now vs what you propose. Let them adjust.

Then update the existing issue:

```bash
cat <<'EOF' > /tmp/linear-issue-desc.md
<updated description>
EOF

linear issue update <issue-id> \
  --description-file /tmp/linear-issue-desc.md
```

If splitting into sub-issues, create the new child issues with `--parent <issue-id>` after updating the parent.

If the title also needs improvement, update it in the same command:

```bash
linear issue update <issue-id> \
  --description-file /tmp/linear-issue-desc.md \
  --title "<improved title>"
```

## Tips

- If the user dumps a Sentry error or stack trace, extract the key info and query Grafana Loki for related logs
- If the user references a Figma link or GitHub discussion, include it in the "What" section
- Multiple apps affected? List them all in the Scope and consider splitting by app
- Multiple areas? List the primary one first
- For large features, the parent issue description should contain the full technical plan; child issues reference it
- When in doubt about PR size, err on the side of smaller — aim for S (50–199 lines). An L label on a PR is a code review red flag
