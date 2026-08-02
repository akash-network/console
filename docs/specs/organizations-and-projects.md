# Organizations & Projects

**Status:** Draft · **Team:** Console · **Linear:** Organizations & Projects

---

## Summary

Console is single-tenant-per-user. This spec introduces **organizations** — a team boundary that owns billing and the managed wallet — and **projects**, a grouping *and* permission boundary inside an organization.

After this change: a company pays once, its engineers share the workloads they deploy, and those workloads are filed into projects that individual members can be granted or denied access to.

---

## Motivation

Every owned row in Console hangs off `userSetting.id`, and every authorization rule is `conditions: { userId: "${user.id}" }`. The hard constraint is `user_wallets.user_id UNIQUE`: a user has exactly one managed wallet.

That matters more than it looks. A deployment's on-chain identity is `(owner_address, dseq)`, and the owner address *is* the managed wallet. **The wallet is the tenancy boundary.** Consequences today:

- Two people cannot see or manage the same workload. A teammate cannot restart a service their colleague deployed.
- Billing is attached to a person. A company cannot pay for its engineers' usage, and an engineer leaving takes the payment relationship with them.
- There is no way to separate staging from production, or one client's workloads from another's, beyond naming conventions held in browser local storage.

---

## Concepts

**Organization** — the billing and ownership boundary. Owns the managed wallet, the Stripe customer, payment methods, transactions and credit. One wallet per organization, so all members deploy under one on-chain owner address.

**Project** — a grouping inside an organization, and a permission boundary. Every deployment belongs to exactly one project. Every organization has a `Default` project.

**Personal organization** — auto-created for every user, containing only them. It preserves today's behaviour exactly and stays invisible in the UI until the user creates or joins a real team.

### Roles

| Organization role | Can |
|---|---|
| `OWNER` | everything, including billing and deleting the organization |
| `ADMIN` | everything except billing and deleting the organization; cannot grant or remove `OWNER` |
| `MEMBER` | deploy and manage within granted projects |
| `BILLING` | payment methods, transactions, invoices; no deployment access |
| `VIEWER` | read-only within granted projects |

`OWNER` and `ADMIN` implicitly reach every project. `MEMBER` and `VIEWER` reach only projects they are explicitly granted, via project roles `PROJECT_ADMIN` / `PROJECT_MEMBER` / `PROJECT_VIEWER`.

An organization always has at least one `OWNER`.

---

## What this is *not*

Three boundaries that must be stated plainly, because the words "organization" and "project" carry expectations from AWS and GCP that this design does not meet.

**A project is not a confidentiality boundary.** All of an organization's deployments live under one *public* on-chain owner address. Anyone — member or not — can enumerate them directly from the chain. What the project boundary enforces is **mutation** (closing, funding and updating a deployment all route through our API) and **what the app shows you**. It does not make deployment existence secret.

**A project is not a spend boundary.** The on-chain deposit authorization is organization-wide and cannot carry a project id. Any member who can deploy in *any* project can spend the organization's entire balance, including on projects they cannot see. Per-project budgets (below) are a cooperative guardrail against accidental overspend and a basis for chargeback — not isolation. A true spend boundary would require one wallet per project, which is the trade we consciously made in exchange for shared workloads and a single credit pool.

**An organization is not a security boundary against its own admins.** An API key carries its owner's full organization role, so an `OWNER`'s key can delete the organization. Scoped keys are follow-up work.

---

## Data model

New tables:

| Table | Purpose |
|---|---|
| `organizations` | `name`, `slug`, `type` (personal/team), `stripe_customer_id`, `created_by_user_id`, `deleted_at` |
| `organization_members` | `(organization_id, user_id)` unique, `role` |
| `organization_invitations` | `email`, `role`, `project_grants`, `token_hash`, `status`, `expires_at` |
| `projects` | `(organization_id, slug)` unique, `is_default`, `deleted_at` |
| `project_members` | `(project_id, user_id)` unique, `role` |
| `trial_grants` | one row per granted free trial; unique on `user_id` *and* on `organization_id` |

