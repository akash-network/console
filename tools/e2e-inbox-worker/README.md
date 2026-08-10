# e2e Inbox Worker

Cloudflare Email Worker backing the deploy-web Playwright e2e suite. Auth0 sends passwordless OTP emails to `*@<your-e2e-domain>`; a catch-all Email Routing rule delivers them to this Worker, which parses each message with `postal-mime` and stores it in D1. The tests poll `GET /messages/:email` (bearer-token protected) to read the OTP.

D1 is used instead of Workers KV because D1 reads are read-after-write consistent across colos; KV's eventual consistency (up to ~60s) would make freshly delivered codes intermittently invisible to the polling tests.

## HTTP API

```
GET /messages/:email
Authorization: Bearer <INBOX_API_TOKEN>
```

Returns messages for the recipient, newest first:

```json
[{ "id": "…", "receivedMs": 1754000000000, "subject": "…", "text": "…" }]
```

Any other path/method returns 404; a missing or wrong token returns 401. Messages older than 24h are excluded from reads, and are deleted on each incoming email and by an hourly scheduled cron so nothing lingers if delivery stops.

## One-time setup

Prerequisites: access to the Akash Cloudflare account and a **dedicated domain** used only for e2e mail.

> [!WARNING]
> Enable Email Routing only on a domain registered exclusively for these tests. Cloudflare Email Routing **replaces the domain's MX records** and cannot run alongside an external mail provider, so activating it on a domain that already carries real mail (for example a primary company domain) would break that domain's email.

1. **Dedicated email domain**: register a domain used only for this (any cheap TLD works, since it only receives mail) and add it to Cloudflare as its own zone. In that zone, open Email Routing and enable it so Cloudflare adds the MX/SPF records. Set `E2E_INBOX_EMAIL_DOMAIN` to this domain.
2. **Create the database** — from this directory:
   ```bash
   npm install
   npx wrangler d1 create console-e2e-inbox
   ```
   Copy the printed `database_id` into `wrangler.jsonc`, then apply the schema:
   ```bash
   npm run db:apply
   ```
3. **Set the API token secret** — generate a long random string (e.g. `openssl rand -hex 32`):
   ```bash
   npx wrangler secret put INBOX_API_TOKEN
   ```
4. **Deploy**:
   ```bash
   npm run deploy
   ```
   The endpoint lives on the printed `https://console-e2e-inbox.<account>.workers.dev` URL.
5. **Catch-all rule** — In Email Routing for your e2e domain, enable catch-all with action "Send to a Worker" > `console-e2e-inbox`.
6. **Sanity check** — send any email to `anything@<your-e2e-domain>`, then:
   ```bash
   curl -H "Authorization: Bearer $INBOX_API_TOKEN" \
     https://console-e2e-inbox.<account>.workers.dev/messages/anything@<your-e2e-domain>
   ```
7. **Wire up CI** — in the GitHub repo settings add:
   - secret `E2E_INBOX_API_TOKEN` — the token from step 3
   - variable `E2E_INBOX_API_URL` — the workers.dev URL from step 4
   - variable `E2E_INBOX_EMAIL_DOMAIN` — your dedicated e2e domain

## Local development

```bash
npm install
npm run db:apply:local
npm run dev
```

`wrangler dev` uses a local D1 and reads `INBOX_API_TOKEN` from a `.dev.vars` file (`INBOX_API_TOKEN=local-token`). Inject a fake email through wrangler's local email endpoint:

```bash
curl -X POST 'http://localhost:8787/cdn-cgi/handler/email?from=no-reply@auth0.com&to=probe@example.com' \
  --data-raw 'From: no-reply@auth0.com
To: probe@example.com
Subject: Your verification code
Message-ID: <local-test-1@example.com>
Content-Type: text/plain

Your verification code is: 123456'
```

Then read it back:

```bash
curl -H "Authorization: Bearer local-token" 'http://localhost:8787/messages/probe@example.com'
```

## Deploying changes

Deployment is manual: edit, then `npm run deploy` from this directory. There is no CI pipeline for this Worker; keep the deployed version in sync with `main`.
