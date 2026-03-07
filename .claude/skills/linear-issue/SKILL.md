---
name: linear-issue
description: Plan, create, and improve Linear issues by analyzing the codebase and breaking work into small, reviewable chunks. Use this skill whenever the user wants to create a Linear issue, improve an existing one, file a bug, plan a feature, create a chore/enabler, or mentions "linear issue", "file an issue", "create a ticket", "log a bug", "new issue", "plan this work", "improve this issue", or "clean up this ticket". Also trigger when the user says "I found a bug", "we need a ticket for...", "can you create an issue for...", "break this down into issues", or pastes a Linear issue URL/ID. This is the required way to create and maintain issues — it ensures every issue follows the team's format and is scoped for small PRs.
---

# Linear Issue Planner & Creator

This skill does three things: **analyzes** the codebase to understand the problem space, **creates** well-structured Linear issues scoped for small reviewable PRs, and **improves** existing issues to match the team's standards.

The goal is consistency across the team — every issue clearly defines the problem and acceptance criteria, and is small enough that the resulting PR is easy to review. Implementation details (specific files, approach, abstractions) belong in the PR description, not the issue.

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

## Project Assignment

Every issue must be assigned to a project. **Suggest** a project based on the scope-to-project mapping below, then ask the user to confirm or change it before creating the issue.

### How to suggest a project

1. Run `linear project list --all-teams` to get the current list of projects — names and slugs change over time, never hardcode them.
2. Based on the issue's context (scope, type, source, description), suggest the most fitting project.
3. Present your suggestion and let the user confirm: *"I'd suggest project **X** for this. Does that work, or should it go elsewhere?"*

Note: "Console" (CON) is the **team**, not a project. All issues belong to team CON and are assigned to a project within it.

When creating the issue, use `--project "<project name>"` in the CLI command.

## Source Labels

Every issue should have a source label indicating where it came from. Infer from context or ask the user:

| Label | When to use |
|-------|------------|
| `source:customer` | User/customer reported the issue (support ticket, feedback, user complaint) |
| `source:error-log` | Discovered via Grafana, Sentry, error logs, or monitoring alerts |
| `source:internal` | Team-identified improvement, tech debt, or internal request |
| `source:roadmap` | Planned feature from product roadmap, Figma designs, or product specs |

If the user pastes a Sentry error or Grafana alert → `source:error-log`. If they say "a user reported..." → `source:customer`. If they describe a planned feature or link Figma → `source:roadmap`. Internal cleanup or DX improvements → `source:internal`.

Include the source label alongside the type label (Bug/Feature/Improvement) using multiple `--label` flags.

## Initial Status

Set the initial workflow status based on issue readiness:

| Status | When to use |
|--------|------------|
| **Triage** | Default for most new issues — needs validation/prioritization by tech lead |
| **Backlog** | Issue is well-defined with clear acceptance criteria but not yet prioritized for a cycle |
| **Todo** | Issue is fully ready to pick up — has all context, is prioritized, and a dev can start immediately |

Use `--status "<status>"` in the CLI command. Default to **Triage** unless the user explicitly says the issue is ready to work on.

## Workflow

### Phase 1: Gather Context

#### From the user
Ask the user what they need. If they give enough context upfront, don't interrogate — fill in what you can and confirm the rest.

Infer the **source** from how the user describes the issue (customer report, error log, internal idea, roadmap item). If unclear, ask.

#### From observability tools (when relevant)
Before diving into code, check if observability data can inform the issue — especially for bugs and production incidents.

**Grafana** — Use when investigating errors, performance issues, or production behavior. Search logs for errors and stack traces, find elevated error patterns, identify slow requests, check metrics (error rates, latency, resource usage), find relevant dashboards, and check for existing alerts or active incidents.

**Amplitude** — Use when understanding user behavior or impact. Query event data to understand scope/frequency, watch session replays, find relevant charts or experiments, and check if users have reported the issue.

Use ToolSearch to discover available methods on these MCP servers before calling them. Only query what's relevant — don't run every tool on every issue. For bugs, Grafana logs and error patterns are usually most valuable. For features, Amplitude usage data helps scope the impact.

Include findings in the issue description — link to specific dashboards, paste key log lines, or note error rates. Redact tokens, emails, user IDs, and any sensitive payload fields before posting. This gives reviewers and implementers real data instead of guesses.

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

### Phase 2: Define the Problem

Issues should clearly capture **what** needs to happen and **why**. This is the core of the issue — it lives in Linear forever and must be useful to anyone who reads it.

What belongs in the issue:
- **Problem statement** — what's wrong or what's needed
- **Acceptance criteria** — how we know it's done
- **Risks / edge cases** — anything tricky the implementer should know
- **Dependencies** — does this depend on or block other work?
- **Scope** — which area of the codebase is affected

#### Suggested Solution

Add a high-level suggested approach — enough to scope the work and unblock the implementer, but not so detailed that it becomes stale or creates pressure to execute as written.

Keep it directional (e.g., "add a polling mechanism to the deploy status page" not "modify `src/components/DeployStatus.tsx` line 42"). Specific file paths, prescribed abstractions, and line-by-line plans go stale fast and belong in the PR description — written by the implementer who has full context from actually working in the code.