Three structural decisions worth calling out:

- **`organizations` and `projects` are soft-deleted.** An organization owns a funded wallet whose on-chain address is derived from a database row; a cascading hard delete would orphan real funds.
- **Composite foreign keys.** Every project-bearing table carries `(organization_id, project_id) → projects(organization_id, id)`, which makes "a row whose project belongs to a different organization" impossible at the database level rather than merely unlikely at the query level. Likewise `project_members(organization_id, user_id) → organization_members(organization_id, user_id) ON DELETE CASCADE`, so removing someone from an organization drops all their project grants automatically.
- **A partial unique index on `created_by_user_id WHERE type = 'PERSONAL'`** is the database-level guarantee that every user has exactly one personal organization, and it is what makes the migration backfill idempotent and re-runnable.

Existing tables gain `organization_id` (and `project_id` where relevant): `user_wallets`, `wallet_settings`, `payment_methods`, `stripe_transactions`, `deployment_settings`, `api_keys`, `template`. `Users.stripeCustomerId` moves to `organizations.stripe_customer_id`.

The existing `user_id` columns are **kept but demoted to an actor/audit role** — "who created this", not "who owns this". Dropping them is irreversible and cannot be rolled back mid-deploy; keeping them is free and preserves audit history. They are removed from every authorization condition and repository filter.

### Invariants

- **`user_wallets.id` is the BIP-44 derivation index.** The transaction signer derives the signing key from it, and historical address resolution depends on it. The migration is therefore a pure column addition plus an `UPDATE`: no row recreation, no re-keying, no sequence reset. `apps/tx-signer` requires **zero changes**. A CI guard asserts `(count, min(id), max(id))` on `user_wallets` is unchanged across the migration chain.
- **The `ON DELETE CASCADE` from users to wallets and deployment settings must go.** Under organizations, deleting a member would otherwise destroy the only record of the index↔address mapping and silently disable auto-top-up on live deployments — a billing incident, not a UX bug.
- **Stripe idempotency key formulas do not change.** Keys are opaque namespaces; changing one mid-flight makes a client retry across a deploy boundary produce a different key, and therefore a duplicate charge. New organizations get a new namespace instead.
- **Payer is never derived from ambient context.** A refund for a purchase made in organization A must debit organization A, read off the transaction row, even if the person who made it has since moved to organization B.

---

## Authorization

Three layers, in order of trust:

1. **Tenant predicate** — a new `OrgScopedRepository` base class ANDs `organization_id = <active org>` into every query it builds, **unconditionally**. Today's ability filtering is opt-in per call site, which means a repository method that forgets to opt in returns everything. This layer is what actually prevents cross-organization leakage.
2. **Ability rules** — role → action → subject, with project scoping.
3. **Route guards** — coarse action gates at the controller boundary.

### Active organization resolution

Resolved per request, in order: the API key's bound organization → the `x-organization-id` header → the user's default organization (if still a member) → their personal organization. An API key combined with a *differing* header is rejected rather than silently resolved. Non-membership returns 403.

An optional `x-project-id` header may narrow the scope to a single project; it can never widen it.

### Ability rules

The current rule table is compiled by string-templating a JSON blob (`template(JSON.stringify(rules))`). This is replaced by typed rule factories. Three reasons:

- Project scoping needs `projectId IN (...)`. An array interpolated into a JSON string literal does not error — it silently becomes the string `"id1,id2,id3"` and yields a broken predicate.
- The existing translation layer has no `in` operator at all, so such a rule would throw at query time.
- The current approach carries a latent production bug independent of this work: a user whose email contains a `"` produces malformed JSON and a 500 on every request.

Rules become:

```ts
const inOrg = c => ({ organizationId: c.organizationId });
const inScope = c =>
  c.projectScope.kind === "ALL"
    ? { organizationId: c.organizationId }
    : { organizationId: c.organizationId, projectId: { $in: c.projectScope.ids } };
```

