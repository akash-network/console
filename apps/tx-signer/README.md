# Tx Signer

Internal service that signs and broadcasts Akash transactions.

## Endpoints

- `GET /healthz` health check
- `POST /v1/tx/funding` sign and broadcast with the funding wallet
- `POST /v1/tx/derived` sign and broadcast with a derived wallet

## Configuration

Copy `env/.env.sample` to the env file you use and set:

- `PORT`
- `SERVER_ORIGIN`
- `RPC_NODE_ENDPOINT`
- `FUNDING_WALLET_MNEMONIC_V1`
- `FUNDING_WALLET_MNEMONIC_V2`
- `DERIVATION_WALLET_MNEMONIC_V1`
- `DERIVATION_WALLET_MNEMONIC_V2`
- `GAS_SAFETY_MULTIPLIER`
- `AVERAGE_GAS_PRICE`
- `WALLET_BATCHING_INTERVAL_MS`

## Local dev

- `npm run dev` watch build
- `npm run prod` run compiled server

## Tests

- `npm run test`
- `npm run test:unit`
- `npm run test:functional`
