# Akash Console — x402 USDC top-up example

A standalone, copy-paste agent client that funds an Akash Console balance with USDC over the
[x402](https://github.com/x402-foundation/x402) payment protocol — no credit card required.

It runs the full loop:

1. `POST /v1/x402/top-up?amount=<usd>` with no payment → **402 Payment Required** (the challenge).
2. Signs the challenge with your wallet → `X-PAYMENT` header.
3. `POST` again with `X-PAYMENT` → **200**, the payment settles on-chain and your Console balance is credited.
4. `GET /v1/x402/transactions` → reads your own history back and prints the `transactionId`.

**Defaults are Base Sepolia testnet**, so a copy-paste run can never spend mainnet USDC. The client
also refuses to sign a payment whose challenge advertises a known mainnet network unless you set
`X402_ALLOW_MAINNET=true`.

This directory is standalone — it has its own `package.json` and is **not** part of the Console
monorepo build.

## Prerequisites (manual, funded-wallet step)

You need a **testnet** wallet with a small amount of Base Sepolia USDC and ETH:

1. Create/choose a throwaway EVM wallet and copy its private key. **Never use a mainnet key with real funds.**
2. Get Base Sepolia ETH (for gas) from a faucet, e.g. the Coinbase or Alchemy Base Sepolia faucet.
3. Get Base Sepolia test USDC from Circle's testnet faucet (https://faucet.circle.com, select Base Sepolia).
4. Create a Console API token/key for the account whose balance you want to credit.

> This funding step is manual and cannot be automated here — the wallet must hold real testnet
> USDC before the payment can settle.

## Setup

```bash
cd examples/x402
npm install
cp .env.example .env
# edit .env: set CONSOLE_API_TOKEN and X402_PRIVATE_KEY (testnet), adjust AMOUNT_USD
```

## Run

```bash
npm start          # node --env-file=.env top-up.ts
# or
npx tsx top-up.ts  # if you load env another way
```

Expected output (abridged):

```
Wallet 0xabc… requesting a $5 top-up at https://console-api-sandbox.akash.network/v1/x402/top-up?amount=5
Server accepts: 5000000 of 0x036CbD… on eip155:84532 -> 0x…
Payment settled. transactionId=1a2b3c…
Read-back from GET /v1/x402/transactions:
{ "transactionId": "1a2b3c…", "status": "succeeded", "amountUsdCents": 500, … }

Done. transactionId=1a2b3c… status=succeeded
```

## Environment variables

| Variable             | Required | Default                                        | Purpose                                                        |
| -------------------- | -------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `CONSOLE_API_TOKEN`  | yes      | —                                              | Bearer token / API key of the account being credited.         |
| `X402_PRIVATE_KEY`   | yes      | —                                              | **Testnet** private key of the wallet that pays the USDC.     |
| `CONSOLE_API_BASE`   | no       | `https://console-api-sandbox.akash.network`    | Console API base URL.                                         |
| `AMOUNT_USD`         | no       | `5`                                            | Top-up size in USD (must be within the server's min/max).     |
| `X402_ALLOW_MAINNET` | no       | unset                                          | Set `true` to permit signing on mainnet networks (real USDC). |

## How it maps to the SDK

The client is built on the installed x402 v2 packages:

- `@x402/core/client` — `x402Client` + `x402HTTPClient` (parse the 402, create the payment payload, encode the `X-PAYMENT` header).
- `@x402/evm/exact/client` — `registerExactEvmScheme` to sign `exact`-scheme EVM payments.
- `viem` — `privateKeyToAccount` provides the signer.

If you prefer the one-liner wrapper, `@x402/fetch`'s `wrapFetchWithPayment(fetch, account)` composes
the same pieces into a drop-in `fetch`; this example uses the lower-level client so the 402 → sign →
retry steps are explicit.

See [`../../doc/x402/USAGE.md`](../../doc/x402/USAGE.md) for the raw `curl` walkthrough, the full
`X402_*` server env matrix, custody notes, and the no-refund limitation.
