---
name: linear-issue
description: Plan, create, and improve Linear issues with business-level clarity. Use this skill whenever the user wants to create a Linear issue, improve an existing one, file a bug, plan a feature, create a chore/enabler, or mentions "linear issue", "file an issue", "create a ticket", "log a bug", "new issue", "plan this work", "improve this issue", or "clean up this ticket". Also trigger when the user says "I found a bug", "we need a ticket for...", "can you create an issue for...", "break this down into issues", or pastes a Linear issue URL/ID. This is the required way to create and maintain issues — it ensures every issue follows the team's format and is scoped for small PRs.
---

# Linear Issue Planner & Creator

This skill helps **structure** well-defined Linear issues that serve as the source of truth for implementers and testers. Issues describe the **business problem and expected behavior** — never the implementation approach.

The human provides the business context. Claude helps structure it clearly, fill in gaps by asking questions, and ensure consistency with team standards. Claude does not invent business requirements or prescribe technical solutions.

## The Golden Rule: Business-Level Issues Only

Issues must be written at the **business level**. They define **what** needs to happen and **why** — not how to implement it. The implementer (human or AI) decides the technical approach.

**Never include in an issue:**
- File paths, class names, function names, or line numbers
- Step-by-step implementation plans
- Specific technical approaches or architectural prescriptions
- Code snippets or pseudo-code

**Always include in an issue:**
- The business problem or user need
- Expected behavior described in user-facing terms
- Affected business flows (e.g., "deployment creation flow", "billing authorization")
- Links to specs, Figma designs, AEPs, or discussions
- Acceptance criteria that an implementer or tester can validate against

The issue is the "protection line" — when an implementer says "I did everything the task says," the task must clearly define what success looks like in business terms.

### Good Example (GitHub #2859)

```markdown
## Why
We need to adjust prices to be displayed in ACT

## What
USDC will gone, so ACT needs to replace it in all places but instead of ACT
AEP-76 requires deploy-web to show `$`

There are few flows that should work:
1. Deployment creation flow
2. Money authorization creation flow
3. Add funds to escrow account

Transactions fee is paid in uAKT
```

Short. Business-focused. Describes the flows that need to work. No file paths. No implementation plan. An implementer knows exactly what to validate.

## Modes

This skill operates in two modes. Detect which one based on what the user asks:

1. **Create mode** — User wants new issues. Follow the full workflow below (Phase 1–5).
2. **Improve mode** — User references an existing Linear issue (by ID like `CON-123`, or URL). Follow the Improve Existing Issues workflow instead.

## Issue Types

There are three templates. Pick the one that matches what the user describes:

- **Bug** — Something is broken or behaving incorrectly
- **Feature / Story** — New functionality or enhancement driven by a user need
- **Enabler / Chore** — Internal improvement, tech debt, refactoring, CI/infra work

If the user doesn't specify a type, infer it from context. A report about something not working → Bug. A request for new behavior → Feature. Internal cleanup or tooling → Enabler.

## Project Assignment

Every issue must be assigned to a project. **Suggest** a project by querying the live project list, then ask the user to confirm or change it before creating the issue.

### How to suggest a project

1. Run `linear project list --all-teams` to get the current list of projects — names and slugs change over time, so always query the live list rather than relying on a static mapping.
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

The user's input is the primary source of business context. Claude cannot invent business requirements — if something is unclear, ask. Focus on understanding:
- What business problem are we solving?
- What user-facing behavior should change?
- Which business flows are affected?
- Are there specs, AEPs, Figma designs, or discussions to reference?

Infer the **source** from how the user describes the issue (customer report, error log, internal idea, roadmap item). If unclear, ask.

#### From observability tools (when relevant)
For bugs and production incidents, observability data adds real evidence to the issue description.

**Grafana** — Search logs for errors and stack traces, find error patterns, check error rates and latency. Include links to dashboards and key log lines in the issue.

**Amplitude** — Query event data to understand scope/frequency, check if users have reported the issue. Include usage numbers to quantify impact.

Use ToolSearch to discover available methods on these MCP servers before calling them. Only query what's relevant. Redact tokens, emails, user IDs, and any sensitive payload fields before posting.

The goal is to add **evidence** (error rates, affected user counts, log links) to the issue — not to derive implementation plans from the data.

### Phase 2: Define the Problem

Write the issue at the business level. It should be useful to anyone — implementer, tester, product manager, tech lead — as a source of truth for what needs to happen.

What belongs in the issue:
- **Problem statement** — what's wrong or what's needed, in business terms
- **Expected behavior** — what the user should experience when this is done
- **Affected flows** — which user-facing flows are impacted (e.g., "deployment creation", "wallet funding")
- **Acceptance criteria** — business-level conditions that define "done"
- **References** — links to AEPs, Figma, GitHub discussions, specs
- **Dependencies** — does this depend on or block other work? (tracked via native Linear relationships, not in the description — see Phase 5)

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