**For non-trivial work, suggest a throwaway spike first.** 20 minutes of exploration on a throwaway branch surfaces where existing abstractions don't fit and where the plan would break down. The issue written after a spike is significantly better than one written from static analysis alone.

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
- **Vertical slices** (preferred) — each issue delivers a narrow but complete slice of functionality across layers, giving reviewers full context. A reviewer seeing "add deploy status polling" understands the change; "add utils layer" does not.
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
- Area: <area from .commitlintrc.json scopes>
```

#### Feature / Story

```markdown
## Why
[One sentence on the user problem or business need.]

## What
[What we're building. Link Figma/discussion if applicable.]

## Acceptance Criteria
- [ ] ...
- [ ] ...

## Scope
- Area: <area from .commitlintrc.json scopes>

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

## Scope
- Area: <area from .commitlintrc.json scopes>
```

**Drop any section that has no content** — empty placeholders are worse than no section.

### Phase 5: Confirm & Create

Show the user ALL issues you plan to create with the following details for each:
- **Title** and **description**
- **Suggested project** (from scope mapping) — ask user to confirm or change
- **Source label** (inferred from context)
- **Type label** (Bug/Feature/Improvement)
- **Initial status** (Triage by default)
- **Priority** (if known)
- **Ordering** (for multi-issue plans)

Let them adjust before you create anything.

Then create each issue using the Linear CLI:

```bash
DESC_FILE=$(mktemp /tmp/linear-issue-desc.XXXXXX.md)
cat <<'EOF' > "$DESC_FILE"
<description content>
EOF

linear issue create \
  --title "<title>" \
  --description-file "$DESC_FILE" \
  --no-interactive \
  --team "CON" \
  --project "<project name>" \
  --status "<Triage|Backlog|Todo>" \
  --label "<Bug|Feature|Improvement>" \
  --label "<source:customer|source:error-log|source:internal|source:roadmap>" \
  [--priority <1-4>] \
  [--assignee "<assignee>"] \
  [--parent "<parent-issue-id>"]

rm "$DESC_FILE"
```

Always use `--description-file` (not inline `--description`) and `--no-interactive`. Use `mktemp` for unique temp file names to avoid collisions.

For multi-issue plans, create the parent issue first, then create child issues with `--parent` pointing to the parent's ID.

After creation, show the user all issue identifiers/URLs.

## Valid Scope Values

Area values come from the `scopes` field in `.commitlintrc.json`. Always read that file for the current list — do not hardcode values. These are business domains (e.g., `deployment`, `billing`, `auth`), not app names.

## Labeling Convention

Each issue gets **two labels** — one for type and one for source:

**Type labels** (based on issue type):
- Bug → label `Bug`
- Feature / Story → label `Feature`
- Enabler / Chore → label `Improvement`

**Source labels** (based on where the issue came from):
- `source:customer` — customer/user reported
- `source:error-log` — discovered via monitoring/logs
- `source:internal` — team-identified
- `source:roadmap` — planned from roadmap

Use multiple `--label` flags in the CLI command to apply both labels.

## Improve Existing Issues

When the user references an existing issue, the goal is to bring it up to team standards — add missing sections, enrich with codebase analysis, and optionally split it into smaller issues.

### Step 1: Fetch the issue

```bash
linear issue view <issue-id> --json --no-pager
```

This returns the full issue data as JSON including title, description, state, labels, assignee, parent, and sub-issues.

### Step 2: Analyze gaps

Compare the current description against the appropriate template (Bug / Feature / Enabler). Identify:
- **Missing sections** — e.g., no Scope, no Acceptance Criteria
- **Vague content** — sections that exist but lack specifics (e.g., "fix the bug" with no repro steps)
- **Missing context** — no codebase references, no observability data
- **Too large** — the issue describes work that should be multiple PRs
- **Wrong format** — uses non-standard headers or structure

### Step 3: Enrich

Run the same codebase analysis and observability queries as in Create mode (Phase 1). Use the findings to:
- Add a **Technical Analysis** section for bugs (root cause, affected area)
- Fill in missing **Scope** (Area)
- Add concrete **Acceptance Criteria** if missing
- Add **sanitized observability data** (Grafana log links, Amplitude usage data) if relevant — redact PII/secrets
- Tighten vague descriptions with specifics from the code

### Step 4: Split if needed

If the issue is too large for a single PR, propose splitting it into child issues following the same rules as Phase 3 in Create mode. Present the split plan to the user before executing.

### Step 5: Confirm & Update

Show the user a diff — what the description looks like now vs what you propose. Let them adjust.

Then update the existing issue:

```bash
DESC_FILE=$(mktemp /tmp/linear-issue-desc.XXXXXX.md)
cat <<'EOF' > "$DESC_FILE"
<updated description>
EOF

linear issue update <issue-id> \
  --description-file "$DESC_FILE"

rm "$DESC_FILE"
```

If splitting into sub-issues, create the new child issues with `--parent <issue-id>` after updating the parent.

If the title also needs improvement, add `--title "<improved title>"` to the update command.

## Tips

- If the user dumps a Sentry error or stack trace, extract the key info and query Grafana Loki for related logs
- If the user references a Figma link or GitHub discussion, include it in the "What" section
- Multiple areas affected? List the primary one first and consider splitting by area
- For large features, the parent issue should describe the overall goal and acceptance criteria; child issues handle individual slices
- When in doubt about PR size, err on the side of smaller — aim for S (50–199 lines). An L label on a PR is a code review red flag
