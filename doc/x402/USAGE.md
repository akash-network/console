# x402 USDC top-up — Usage

Fund your Akash Console balance with USDC over the [x402](https://github.com/x402-foundation/x402)
payment protocol instead of a credit card. This works for both humans and AI agents: any x402-capable
client can pay a `402` challenge and have the settled USDC credited to a Console balance.

- Endpoints: `POST /v1/x402/top-up` (pay) and `GET /v1/x402/transactions` (read your history back).
- Auth: `Authorization: Bearer <token>` or `x-api-key: <key>` — the same auth the rest of the Console API uses.
- Runnable agent client: [`examples/x402/top-up.ts`](../../examples/x402/top-up.ts).

## Server configuration (`X402_*` env matrix)

Set these on the `apps/api` service. x402 is **off by default**; it turns on only when both
`X402_ENABLED=true` and a valid `X402_PAY_TO_ADDRESS` are present.

| Variable                | Required           | Default                          | Description                                                                              |
| ----------------------- | ------------------ | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `X402_ENABLED`          | yes (to enable)    | `false`                          | Master switch. `"true"` / `"false"`.                                                     |
| `X402_PAY_TO_ADDRESS`   | yes (to enable)    | —                                | EVM address (`0x…`, 40 hex) that **receives** the USDC. See custody note below.          |
| `X402_NETWORK`          | no                 | `eip155:8453` (Base mainnet)     | CAIP-2 network id payments settle on. Use `eip155:84532` (Base Sepolia) for testing.     |
| `X402_FACILITATOR_URL`  | no                 | `https://x402.org/facilitator`   | x402 facilitator used to verify + settle payments.                                       |
| `X402_MIN_TOP_UP_USD`   | no                 | `1`                              | Minimum accepted top-up amount, USD.                                                     |
| `X402_MAX_TOP_UP_USD`   | no                 | `1000`                           | Maximum accepted top-up amount, USD.                                                     |

> When `X402_ENABLED=true` but `X402_PAY_TO_ADDRESS` is unset, x402 stays disabled and `POST
> /v1/x402/top-up` returns `404` with code `X402_DISABLED`.

## The full loop with `curl`

### 1. Request a top-up with no payment → `402` challenge

```bash
curl -i -X POST "$CONSOLE_API_BASE/v1/x402/top-up?amount=5" \
  -H "Authorization: Bearer $CONSOLE_API_TOKEN"
```

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 2,
  "code": "PAYMENT_REQUIRED",
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "amount": "5000000",
      "payTo": "0xYourTreasuryAddress",
      "maxTimeoutSeconds": 300
    }
  ]
}
```

### 2. Retry with a signed `X-PAYMENT` header → `200` and credit

Your wallet signs the challenge and produces the base64 `X-PAYMENT` value (the SDK does this for you;
see the example client). Then repeat the request:

```bash
curl -i -X POST "$CONSOLE_API_BASE/v1/x402/top-up?amount=5" \
  -H "Authorization: Bearer $CONSOLE_API_TOKEN" \
  -H "X-PAYMENT: <base64-signed-payment-payload>"
```

```http
HTTP/1.1 200 OK
X-PAYMENT-RESPONSE: <base64-settlement-receipt>
Content-Type: application/json

{
  "data": {
    "transactionId": "1a2b3c4d-…",
    "amountUsdCents": 500,
    "network": "eip155:84532",
    "settlementTxHash": "0x…",
    "payerAddress": "0x…"
  }
}
```

The payment is settled **on-chain before** the balance is credited, and crediting is idempotent per
signed payment (identified by a SHA-256 of the payload), so a retried or replayed `X-PAYMENT` never
double-credits.

### 3. Read your own top-up history back

```bash
curl -s "$CONSOLE_API_BASE/v1/x402/transactions?limit=25&offset=0" \
  -H "Authorization: Bearer $CONSOLE_API_TOKEN"
```

```json
{
  "data": [
    {
      "transactionId": "1a2b3c4d-…",
      "status": "succeeded",
      "amountUsdCents": 500,
      "currency": "usd",
      "network": "eip155:84532",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "settlementTxHash": "0x…",
      "payerAddress": "0x…",
      "createdAt": "2026-07-17T12:00:00.000Z"
    }
  ],
  "pagination": { "limit": 25, "offset": 0, "total": 1 }
}
```

`GET /v1/x402/transactions` only ever returns the authenticated caller's own transactions — the query
is scoped to your user id server-side, independent of any values you pass.

## Stable error codes

Error responses carry a machine-readable `code` field (in addition to the HTTP status) so agents can
branch on it without string-matching messages. These codes are stable API contract.

| HTTP | `code`                 | Meaning                                                                      |
| ---- | ---------------------- | ---------------------------------------------------------------------------- |
| 402  | `PAYMENT_REQUIRED`     | No payment attached yet; the body's `accepts[]` describes what to pay.        |
| 402  | `PAYMENT_INVALID`      | The attached payment failed verification or on-chain settlement.             |
| 400  | `AMOUNT_OUT_OF_BOUNDS` | `amount` is below `X402_MIN_TOP_UP_USD` or above `X402_MAX_TOP_UP_USD`.       |
| 409  | `DUPLICATE_PAYMENT`    | This signed payment was already used to credit a previous top-up.            |
| 404  | `X402_DISABLED`        | x402 payments are not enabled on this deployment.                            |

Example 409 body:

```json
{
  "error": "Conflict",
  "code": "DUPLICATE_PAYMENT",
  "message": "This payment was already used for a top-up",
  "transactionId": "1a2b3c4d-…"
}
```

## Treasury custody note (`X402_PAY_TO_ADDRESS`)

`X402_PAY_TO_ADDRESS` is the on-chain address that **receives every USDC payment**. Console does not
custody or manage the keys for this address — it is your treasury wallet and you are solely
responsible for its keys, security, and for sweeping/accounting the funds it accumulates. Point it at
an address you control (ideally a multisig or a dedicated treasury account), never at a facilitator,
exchange deposit address, or a wallet whose keys are shared. Payments settle directly to this address;
crediting the Console balance is a separate bookkeeping step performed after settlement is confirmed.

## Limitation: NO REFUNDS

**x402 top-ups are non-refundable.** Once a payment settles on-chain and the corresponding Console
balance is credited, the transaction is final and irreversible. There is no automated or manual refund
path for x402 payments: Console cannot return settled USDC, reverse an on-chain settlement, or convert
credited balance back to USDC. Verify the `amount` and the target account before signing. Testnet
defaults (Base Sepolia) exist precisely so you can rehearse the flow without risking real funds.
