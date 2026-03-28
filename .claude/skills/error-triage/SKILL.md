---
name: error-triage
description: "Scan #console-alerts for production errors, investigate Sentry issues in depth, and triage them into Linear issues. Use this skill whenever the user says 'check alerts', 'check console-alerts', 'triage alerts', 'what\\'s going on in alerts', 'any new errors', 'check for errors', 'scan alerts', 'look at console-alerts', 'what\\'s firing', or anything about reviewing the alerts channel. Also trigger when the user mentions Sentry alerts, Sentry errors, Sentry issues, Grafana alerts, production errors, 500 errors, error spikes, 'investigate sentry', 'check sentry', 'what\\'s in sentry', 'are there any issues', on-call alerts, or monitoring alerts. Reads #console-alerts via Slack, investigates each error using Sentry and Grafana MCP tools, deduplicates against Linear, and proposes well-structured bug issues for anything new."
---

# Error Triage

Scan #console-alerts, diagnose what's actually broken, and create Linear issues for anything new — without duplicates.

## Workflow

### Step 1: Read #console-alerts

Use Slack MCP tools to read recent messages from the alerts channel.

```
Use ToolSearch to find: slack_read_channel
Read recent messages from #console-alerts.
```

Also read threads on alert messages — team members often add context like "this started after the last deploy" or "I'm looking into this" that changes whether an issue is needed.

Focus on:
- Messages from the **last 24 hours** (unless the user specifies a different timeframe)
- 500-level errors and unhandled exceptions
- Sentry alerts (high error rate, new issues)
- Grafana alerts (pod restarts, latency spikes, resource exhaustion)
- Recurring patterns — the same error appearing multiple times is more urgent

**Recognizing alert formats** — the channel receives two main types:

**Grafana alerts** look like:
> [FIRING:1] **5xx by service, except 503 console** (prod console-api-mainnet)
> Labels: alertname, grafana_folder, namespace, service_name
> Annotations: summary (describes the condition, e.g., "HTTP 5xx errors > threshold")
> Links: Logs | HTTP 5xx Errors | Source | Silence | Dashboard | Panel

Extract the service name from labels, the error condition from the summary annotation, and follow the Logs/Dashboard links if you need to investigate further via Grafana MCP tools.

**Sentry alerts** look like:
> **Critical: Deploy-Web: High Error Rate**
> 101.0 events in the last hour
> Started: March 25th at 6:21 AM
> [View on Sentry →]

Extract the severity level (Critical/Warning), the affected service (e.g., Deploy-Web), the event count and timeframe, and the start time. The Sentry link leads to the issue detail page — use it in the Linear issue description.

**Grafana alerts often appear as empty messages in the Slack MCP** because they use rich-format cards that don't render as text. **Never skip these.** Each empty message corresponds to a real alert. To investigate:

1. Extract the service name from surrounding context (nearby messages, thread replies, or the daily summary bot)
2. Query Loki logs via Grafana MCP to find the actual errors for that service and timeframe
3. Use text filters for nested JSON logs — e.g., `|= '"level":"error"'` — because the `detected_level` Loki label often shows "info" even when errors exist inside nested JSON structures
4. Assess whether the errors are user-side (e.g., insufficient balance, client disconnections) or system bugs requiring a Linear issue

The `find_error_pattern_logs` tool may not be available (Sift plugin). Fall back to `query_loki_logs` with text filters.

**Check reactions and threads** — the team uses emoji reactions to signal alert status:
- :eyes: — someone is looking into it
- :white_check_mark: (checkmark) — the alert has been addressed
- Thread replies often contain the **Linear issue link** for the fix

If an alert has a checkmark reaction, it's been handled. If it has eyes, someone is investigating — note who. If a thread reply contains a Linear issue link (e.g., `CON-XXX`), record it so you can skip the duplicate check for that alert.

Skip:
- Deployment approval requests (CI/CD notifications)
- Alerts with :white_check_mark: reactions (already addressed)
- Informational messages that aren't errors

### Step 2: Categorize and prioritize

Group related alerts together and rank by severity. Alerts from the same root cause should be a single item, not separate entries.

Present a summary table:

| # | Category | Severity | Count | Status |
|---|----------|----------|-------|--------|
| 1 | Description | Critical/High/Medium/Low | N alerts | Needs issue / Known / Resolved |

For each category, include:
- **What's happening**: The error in plain terms
- **Timeline**: When it started, how often it's firing
- **Team context**: Did anyone comment on it in Slack? Is someone already investigating?
- **Correlation**: Is this related to other alerts in the channel? (e.g., a node going down causes a cascade of Grafana alerts)