The project scope is a discriminated union rather than an optional array, so that "admin, all projects" and "context not set" cannot be confused — otherwise the data layer fails open.

Two rules SQL cannot express are enforced in services, both requiring a locking read: an `ADMIN` may not grant or remove `OWNER`, and the last `OWNER` may not be demoted or removed.

---

## Deployments and projects

A deployment has no database record today — the list is read straight from the chain by owner address, and deployment names live in browser local storage. With one owner address per organization, that no longer works: the API must decide which deployments a given member may see.

`deployment_settings` becomes the authoritative per-deployment record, gaining `organization_id`, `project_id`, `owner_address`, `name`, `created_height` and `state`. Rows are created eagerly rather than lazily — a deployment with no project is invisible to every restricted member while still billing the organization.

Three layers guarantee a row exists:

1. **Write-ahead at creation.** The deployment sequence number is generated before the transaction is broadcast, so the record is written first and marked active on success. Writing after the broadcast would mean a deployment that exists on-chain but not in our database, which then reconciles into the default project — invisible to the very member who created it.
2. **A safety net at the signing chokepoint**, catching any path that bypasses the primary flow.
3. **Reconciliation** — periodically diffing the on-chain set against the database, filing strays into the default project and closing records whose deployments have ended.

Listing becomes database-first: an ability-filtered query with real pagination and search, hydrating only the current page from the chain. The alternative — fetching everything from the chain and filtering client-side — cannot paginate a project, and would fetch hundreds of deployments to show a member the three they can see.

This moves the deployment list from a direct chain query onto the API, and moves deployment names from local storage into the account.

---

## Billing

The credit layer itself is unchanged: balances, spending authorization and signing are already keyed by wallet or address, not by user. The change is one of routing — which wallet, and who pays.

- The Stripe customer moves from the user to the organization, including all webhook reverse lookups, with a temporary fallback to the legacy user link so that webhooks already in flight during the migration still resolve. Stripe retries for three days.
- Top-ups, refunds, auto-reload, transaction history and CSV export all become organization-scoped, while recording the acting user separately.
- Wallet provisioning moves from user registration to organization creation, staying idempotent so existing self-healing paths still work.
- Analytics keeps the **acting user** as the identity and adds the organization as a property. Using an organization id as the analytics identity would silently fork every user's identity graph.
- Members joining a team do not bring their payment methods; cards belong to the organization that attached them.

---

## Trial and bonus abuse

This is the highest-risk consequence of the change and must ship in the same release as organization creation.

Today the ceiling is one free trial per verified email, held up by `user_wallets.user_id UNIQUE`. Once users can create organizations, it becomes one trial *per organization* — unbounded per person. The existing fingerprint checks all exclude by user id, so against many organizations owned by one user they are completely blind.

The same hole applies to the first-purchase bonus: 10% up to $100 **per organization**. That is real money.

The mechanism is the `trial_grants` table, whose two unique indexes *are* the enforcement — an atomic insert replaces a check-then-act race. It is backfilled from existing activated wallets so that current users cannot claim a fresh trial. On top of it, as policy rather than mechanism: trials only on personal organizations (behind a flag, so relaxing it later is a one-line change), owner/admin only, and trial organizations cannot invite members. The first-purchase bonus gains a matching per-person cap, backed by a partial unique index, which is deliberately *not* cleared on refund.

Organization creation is additionally rate-limited per user, which caps every organization-multiplied abuse vector at once — including ones not yet thought of.

---

## Frontend

The active organization is held in a cookie and translated into an `x-organization-id` header at the API proxy. A `?org=<slug>` query parameter acts as a one-shot override that writes the cookie and is stripped from the URL, which preserves deep-link sharing without restructuring the router. Organization administration pages carry the slug in the path; application pages keep their current flat URLs.

Two details that are easy to get wrong:

