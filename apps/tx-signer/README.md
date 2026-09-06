# Tx Signer

Internal service that signs and broadcasts Akash transactions.

## Endpoints

- `GET /healthz` health check
- `POST /v1/tx/funding` sign and broadcast with the funding wallet
- `POST /v1/tx/derived` sign and broadcast with a derived wallet

## Configuration

Copy `env/.env.sample` to the env file you use and set:

- `PORT`
- `RPC_NODE_ENDPOINT`
- `RPC_REQUEST_TIMEOUT_MS`
- `FUNDING_WALLET_MNEMONIC_V2`
- `DERIVATION_WALLET_MNEMONIC_V2`
- `GAS_DEFAULT_MULTIPLIER`
- `GAS_RECOVERY_MULTIPLIER`
- `AVERAGE_GAS_PRICE`
- `UNORDERED_TX_TTL_MS`
- `SIGN_AND_BROADCAST_DEADLINE_MS`

`SIGN_AND_BROADCAST_DEADLINE_MS` bounds how long a sign-and-broadcast can take, so a caller's
request timeout is never what abandons a transaction still in flight. Keep `apps/api`'s
`TX_SIGNER_REQUEST_TIMEOUT_MS` above it.

## Local dev

- `npm run dev` watch build
- `npm run prod` run compiled server

## Tests

- `npm run test`
- `npm run test:unit`
- `npm run test:functional`