When splitting, each issue should still be a **business-level slice** — not a technical layer. "Add ACT pricing to deployment creation flow" is a good split. "Update utility functions" is not.

**How to split:**
- **By business flow** (preferred) — each issue covers one user-facing flow end-to-end
- **By feature boundary** — each independent piece of functionality gets its own issue
- **By risk** — risky changes (migrations, breaking API changes) get isolated into their own issue
- **Enablers first** — if the feature needs prerequisite work, that goes in a separate preceding issue

**Issue ordering:**
- The first issue should be the one that can be started immediately
- Each issue should be mergeable on its own without breaking anything
- Dependencies are tracked via native Linear relationships (blocked by / blocks / related), not in the description text — see Phase 5

**When NOT to split:**
- Simple bug fixes that are clearly small — just create one issue
- Small chores that are already atomic

### Phase 4: Fill Templates & Create Issues

For each issue, fill the appropriate template.

#### Bug

```markdown
## What's broken
[One sentence describing the broken behavior. Link to Sentry/Grafana if available.]

## Repro
1. ...
2. ...

## Expected vs Actual
Expected: [what the user should see/experience]
Actual: [what happens instead]
```

#### Feature / Story

```markdown
## Why
[The business need or user problem.]

## What
[What we're building, described in user-facing terms. Link Figma/AEP/discussion if applicable.]

Flows that should work:
1. [Business flow 1]
2. [Business flow 2]

## Acceptance Criteria
- [ ] [Business-level criterion a tester can validate]
- [ ] ...

## Notes
[References, edge cases. Do NOT list dependencies here — use native Linear relationships instead.]
```

#### Enabler / Chore

```markdown
## Why
[What this unblocks or improves — in business terms.]

## What
[What needs to change, described at the business level.]
```

**Drop any section that has no content** — empty placeholders are worse than no section.

### Phase 5: Confirm & Create

Show the user ALL issues you plan to create with the following details for each:
- **Title** and **description**
- **Suggested project** (from live project list) — ask user to confirm or change
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

After creation, **set up relationships** between issues using the Linear MCP `save_issue` tool. Linear supports these native relationship types — use them instead of writing dependencies in the description text:

| Relationship | `save_issue` field | Meaning |
|---|---|---|
| **Parent / Sub-issue** | `parentId` | Set during creation with `--parent` or via `save_issue({ id, parentId })` |
| **Blocked by** | `blockedBy: ["CON-123"]` | This issue cannot start until CON-123 is done |
| **Blocks** | `blocks: ["CON-456"]` | This issue must be done before CON-456 can start |
| **Related** | `relatedTo: ["CON-789"]` | Issues are related but don't block each other |

These fields are **append-only** — adding a new relationship never removes existing ones. To remove a relationship, use `removeBlockedBy`, `removeBlocks`, or `removeRelatedTo`.

**Example:** After creating three issues where issue 2 depends on issue 1, and issue 3 is related to both:

```
save_issue({ id: "CON-102", blockedBy: ["CON-101"] })
save_issue({ id: "CON-103", relatedTo: ["CON-101", "CON-102"] })
```

After creation, show the user all issue identifiers/URLs.

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

When the user references an existing issue, the goal is to bring it up to team standards — add missing business context and ensure it serves as a clear source of truth.

### Step 1: Fetch the issue

```bash
linear issue view <issue-id> --json --no-pager
```

### Step 2: Analyze gaps

Compare the current description against the appropriate template (Bug / Feature / Enabler). Identify:
- **Missing business context** — no "Why", no description of affected flows
- **Implementation details that don't belong** — file paths, code snippets, step-by-step plans
- **Vague acceptance criteria** — criteria that can't be validated by a tester
- **Too large** — the issue describes work that should be multiple PRs
- **Missing source label**

### Step 3: Enrich

Focus on adding **business clarity**:
- Add or improve the **Why** — what business problem does this solve?
- Describe **affected flows** in user-facing terms
- Write **acceptance criteria** a tester can validate without reading code
- Add **observability data** if relevant (error rates, user impact numbers, dashboard links)
- Remove any implementation details (file paths, code snippets, technical approach)

### Step 4: Split if needed

If the issue is too large for a single PR, propose splitting it into child issues — each covering a business flow or feature boundary. Present the split plan to the user before executing.

### Step 5: Confirm & Update

Show the user what you propose to change. Let them adjust.

Then update:

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

After updating, set up any missing relationships using the Linear MCP `save_issue` tool (see the relationship table in Phase 5). If the issue mentions dependencies in plain text, convert them to native `blockedBy`/`blocks`/`relatedTo` relationships and remove the text from the description.

## Tips

- If the user dumps a Sentry error or stack trace, extract the business impact (what's broken for users) and link the log — don't diagnose the code in the issue
- If the user references a Figma link, AEP, or GitHub discussion, include it in the "What" section
- Multiple areas affected? List the primary one first and consider splitting by area
- For large features, the parent issue should describe the overall goal; child issues handle individual business flows
- When in doubt about PR size, err on the side of smaller — aim for S (50–199 lines)