### Step 3: Investigate (for items that need issues)

For each alert category that needs attention, investigate enough to write a useful issue. The goal is to give the implementer a head start, not to solve the bug.

**Search the codebase**: This is a monorepo with apps under `apps/` and packages under `packages/`. Use the error details (endpoint, service name, error message) to find the relevant code.

**Query Grafana** — always do this for Grafana alerts (especially "empty" Slack messages):
```
Use ToolSearch to find relevant Grafana tools:
- query_loki_logs — search application logs for the error pattern
- query_prometheus — check error rate metrics
- list_loki_label_values — discover service names and namespaces
```

When querying Loki, use the `beenf7rks2e4gd` datasource UID. Filter by `service_name` label and use text filters like `|= '"level":"error"'` for nested JSON. The `detected_level` label is unreliable for error filtering.

Useful things to look for: frequency, timeline (does it correlate with a deploy?), scope (one user or many?), whether errors are user-side (insufficient funds, closed deployments, client disconnections) vs system bugs.

**Investigate Sentry errors** — always do this for Sentry alerts:

```
Use ToolSearch to find Sentry tools:
- search_issues — find the Sentry issue by error message, service, or title
- search_issue_events — list recent error events for a specific issue
- get_issue_tag_values — check scope: affected users, browsers, OS, release
- analyze_issue_with_seer — get AI-powered root cause analysis
- get_sentry_resource — fetch issue details by URL or ID
```

**Sentry investigation workflow:**

1. **Find the issue**: Use `search_issues` with keywords from the Slack alert (error message, service name). Use the `query` parameter with Sentry search syntax (e.g., `is:unresolved level:error service:deploy-web`).

2. **Assess scope and impact**: Use `get_issue_tag_values` on the issue to check:
   - `user` — how many unique users are affected?
   - `release` — did this start with a specific deploy?
   - `browser` / `os` — is it platform-specific?
   - `url` / `transaction` — which pages/endpoints are affected?

3. **Examine recent events**: Use `search_issue_events` to look at the latest occurrences. Check:
   - Stack traces — identify the failing code path
   - Request data — what inputs trigger the error?
   - Breadcrumbs — what happened before the error?

4. **Get AI analysis** (when available): Use `analyze_issue_with_seer` for automated root cause analysis. This provides:
   - Likely root cause
   - Suggested fix direction
   - Related issues

5. **Correlate with code**: Use the stack trace to find the relevant source files in the monorepo. Check recent git history for changes that may have introduced the error.

6. **Summarize findings**: For each Sentry error, record:
   - Error type and message
   - Affected service and endpoint/page
   - First seen / last seen / event count
   - Number of affected users
   - Release correlation (if any)
   - Root cause hypothesis
   - Relevant code location in the monorepo

Don't over-investigate — if the alert and a quick code search tell you enough to write a clear issue, stop there. Match investigation depth to the complexity of the problem.

### Step 4: Check Linear for duplicates

Before proposing any new issue, search Linear for existing ones. Duplicate issues waste everyone's time.

```bash
# List recent team issues and grep for keywords (--filter flag doesn't exist)
linear issue list --team CON --sort priority --no-pager --json | grep -i "keyword"

# Check recent issues in case the wording is different
linear issue list --team CON --no-pager --json | head -50
```

**What counts as a duplicate** — use judgment:
- Same feature area + similar symptoms = likely duplicate
- Same root cause, different manifestation = duplicate
- Existing issue covers broader scope that includes this error = not a duplicate, but note the connection
- An issue exists but is marked Done while the error is still firing = may need reopening

When you find a match, report:
- The issue ID, title, and current status
- Your confidence level that it's the same problem
- Whether the existing issue needs updating (e.g., "error rate has increased since this was filed")

### Step 5: Propose issues (with user approval)

For each alert that needs a new issue and has no duplicate, draft a Linear issue.

**Format** — follow the project's conventions:

```bash
DESC_FILE=$(mktemp /tmp/linear-issue-desc.XXXXXX.md)
cat <<'EOF' > "$DESC_FILE"
## What's broken
[One sentence. Include Sentry/Grafana links if available.]

## Repro
1. [Steps or: "Triggered by X condition based on log analysis"]

## Expected vs Actual
Expected: [what should happen]
Actual: [what happens instead]
EOF

linear issue create \
  --title "<concise title with service and symptom>" \
  --description-file "$DESC_FILE" \
  --no-interactive \
  --team "CON" \
  --project "<project name>" \
  --state "Triage" \
  --label "Bug" \
  --label "source:error-log" \
  [--priority <1-4>]

rm "$DESC_FILE"
```

