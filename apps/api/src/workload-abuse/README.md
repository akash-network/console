# Blocked email domains

Mining spam arrives on the free trial from domains the attacker registered for the purpose. When the workload
probe wipes a trial wallet, this turns that single catch into a block on the whole domain it signed up from.

The `blocked_email_domains` table is the contract. The admin console reads and writes it directly — `apps/api`
ships no CRUD for it — so a `CHECK` constraint enforces that every `domain` is stored lowercase, trimmed, with
no `@` and at least one dot. An unnormalized row would never match a lookup, which is a blocklist that has
quietly stopped blocking.

## What blocks what

| Column               | Meaning                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `status = 'blocked'` | New accounts refused, trials refused, sibling trial wallets wiped                |
| `status = 'allowed'` | Never blocked, and the auto-blocker leaves it alone for good                     |
| `source`             | `auto` for the probe's own blocks, `manual` for anything the admin console wrote |

To un-block a domain, set its status to `allowed` rather than deleting the row. Deleting it lets the next
detection on that domain block it again; `allowed` is the decision that sticks, because the auto-blocker inserts
with `ON CONFLICT DO NOTHING` and any existing row wins.

Lookups are cached in-process for `WORKLOAD_ABUSE_BLOCKED_DOMAIN_CACHE_TTL_SECONDS` (60 by default), so an
admin-console write takes effect within a minute on every pod.

## Guardrails

A domain is auto-blocked only when none of these hold. Each skip is logged as `EMAIL_DOMAIN_AUTO_BLOCK_SKIPPED`
and counted in `workload_abuse_domain_blocks_total{result="skipped"}` with the reason as a label:

- `public_provider` — the domain is on the list in `lib/email-domain/public-email-providers.ts`. That list lives
  in code, not in rows, so it works with an empty database and cannot be deleted by mistake.
- `domain_has_paid_user` — somebody on the domain has completed a real purchase. Manual credits and coupon
  claims deliberately do not count: both are granted to trial users, so counting them would let a comped
  account shield a spam domain.
- `domain_predates_attack` — the domain has an account older than
  `WORKLOAD_ABUSE_DOMAIN_BLOCK_MIN_ACCOUNT_AGE_DAYS` (30), which means it is somebody's real domain.
- `allowlisted` — an operator already said no.

Matching is exact. `mail.attacker.com` and `attacker.com` are separate rows, because deriving the registrable
domain needs the Public Suffix List and `foo.co.uk` would otherwise reduce to `co.uk`.

## Rollout

`WORKLOAD_ABUSE_DOMAIN_BLOCK_MODE=detect` (the default) evaluates every guardrail and logs the verdict as
`EMAIL_DOMAIN_AUTO_BLOCK_DRY_RUN` without writing a row or wiping a wallet. Soak in `detect`, read the skip
distribution, eyeball the domains that would have been blocked, then switch to `enforce`.

Fastest kill switch first: turn off the `blocked_email_domain_enforcement` Unleash flag (stops every lookup,
takes seconds), or set one domain to `allowed` from the admin console, or drop back to `detect` to stop new
auto-blocks.

`WORKLOAD_ABUSE_DOMAIN_BLOCK_MAX_SIBLINGS` (200) bounds how many wallets one block can wipe. Hitting it is
logged and counted as `sibling_limit_reached`, and means a human should look before the sweep runs again.

## The Auth0 Action

Auth0 stays the front door. The Action is not in this repo — it lives in the tenant — and it calls:

```
POST /internal/auth/email-domain-check
x-console-internal-token: <INTERNAL_API_TOKEN>
{ "email": "user@example.com" }

200 { "blocked": true }
```

Two details decide whether this is safe.

**Use the `post-login` trigger.** `pre-user-registration` fires only for database connections, so a social
signup would walk straight past it.

**Deny only on the first login.** Without the `logins_count` check the Action bans everyone on the domain,
including customers who registered long before the attacker did — which is exactly what the API side goes out
of its way not to do.

**Fail open.** If this endpoint is unreachable the Action must allow the login. A blocklist that takes the
whole tenant down when the API restarts is worse than the spam.

```js
exports.onExecutePostLogin = async (event, api) => {
  if (event.stats.logins_count !== 1) return;

  let blocked = false;

  try {
    const response = await fetch(`${event.secrets.CONSOLE_API_URL}/internal/auth/email-domain-check`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-console-internal-token": event.secrets.CONSOLE_INTERNAL_TOKEN
      },
      body: JSON.stringify({ email: event.user.email }),
      signal: AbortSignal.timeout(1500)
    });

    if (!response.ok) return;

    blocked = (await response.json()).blocked === true;
  } catch {
    return;
  }

  if (blocked) {
    api.access.deny("Unable to sign in with this email address.");
  }
};
```
