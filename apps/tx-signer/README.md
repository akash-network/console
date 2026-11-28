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
- `FUNDING_CONTROLS_POSTGRES_URL` (optional, see "Funding freeze" and "Limits on what leaves the funding wallets")
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

### Funding freeze

An operator can stop the signer from spending a funding wallet's coins without a deploy, and let it spend again
the same way.

- `FUNDING_CONTROLS_POSTGRES_URL` names a Postgres database of the signer's own. Give each signer its own
  database, with a role `apps/api` has no credentials for: every signer reading a database obeys the freeze in
  it. Without this setting the signer keeps no state and nothing can be frozen.
- `npm run migration:exec` creates the tables. It reads `MIGRATION_DATABASE_URL`, so the role the signer runs
  with needs no right to change the schema.
- A signer given a database reads the freeze before it starts listening and does not start if it cannot.

From inside a signer pod:

```sh
node dist/funding-freeze.js status
node dist/funding-freeze.js freeze --reason "<why>" --by <who>
node dist/funding-freeze.js lift --by <who>
```

While funding is frozen the signer answers 503 to every request on `POST /v1/tx/funding`, and to every
`POST /v1/tx/derived` request that deposits from a grant, which is how a funding wallet's coins reach a
deployment. Everything else a user wallet does keeps working, closing and updating a deployment included, and
its fees are still paid by the funding wallet.

The freeze is read on every such request, so it applies from the next request on. If a read fails, the signer
goes by its last read for up to a minute and then refuses those requests until it can read again.

### Limits on what leaves the funding wallets

A signer given `FUNDING_CONTROLS_POSTGRES_URL` also counts the coins that leave the funding wallets, which is
every deposit a user wallet draws from a grant. Buying credits moves no coins, so a grant of any size is never
counted. A deposit is counted before its transaction is signed and taken back when the transaction did not
land; one whose outcome is undecided stays counted.

A limit bounds what may leave in any 24 hours, per denom, and is either reported or enforced:

- `--scope total` bounds all wallets together.
- `--scope wallet` bounds each wallet, or with `--wallet <address>` that one wallet, which then goes by its own
  limit instead of the one for each wallet.
- `--mode report` logs `FUNDING_OUTFLOW_LIMIT_EXCEEDED` and signs the deposit. `--mode enforce` logs it and
  answers 429, with nothing broadcast.
- From four fifths of a limit on, every deposit logs `FUNDING_OUTFLOW_LIMIT_NEARING`.

From inside a signer pod, with amounts in the denom's smallest unit:

```sh
node dist/funding-outflow.js status
node dist/funding-outflow.js set-limit --denom uact --scope total --max 5000000000 --mode report --by <who>
node dist/funding-outflow.js set-limit --denom uact --scope wallet --wallet <address> --max 900000000 --mode enforce --by <who>
node dist/funding-outflow.js remove-limit --denom uact --scope total
```

`status` lists what left in the last 24 hours, every limit, and the ten wallets that took the most, so a limit
can be sized from what the signer has counted. Limits are read on every deposit, so a change applies from the
next one on.

If the database cannot be reached, deposits are signed uncounted for up to a minute as long as the limits last
read enforce nothing. Once a limit is enforced, or the last read is older than that, deposits are refused with
503 until the database answers again.

## Local dev

- `npm run dev` watch build
- `npm run prod` run compiled server

## Tests

- `npm run test`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:functional`

The integration and functional tests need Postgres on `localhost:5432`, which `npm run test:ci-setup` starts.
Set `TEST_POSTGRES_URI` to use another server.