**Title format**: Include the affected service and the symptom:
- "deploy-web: sustained high client-side error rate triggering Sentry Critical alerts"
- "API returns 500 on GET /v1/providers when provider attributes are null"
- "Grafana alerts fire false positives during Prometheus restarts"

**Labels**: Always `Bug` + `source:error-log`. Use `Improvement` instead of `Bug` for operational issues (like noisy alerts).

**Project**: Run `linear project list --all-teams` to suggest the right project.

**Present all proposed issues together** before creating any. Let the user approve, adjust, or skip each one. Only create after approval.

### Step 6: Present the full triage

End with a summary table showing what action was taken for each alert category:

| # | Alert | Action | Linear Issue | Priority |
|---|-------|--------|-------------|----------|
| 1 | ... | Create new issue | Pending approval | P1 |
| 2 | ... | Duplicate of CON-XXX | — | — |
| 3 | ... | Resolved (:white_check_mark:) | CON-YYY (linked in thread) | — |
| 4 | ... | Being investigated (:eyes: by @person) | — | — |

### Step 7: Mark messages as attended

Every alert message should be attended to. After triage is complete, reply in the thread of each alert message to mark it:

- **✅** — Reply with "✅" when the alert is resolved, a false positive, or user-side errors that need no action. Include a brief explanation (e.g., "✅ User-side errors — insufficient balance and closed deployments, no action needed").
- **👀** — Reply with "👀" when human attention is needed (e.g., the alert is real but requires investigation beyond what triage can do).
- When a Linear issue was created, include the **full Linear URL** in the reply (e.g., "✅ Created https://linear.app/akash-network/issue/CON-147/..."). Never use just "CON-147" as plain text — always link it.
- When an alert maps to an existing Linear issue, reply with the full URL to that issue.

**Avoid duplicate replies** — Sentry metric alerts that fire repeatedly (e.g., "Critical: Deploy-Web: High Error Rate" firing 6 times in a day) all thread under the **same parent message** in Slack. Before replying:

1. **Read the thread first** to check for existing replies (from this session or previous triage sessions).
2. **One reply per Sentry thread** — all repeated firings of the same metric alert share one Slack thread. Post a **single consolidated reply** to the thread with the full investigation summary. Do NOT post separate replies for each sub-alert — that's noise.
3. **Don't re-reply** — if a thread already has a triage reply (e.g., "✅ CON-147"), skip it unless you have new information to add (e.g., newly filed sub-issues).
4. **Same for Grafana** — if multiple empty-message alerts resolve to the same root cause, reply once to each unique parent thread, not to every sub-message.

**Sentry alert replies** — post one detailed reply per Sentry thread:

```
✅ Investigated via Sentry:
• Error: <error type and message>
• Scope: <N users affected, N events in last 24h>
• Release: <release version if correlated, or "no release correlation">
• Root cause: <one-sentence hypothesis>
• Action: <Created CON-XXX / Duplicate of CON-XXX / User-side, no action needed>
<full Linear URL if applicable>
```

This gives the team a quick summary without needing to open Sentry. Adjust the format based on what the investigation uncovered — skip fields that aren't relevant (e.g., omit "Release" if there's no release correlation).

**Finding the parent message** — to reply to the correct thread, identify the **earliest message** from that Sentry alert rule. All subsequent firings of the same rule will be threaded under it. Reply to the parent (earliest) message's `thread_ts`, not to individual sub-alerts.

The Slack MCP doesn't support adding emoji reactions, so thread replies with emoji text are the workaround. The goal: by end of day, every message in #console-alerts has a thread reply showing it's been attended to.

## Important Notes

- **Redact sensitive data**: Never include tokens, API keys, user emails, wallet addresses, or PII in Linear issues. Sanitize log snippets.
- **Business-level issues**: Describe what's broken in user-facing terms, not implementation details. "Deployment creation fails" not "line 42 throws TypeError".
- **Link your sources**: Include links to Sentry alerts, Grafana dashboards, or Slack threads in the issue description.
- **Always use full Linear URLs**: When referencing issues in Slack replies or anywhere external, use the full `https://linear.app/akash-network/issue/CON-XXX/...` URL, not just the issue ID.
- **Don't create issues for resolved incidents**: If the team already fixed something and confirmed it in-thread, note it in the summary but don't create an issue.
- **Group related alerts**: A node going down that triggers 30 Grafana alerts is one issue, not 30.
- **Distinguish user-side vs system errors**: Many Loki log errors are user-caused (insufficient funds, closed deployments, client disconnections). These don't need Linear issues — just mark the alert as attended with an explanation.