- Server-side rendering calls the API directly rather than through the proxy, so without a per-request client it would silently read the user's *personal* organization while the browser reads the team's. The fix is a request-scoped API client; mutating the shared client's headers would leak one request's organization into another's response.
- Switching organizations clears the query cache wholesale. The active organization travels in a header the client never sees, so it is not part of any cache key, and selective invalidation would require hand-maintaining a list of every organization-sensitive endpoint.

The personal organization stays invisible until the user has a team, so an existing user's interface is unchanged. The one permanent addition is a "Create organization" entry in the account menu.

Two one-line omissions would break the feature outright: the onboarding gate must allow the invitation and organization routes, or an invitee without a wallet is redirected into the first-deployment funnel and the invite link is dead; and a newly created team must be provisioned a non-trial wallet immediately, or the same gate redirects its creator to onboarding.

---

## Migration and rollout

Three migrations:

1. **Structure** — new enums, tables, and nullable columns on existing tables. Metadata-only; no table rewrite.
2. **Backfill** — hand-written and idempotent: a personal organization and owner membership per user, a default project per organization, then `organization_id` onto every child table.
3. **Tighten** — drop the old user-scoped uniques, set `NOT NULL`, add the new uniques and composite foreign keys.

Migrations 1 and 2 are backward-compatible and ship a release early. Migration 3 must ship *with* the application code that requires organization context: in the window between them, an old instance still running would insert rows without an organization and migration 3 would then fail.

Pre-flight checks run before writing the backfill (duplicate Stripe customer ids, deployment sequence numbers shared across users, orphaned templates, and a baseline of the wallet id range). Post-backfill assertions run before tightening.

Two operations cannot live inside a migration: concurrent index builds (which cannot run in a transaction) and `SET NOT NULL` on a large table, which needs the validated-check-constraint approach instead. Both are decided per table from live row counts.

Stripe customer metadata sync and historical deployment-to-project attribution are background jobs, not migrations.

---

## Notifications service

The notifications service is a separate database with no foreign keys to the main one; headers are the entire trust contract. The proxy gains organization, role and project-scope headers, and the guard that rejects client-supplied identity headers must be generated from the same list that mints them — the two lists drifting apart is exactly how a client would forge its own tenancy.

Alerts and notification channels gain organization scoping, and the "one default channel" constraint re-keys from user to organization, or every member of a team gets their own default and the organization has several.

The backfill cannot be a migration, because that database cannot see users or organizations. It is a one-shot script holding both connections, run as an explicit deploy step between the schema change and the `NOT NULL` change.

---

## Phasing

| Phase | Contents |
|---|---|
| **0** | Data model and backfill; ability engine rewrite; default-on tenant scoping; active-organization resolution; wallet and Stripe customer move to the organization. Nothing user-visible. |
| **1** | Behind a feature flag: create an organization, invite and accept, member and role management, project CRUD and project grants, organization switcher, deployments filed into projects, deployment list on the API, deployment names persisted. |
| **1.5** | Must land before full rollout: organization-scoped API keys, trial and bonus caps, project picker in the deploy flow, billing and usage re-labelled to the organization. |
| **2** | Schema tightening; per-project spend attribution and budgets; notification scoping; organization-prefixed application routes; audit log. |

---

## Open questions

- **Rolling deploy or brief write freeze** for the tightening migration and the actor-column rename.
- **Who receives deployment alerts in a team?** The current command assumes a single person. Phase-1 answer: whoever deployed.
- **Deleting an organization that still holds credit.** Credit is an on-chain grant to an address only that organization's key can spend, and there is no path to refund it to members. Proposed: block deletion while a balance or active leases remain.
- **Trial state on organization switch.** Trial status is per-wallet, so it flips when moving between a trialing personal organization and a paid team, changing the wallet banner and the provider allow-list.
- **API key privilege.** A key carries its owner's full role. Scoped keys are a small addition now and a breaking change later.
- **Cached responses.** Any cacheable organization-scoped `GET` needs to vary on the organization header, or a shared cache will serve one organization's data to another.
