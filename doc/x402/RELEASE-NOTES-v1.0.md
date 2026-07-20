# x402 v1.0 — Release Notes

Branch: `feat/x402-v1-0-readback-and-onramp`

## Theme

Turn the shipped `POST /v1/x402/top-up` endpoint into an adoption on-ramp: agents can read their own
payments back, copy-paste a working client, branch on stable error codes, and follow first-class docs.
Everything here is **additive** — the existing top-up flow is unchanged in behaviour.

## What shipped

### 1. Payment read-back — `GET /v1/x402/transactions`

- New route on `x402Router` (`operationId: listUsdcTopUps`), `X402Controller.listTransactions()`,
  and `X402TransactionRepository.findByUserPaginated()`.
- Paginated (`limit` 1–100, default 25; `offset` default 0), newest-first. Each row exposes
  `transactionId`, `status`, `amountUsdCents`, `currency`, `network`, `asset`, `settlementTxHash`,
  `payerAddress`, `createdAt`.
- **IDOR-safe:** the query is scoped to the authenticated user id explicitly in the repository
  (`eq(userId)`), in addition to the CASL ability. A caller can never read another user's rows and
  passes no user id of their own. Covered by `x402.controller.spec.ts`.

### 2. Stable, machine-readable error codes

Error bodies now carry a stable `code` field alongside the HTTP status, defined once in
`billing/services/x402/x402-error-codes.ts`:

| HTTP | `code`                 | Source                                   |
| ---- | ---------------------- | ---------------------------------------- |
| 402  | `PAYMENT_REQUIRED`     | challenge (no payment attached)          |
| 402  | `PAYMENT_INVALID`      | verify/settlement failure                |
| 400  | `AMOUNT_OUT_OF_BOUNDS` | amount outside min/max bounds            |
| 409  | `DUPLICATE_PAYMENT`    | payment already used for a top-up        |
| 404  | `X402_DISABLED`        | x402 not enabled                         |

`400`/`404` codes are emitted from the controller via `http-errors` (`data.errorCode`, rendered by the
shared `HonoErrorHandlerService`); `402`/`409` are emitted from the service/router into the JSON body.

### 3. Example agent client — `examples/x402/`

- `top-up.ts`: full loop — trigger `402`, sign `X-PAYMENT`, retry to settle + credit, then poll
  `GET /v1/x402/transactions` and print the `transactionId`.
- Built on the installed x402 v2 client API (`@x402/core/client` `x402Client` + `x402HTTPClient`,
  `@x402/evm/exact/client` `registerExactEvmScheme`, `viem` signer). `@x402/fetch`'s
  `wrapFetchWithPayment` is documented as the equivalent one-liner.
- **Testnet-safe:** defaults to Base Sepolia and refuses to sign a mainnet challenge unless
  `X402_ALLOW_MAINNET=true`.
- Standalone package (own `package.json` + `tsconfig.json`), **not** part of the monorepo workspaces,
  so it never affects the Console build. Ships `.env.example` and `README.md` with the funded-wallet
  step spelled out.

### 4. Docs

- `doc/x402/USAGE.md`: `X402_*` env matrix, a single `curl` walkthrough (`402` → `X-PAYMENT` →
  credit → read-back), the error-code table, the treasury-custody note for `X402_PAY_TO_ADDRESS`, and
  an explicit **NO-REFUND** limitation statement.

## Decisions

- **Explicit `userId` filter over ability-only scoping.** The `X402Payment` CASL subject grants read
  unconditionally (no `userId` condition in `ability.service.ts`), so relying on the ability alone
  would leak all users' rows. The repository therefore filters by the authenticated user id
  explicitly; the ability is still applied on top.
- **`PAYMENT_REQUIRED` vs `PAYMENT_INVALID`.** Both are `402`. The initial challenge (no `X-PAYMENT`)
  is `PAYMENT_REQUIRED`; a `402` after a verify/settlement failure (payment header present) is
  `PAYMENT_INVALID`, letting agents distinguish "I still need to pay" from "my payment was rejected".
- **Example built on the low-level client, not `@x402/fetch`.** `@x402/fetch` is not present in this
  repo's dependency tree, whereas `@x402/core`/`@x402/evm`/`viem` are — building on them means the
  example genuinely typechecks against installed packages while remaining a faithful, explicit
  402→pay→retry loop.
- **Codes centralised** in one module and referenced by controller, service, router, and docs so the
  contract cannot drift.

## Verification

- `npx tsc -p tsconfig.build.json --noEmit` in `apps/api`: clean.
- `npx eslint` on all touched dirs (`--quiet`): clean.
- `npx vitest run --project=unit` on `x402.controller.spec.ts` + `x402.service.spec.ts`: 11 passing.
- `examples/x402`: `tsc --noEmit` clean (against the repo's installed `@x402/*` + `viem`).

## Manual / left for a live run

- **Funded-wallet dogf/E2E:** actually settling a payment needs a wallet holding Base Sepolia testnet
  USDC + gas and a running Console API. The steps are documented in `examples/x402/README.md`; the
  client and server both typecheck and unit-test green, but a real settlement was not executed here
  (no network / funded testnet in this environment).
- No DB migration was needed — `GET /v1/x402/transactions` reads the existing `x402_transactions`
  table (which already indexes `(user_id, created_at)`).
