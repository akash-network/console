# Tx Signer

Internal service that signs and broadcasts Akash transactions.

## Endpoints

- `GET /healthz` health check
- `POST /v1/tx/funding` sign and broadcast with the funding wallet
- `POST /v1/tx/derived` sign and broadcast with a derived wallet
- `GET /v1/wallets/funding` addresses of the funding wallets, the seed phrase one first
- `GET /v1/wallets/derived/{index}` address of the user wallet at an index (`?version=v1` for its first-generation address)
- `POST /v1/wallets/provider-tokens` provider access token signed by the user wallet at an index

## Configuration

Copy `env/.env.sample` to the env file you use and set:

- `PORT`
- `RPC_NODE_ENDPOINT`
- `RPC_REQUEST_TIMEOUT_MS`
- `FUNDING_WALLET_MNEMONIC_V2`
- `DERIVATION_WALLET_MNEMONIC_V2` (or seed `v2` in `DERIVATION_WALLET_SEEDS_ENCRYPTED`)
- `DERIVATION_WALLET_MNEMONIC_V1` (optional)
- `DERIVATION_SEED_KMS_KEY` and `DERIVATION_WALLET_SEEDS_ENCRYPTED` (optional, see below)
- `GAS_DEFAULT_MULTIPLIER`
- `GAS_RECOVERY_MULTIPLIER`
- `AVERAGE_GAS_PRICE`
- `UNORDERED_TX_TTL_MS`
- `SIGN_AND_BROADCAST_DEADLINE_MS`

`SIGN_AND_BROADCAST_DEADLINE_MS` bounds how long a sign-and-broadcast can take, so a caller's
request timeout is never what abandons a transaction still in flight. Keep `apps/api`'s
`TX_SIGNER_REQUEST_TIMEOUT_MS` above it.

`RPC_REQUEST_TIMEOUT_MS` must stay below `UNORDERED_TX_TTL_MS`. Transactions are signed as unordered,
so every payload sent to the node carries its own validity window, and a call allowed to outlive that
window comes back rejected as expired instead of naming whatever went wrong on the wire. The config
refuses to start when either relationship is broken.

`DERIVATION_WALLET_MNEMONIC_V1` is only read to answer first-generation wallet addresses, never to sign.
Without it `GET /v1/wallets/derived/{index}?version=v1` answers 501. Set it to the seed `apps/api` derives
first-generation wallets from (its `DERIVATION_WALLET_MNEMONIC_V1`, or `OLD_MASTER_WALLET_MNEMONIC` where
that one is unset) before removing the seeds from `apps/api`, which needs those addresses for usage history.

### Derivation seeds

User wallets are derived from a seed phrase, and each seed has a version (`v1`, `v2`, ...). A request names the
version of the wallet it is about and gets `v2` when it names none. `v1` only answers addresses; nothing is signed
with it.

A seed can be given readable (`DERIVATION_WALLET_MNEMONIC_V1`, `DERIVATION_WALLET_MNEMONIC_V2`) or encrypted.
For encrypted seeds:

- `DERIVATION_SEED_KMS_KEY` is the Cloud KMS symmetric key, as `projects/*/locations/*/keyRings/*/cryptoKeys/*`.
  The signer needs decrypt permission on it and nothing else.
- `DERIVATION_WALLET_SEEDS_ENCRYPTED` lists `version:ciphertext` pairs separated by commas, for example
  `v2:CiQA...,v3:CiQB...`. Each ciphertext is the seed phrase encrypted with that key (`gcloud kms encrypt`),
  in base64.
- `GCP_WORKLOAD_IDENTITY_AUDIENCE` must be set, as for funding wallets held in Cloud KMS.

The signer decrypts every seed before it starts listening and keeps them in memory only. If one cannot be
decrypted, or does not decrypt to a seed phrase, the signer logs `DERIVATION_SEED_UNAVAILABLE` and does not start.
A version given both readable and encrypted is refused, so moving a seed means adding its ciphertext and removing
the readable setting in the same change. Adding a seed version is configuration only.

## Local dev

- `npm run dev` watch build
- `npm run prod` run compiled server

## Tests

- `npm run test`
- `npm run test:unit`
- `npm run test:functional`
