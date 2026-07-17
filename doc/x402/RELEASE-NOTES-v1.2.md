# x402 v1.2 — Testnet path, pre-settle guardrails, thin discovery endpoint

Branch: `feat/x402-v1-2-sandbox-and-discovery`

All work is additive on top of the v1 core top-up flow. No breaking changes to the existing
`POST /v1/x402/top-up` contract.

## 1. Base Sepolia (testnet) support + sandbox firewall

- `X402_NETWORK` may now be set to a testnet CAIP-2 id such as `eip155:84532` (Base Sepolia),
  enabling the full flow against a facilitator without real USDC.
- **Firewall (fail-fast at config-parse time):** a testnet settlement network is only allowed when
  the Akash `NETWORK` env is not `mainnet`. If `NETWORK=mainnet` and `X402_NETWORK` is a known
  testnet, `envSchema` parsing throws, so the API refuses to boot. This guarantees a testnet
  settlement (worthless funds) can never settle and credit a real mainnet balance.
- Testnet classification is a single source of truth:
  `apps/api/src/billing/config/x402-networks.ts` (`X402_TESTNET_NETWORKS` / `isX402TestnetNetwork`).
  The firewall lives in `apps/api/src/billing/config/env.config.ts` as a `superRefine` on the schema.
- The firewall only blocks the testnet→mainnet direction, so the default mainnet `X402_NETWORK`
  (`eip155:8453`) continues to parse on sandbox/testnet deployments (x402 is off by default there).
- Spec: `apps/api/src/billing/config/env.config.spec.ts` — proves mainnet+testnet fails, and
  sandbox/testnet configs accept the testnet network, plus the default-on-sandbox case.

## 2. Pre-settle guardrails in `X402Service`

After the facilitator verifies a payment (`processHTTPRequest`) but **before** `processSettlement`,
`validatePreSettle` re-validates the requirement about to be settled. On any mismatch the verified
payment is cancelled via the cancellation dispatcher and settlement is never invoked, so a bad
payment is never settled or credited. Explicit 402 codes are returned in the response body:

- `WRONG_NETWORK` — settled requirement network differs from the configured `X402_NETWORK`, or the
  payer's authorized network differs from the requirement.
- `WRONG_ASSET` — the payer authorized a different asset than the requirement.
- `AMOUNT_MISMATCH` — the payer's authorized amount differs from the requirement amount.

The rejection surfaces as a new `X402TopUpProcessResult` variant `{ type: "payment-rejected", code }`
carried through the controller/router as an HTTP 402 with `{ x402Version, error: <code>, accepts }`.

- Spec: added cases in `apps/api/src/billing/services/x402/x402.service.spec.ts` proving each code is
  returned, `processSettlement`/`topUpWallet` are never called, and the happy path still settles.

## 3. `GET /v1/x402/discovery` (public)

- New public (`SECURITY_NONE`, no `@Protected`) endpoint returning the x402 resource list and accepts
  (route, scheme, network, asset/amount bounds in USD, `payTo`, `maxTimeoutSeconds`).
- **Single canonical source:** `X402Service.getCanonicalRoutes()` is the one place route + accepts are
  declared. Both the 402 flow (`buildRoutesConfig()` → the http-server factory) and discovery
  (`getDiscovery()`) derive from it, so the accepts a 402 returns and the accepts discovery advertises
  can never drift.
- Spec: `x402.service.spec.ts` asserts the discovery content and that discovery accepts stay in sync
  with the routes config passed to the 402 http-server factory (scheme/network/payTo/route).

## Files touched

- `apps/api/src/billing/config/x402-networks.ts` (new)
- `apps/api/src/billing/config/env.config.ts`
- `apps/api/src/billing/config/env.config.spec.ts` (new)
- `apps/api/src/billing/services/x402/x402.service.ts`
- `apps/api/src/billing/services/x402/x402.service.spec.ts`
- `apps/api/src/billing/controllers/x402/x402.controller.ts`
- `apps/api/src/billing/routes/x402/x402.router.ts`
- `apps/api/src/billing/http-schemas/x402.schema.ts`

## Verification

- `npx tsc -p tsconfig.build.json --noEmit` — clean (apps/api).
- `npx eslint` on touched dirs `--quiet` — clean.
- `npx vitest run --project=unit x402.service.spec.ts env.config.spec.ts` — 18 passed.

## Notes / left for later

- Real testnet dogfooding requires a funded testnet wallet + a facilitator that settles on Base
  Sepolia; not exercised here (no network access). The code path and config are in place — the manual
  step is: set `NETWORK=sandbox`, `X402_ENABLED=true`, `X402_NETWORK=eip155:84532`,
  `X402_FACILITATOR_URL=<testnet facilitator>`, and run a signed top-up.
- Testnet network set in `x402-networks.ts` covers common EVM testnets; extend it if a new
  settlement testnet is added.
- Discovery expresses amount bounds in USD (`minAmountUsd`/`maxAmountUsd`) since the route price is a
  USD amount resolved to an on-chain USDC amount by the scheme/facilitator at 402 time.
