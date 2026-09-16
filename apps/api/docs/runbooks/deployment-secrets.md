# Deployment secrets: rotation, re-key and alerts

An operator document for the keys that protect deployment secrets in the Console API. It is written to be followed step by step; the design it rests on lives in the code and in the Linear issues under CON-874.

## 1. What is protected, and by what

Deployment secrets are sealed in three layers. Each layer is what the next one is wrapped under, and each operation in this document touches exactly one of them.

| Layer                | Where it lives                                                                                                          | What it is                                                                                                                                                     | Changed by                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| KMS key version      | Cloud KMS, key `GCP_KMS_KEY` in key ring `GCP_KMS_KEY_RING`, location `GCP_KMS_LOCATION`, version `GCP_KMS_KEY_VERSION` | An asymmetric RSA key. The console holds its public half in memory and calls the key service only to unwrap.                                                   | Scheduled rotation (section 2)                    |
| Data encryption key  | `data_keys`, one active row per user, wrapped under a KMS version named in `wrapped_by_kid` as `<key>.v<version>`       | A random 256-bit key per user.                                                                                                                                 | Per-user re-key (section 3)                       |
| Stored secrets token | `deployment_settings.sealed_secrets`, one compact JWE per deployment                                                    | The deployment's secret values, encrypted under the user's data key. Its header names the owner (`sub`), the deployment (`dseq`) and the data key row (`kid`). | The user's own deploys, and a re-key of that user |

Two consequences drive everything below.

Rotating the KMS version re-wraps each `data_keys` row and never touches a stored token, because tokens name the data key's identity, not its wrapping. That makes rotation cheap and safe to interrupt.

Rotating the KMS version does not change any data key. Someone who captured a user's data key in plaintext can still open that user's secrets after a rotation. Only a re-key of that user contains it.

## 2. Scheduled rotation

Run this on the schedule the team agrees on, and whenever a KMS version is suspected compromised. Every step is safe to repeat.

1. Create the new key version in Cloud KMS and confirm it is enabled:

   ```sh
   gcloud kms keys versions create --location "$GCP_KMS_LOCATION" --keyring "$GCP_KMS_KEY_RING" --key "$GCP_KMS_KEY"
   gcloud kms keys versions list --location "$GCP_KMS_LOCATION" --keyring "$GCP_KMS_KEY_RING" --key "$GCP_KMS_KEY"
   ```

2. Raise `GCP_KMS_KEY_VERSION` to the new version number in the environment's configuration and deploy the API. From then on new data keys are wrapped under the new version, and everything wrapped under an older enabled version still opens. Confirm with `GET /v1/sdl-secrets-context`: its `kid` must read `<key>.v<new version>`.

3. Rehearse the re-wrap without writing anything. The command refuses a target that is not the version the console is configured to wrap under, so a typo cannot move the fleet onto a version new keys do not land on:

   ```sh
   node --require ./dist/instrumentation.js ./dist/console.js rewrap-data-keys --target-version <new version> --dry-run
   ```

   Read the report: `census` counts data keys per version, `dataKeysRewrapped` is how many a real run would move, and `dataKeysFailed` names rows a real run could not open. A non-zero `dataKeysFailed` needs investigating before the real run, since those rows would stay behind on the old version.

4. Run it for real, in batches of 100 rows per transaction by default:

   ```sh
   node --require ./dist/instrumentation.js ./dist/console.js rewrap-data-keys --target-version <new version>
   ```

   Check the report. `secretsDrift.corruptedIds` must be empty (section 4 says what to do if it is not). `dataKeysMovedByAnotherWriter` counts rows another process moved between the read and the write; they are left to that writer. Re-run until `census` shows only the target version. A re-run is a no-op that spends no key-service call.

5. Do not disable or destroy an old key version until the census of data keys under it returns zero. The command that answers it is the `census` in the report of a dry run, which counts every row, active and retired alike. The same answer in SQL:

   ```sql
   SELECT wrapped_by_kid, count(*) FROM data_keys GROUP BY 1 ORDER BY 1;
   ```

   A version with rows still under it must stay enabled. Disabling it makes every unwrap of those rows fail with `WRAPPING_VERSION_UNUSABLE`, which surfaces to the user as a 503 on deploy and as `USER_DATA_KEY_WRAPPED_UNDER_UNKNOWN_KID` in the logs. Nothing looks wrong until someone deploys.

6. Once the census reads zero for the old version, disable it. Leave it disabled for at least a week, so anything the census missed surfaces as a 503 that a re-enable fixes:

   ```sh
   gcloud kms keys versions disable <old version> --location "$GCP_KMS_LOCATION" --keyring "$GCP_KMS_KEY_RING" --key "$GCP_KMS_KEY"
   ```

7. After that week, take a fresh census, confirm it still reads zero and that no `USER_DATA_KEY_WRAPPED_UNDER_UNKNOWN_KID` event named the version, and only then schedule its destruction:

   ```sh
   gcloud kms keys versions destroy <old version> --location "$GCP_KMS_LOCATION" --keyring "$GCP_KMS_KEY_RING" --key "$GCP_KMS_KEY"
   ```

   A version scheduled for destruction can no longer decrypt, so this is the step where a missed row becomes a 503. Cloud KMS holds the version for its scheduled-destruction period; `gcloud kms keys versions restore` cancels the destruction and returns the version to disabled, so re-enable it as well if something surfaced. After destruction completes, every data key still wrapped under that version is unrecoverable.

## 3. Emergency rotation and the per-user re-key

Which situation calls for which:

| What happened                                                                                                   | What contains it                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The KMS key version may be compromised, or an identity that could call `asymmetricDecrypt` was compromised      | Scheduled rotation, run now rather than on schedule, then disable the old version as soon as the census reads zero. Revoke the compromised identity's KMS roles first. |
| One user's data encryption key leaked in plaintext, for example from a memory dump, a debugger session or a log | Per-user re-key of that user (below). A rotation changes nothing this attacker holds.                                                                                  |
| A stored token's ciphertext was altered in the database                                                         | Not a key problem. Treat as tampering: section 4.                                                                                                                      |

The re-key gives one user a new data key and re-seals every stored secret of theirs under it. It is deliberately per user: it touches that user's deployments, which no fleet-wide operation should.

Before the first real use, walk the whole procedure on beta or staging against a throwaway account. Nothing in the console UI writes a secret yet, so `apps/api/scripts/rehearseDeploymentSecrets.ts` records deployments carrying sealed secrets for that account, stored the way a create stores them but marked closed, so no sweep funds, reconciles or deletes them. A deployment created through `POST /v1/deployments` whose SDL carries env values stores secrets as well, so a real deploy from the account works too. Run the script locally with the environment's configuration, for example through `doppler run`:

```sh
DEPLOYMENT_ENV=staging NETWORK=sandbox doppler run -p console-api -c staging-sandbox -- npm run rehearse:secrets -- seed --email <account email> --count 3 --confirm-database console-users-staging
DEPLOYMENT_ENV=staging NETWORK=sandbox doppler run -p console-api -c staging-sandbox -- npm run rehearse:secrets -- inspect --email <account email>
```

Set both to what the chosen configuration stands for: `staging-sandbox` is `staging` on `sandbox`, and beta's `prod-sandbox` is `production` on `sandbox`. They are what `@akashnetwork/env-loader` reads to load `env/.env.<DEPLOYMENT_ENV>` and `env/.env.<NETWORK>`, which hold the settings Doppler does not carry, so leaving them out fails the deployment config on a missing value such as `DEPLOY_WEB_BASE_URL`. Doppler's values still win over the files, and these two select files only: the write is gated on `--confirm-database` alone.

When the database answers only through a local proxy, rewrite the host the way the other operator commands do; the database name survives the rewrite, which is what the confirmation compares:

```sh
DEPLOYMENT_ENV=staging NETWORK=sandbox doppler run -p console-api -c staging-sandbox -- sh -c '
  export POSTGRES_DB_URI="$(printf "%s" "${POSTGRES_DB_URI%%\?*}" | sed -E "s#@[^@/]+/#@localhost:6543/#")?sslmode=disable"
  npm run rehearse:secrets -- seed --email <account email> --count 3 --confirm-database console-users-staging
'
```

`seed` logs the account's user id for the commands below and creates the account's data key if it has none. `inspect` lists the account's data keys and, for every deployment holding a secret, which key seals it and whether it opens; run it between the steps below to watch the tokens move and the retired key disappear. Run `seed` again between the two real runs to see a value written under the new key open beside the ones it re-sealed. `cleanup` deletes what `seed` recorded and nothing else. Every command opens by logging `REHEARSAL_TARGET`, naming the database and host it reached. `seed` and `cleanup` refuse to write unless `--confirm-database` matches the database that environment's connection string actually names, so a configuration picked by mistake refuses rather than writing fixtures into it. The check is on the name because `DEPLOYMENT_ENV` and `NETWORK` are set by the chart at deploy time rather than by Doppler: a command run from a laptop reads them as `production` and `mainnet` whichever environment its configuration belongs to.

1. Rehearse:

   ```sh
   node --require ./dist/instrumentation.js ./dist/console.js rekey-user-data-key --user-id <uuid> --dry-run
   ```

   `deploymentsResealed` and `secretsResealed` are what a real run would re-seal. The rehearsal opens every one of those values, so one that would not open fails here rather than during the real run. Nothing is retired or written.

2. Run it:

   ```sh
   node --require ./dist/instrumentation.js ./dist/console.js rekey-user-data-key --user-id <uuid>
   ```

   The run retires the user's active key and inserts its replacement in one transaction, then re-seals each of the user's tokens under the new key. Both keys stay openable throughout and the user keeps deploying. The report states `deploymentsResealed`, `secretsResealed`, `deploymentsAlreadyUnderActiveKey`, `deploymentsMovedByAnotherWriter`, `deploymentsUnderUnknownKey`, `retiredDataKeyDeleted` and `retiredDataKeyDeletableAfter`.

3. The first run always keeps the retired key and reports `retiredDataKeyDeleted: false`, because a request that read the old key just before it was retired may still be writing a value under it. Run the command again at or after `retiredDataKeyDeletableAfter`, a minute after the retirement. That run re-seals any straggler, checks that nothing is still sealed under the retired key, and deletes it. Only then is the leaked key useless.

4. On a rehearsal, delete the fixtures once the second run reports the retired key gone:

   ```sh
   DEPLOYMENT_ENV=staging NETWORK=sandbox doppler run -p console-api -c staging-sandbox -- npm run rehearse:secrets -- cleanup --email <account email> --confirm-database console-users-staging
   ```

   It removes only the closed, definition-less rows the script recorded under its own name, and leaves the account's data key in place. Nothing to do after a real re-key, which writes no fixtures.

5. While the retired key exists, a request that opens an old token and seals a new one unwraps two keys for that user. The histogram `user_data_key_unwraps_per_request` reads 2 for that user during the window. That is the re-key, not the regression it otherwise flags.

## 4. Interrupted runs, mismatches and states that need a hand

**An interrupted `rewrap-data-keys` run is harmless.** Every enabled version still opens what it produced. Re-run it; rows still wrapped under the old version are selected again and the run continues from where it stopped. The census at destroy time is the completeness check.

**An interrupted `rekey-user-data-key` run is harmless.** Both keys stay openable and every secret opens under one of them. Re-run it; it finds the retired key and resumes, re-sealing whatever is still under it.

**`DATA_KEY_REWRAP_FINGERPRINT_MISMATCH`, or `secretsDrift.corruptedIds` not empty in a rewrap report: stop, page someone, do not re-run.** The rewrap never writes to `deployment_settings`, and every legitimate write to a stored token moves the row's `updated_at`. A token that changed while its timestamp stood still was written by something other than the console. Preserve the database as it is, snapshot it, and hand the listed ids to whoever investigates database access. Do not rewrite the rows to make the fingerprint pass.

**`DATA_KEY_REKEY_SEVERAL_RETIRED_KEYS`**: two re-keys of the same user were each interrupted. Finish by hand: find which retired key the user's tokens still name (their header `kid`), keep that one, re-seal what names any other, then delete the others. Do not delete a key that any token still names.

**`DATA_KEY_REKEY_NO_ACTIVE_KEY` with a retired key present**: something deleted the active row outside the command. Restore the row from a backup taken while it existed; without it the values sealed under it are gone.

**`deploymentsUnderUnknownKey` in a re-key report**: a token names a key that is neither the user's active nor retired one. The command does not touch it and keeps the retired key. Find out how that token was written before anything else.

## 5. Alerts

Both alerts read the console's own structured events in Loki. They exist because the key-service audit trail cannot see either signal: opening a stored token is a local decryption that reaches no key service, and no audit entry names a user.

Every Loki query below uses the same pipeline, because the API's log lines are double-wrapped JSON:

```logql
{namespace="prod", service_name="console-api-mainnet"} | json log=`log` | line_format "{{.log}}" | json
```

### 5.1 A stored secret failed to open

```logql
sum(count_over_time({namespace="prod", service_name="console-api-mainnet"} | json log=`log` | line_format "{{.log}}" | json | event="SECRET_DECRYPT_FAILED" [5m])) > 0
```

There is no threshold to tune: a healthy system produces none. The event is written only for a permanent failure; a key service that is merely unreachable answers 503 and is not counted.

What it means: a token's ciphertext or header was altered, or it names a data key the user does not hold. Both are wrong in a way a bug is not.

What to look at first: the event carries `userId`, `dseq` and the token's header `claims`. Compare `claims.kid` with that user's `data_keys` rows. If a `DATA_KEY_REKEY_*` run for that user is in progress or just finished, and the kid is the key it retired, a request opened a token during the window; re-run the re-key. Otherwise treat it as tampering: snapshot the database, page security, and do not repair the row.

### 5.2 Many distinct users unwrapped in a short window

```logql
count(count by (userId) (count_over_time({namespace="prod", service_name="console-api-mainnet"} | json log=`log` | line_format "{{.log}}" | json | event="USER_DATA_KEY_UNWRAPPED" [5m]))) > 75
```

What it means: a normal deploy unwraps one user's key. Something opening many users' secrets inside minutes looks like nothing a user does.

How the starting threshold was derived, so the next person can tighten it rather than guess. Console Prod in Amplitude, events `create_deployment` and `update_deployment` combined, counting distinct users:

| Measure                    | Value                   | When                 |
| -------------------------- | ----------------------- | -------------------- |
| Busiest hour, last 7 days  | 73 distinct users       | 2026-09-12 08:00 UTC |
| Ordinary hour, last 7 days | 1 to 20 distinct users  |                      |
| Busiest day, last 90 days  | 246 distinct users      | 2026-09-12           |
| Ordinary day, last 90 days | 10 to 60 distinct users |                      |

Those events come from the web app, so they leave out API consumers deploying through an SDK, and only deployments carrying secrets unwrap at all. Web deploys therefore bound the unwrapping population from above for web traffic and understate it a little for the rest, which is one more reason to start loose. The threshold of 75 is the busiest hour's whole population arriving inside five minutes: nothing legitimate observed so far reaches it, and a sweep across hundreds of users clears it in seconds. Once the alert has run for a few weeks, graph the 5.2 query, without its `> 75`, over the last 30 days in Grafana Explore, read its maximum, and lower the threshold to about twice that. Tighten it when the measured peak stays well under the threshold for a month; raise it only after a legitimate spike, such as a hackathon, and record why here.

What to look at first: the `userId` values behind the count, and whether they correspond to deploy traffic in Amplitude for the same minutes. Legitimate spikes come with `create_deployment` events from the web app; a sweep comes from an API consumer (`userAgent: "node"`, `referrer: "about:client"`) or from nothing at all. For a sweep: revoke the API keys involved, then re-key every user on the list (section 3), since their data keys were unwrapped by something that should not have.

### 5.3 Wiring them

Grafana is the alerting engine. Each rule evaluates its LogQL every minute over the last five, fires after one evaluation, and notifies a contact point that reaches a person, not a channel nobody watches. The rule body follows the shape Grafana's provisioning API takes (`POST /api/v1/provisioning/alert-rules` with the header `X-Disable-Provenance: true`, which leaves the rule editable in the UI); set `notification_settings.receiver` to the paging contact point.

Prove each path once before trusting it:

- 5.1: on a non-production environment, alter one character of a test deployment's `sealed_secrets` in the database, then redeploy that deployment. The deploy must fail, `SECRET_DECRYPT_FAILED` must appear, and the page must arrive. Restore the row afterwards.
- 5.2: on a non-production environment, lower the threshold to 0, deploy once with a secret, confirm the page, restore the threshold.
- Ordinary traffic: graph the 5.2 query, without its `> 75`, over the last 7 days and confirm its maximum stays under the threshold before enabling the rule in production.

### 5.4 What these alerts cannot catch

An attacker with code execution inside the API controls the logger both alerts depend on and can suppress the events. The alerts that survive that case read the key service's own audit trail instead: decrypt rate, sustained decrypt failures and an unexpected principal calling `asymmetricDecrypt`. They are deferred until production unwrap volume has been measured for a few weeks, and they depend on the audit trail in section 6 being written now.

## 6. KMS Data Access audit logging

The key service records administrative activity on a key by itself. The decrypt calls that constitute actual secret access are Data Access logs, off by default, and cannot be enabled retroactively. Do this in every project that holds real user secrets, and verify rather than assume.

1. Enable `DATA_READ` for Cloud KMS with no exempted members. An exemption for the console's service account would exclude exactly the caller this trail exists to watch.

   ```sh
   gcloud projects get-iam-policy "$PROJECT" --format=json > policy.json
   ```

   Add to `auditConfigs` in `policy.json`:

   ```json
   { "service": "cloudkms.googleapis.com", "auditLogConfigs": [{ "logType": "ADMIN_READ" }, { "logType": "DATA_READ" }, { "logType": "DATA_WRITE" }] }
   ```

   Then `gcloud projects set-iam-policy "$PROJECT" policy.json`, and confirm:

   ```sh
   gcloud projects get-iam-policy "$PROJECT" --format=json | jq '.auditConfigs[] | select(.service=="cloudkms.googleapis.com")'
   ```

   The output must list `DATA_READ` and no `exemptedMembers`.

2. Choose retention deliberately and write the number down here. Data Access logs land in the `_Default` bucket, which keeps them 30 days. An investigation that starts from a user report can begin months after the access, so route these entries to a bucket of their own with a locked retention of a year:

   ```sh
   gcloud logging buckets create kms-audit --location=global --retention-days=400 --project "$PROJECT"
   gcloud logging sinks create kms-audit-sink logging.googleapis.com/projects/$PROJECT/locations/global/buckets/kms-audit \
     --log-filter='protoPayload.serviceName="cloudkms.googleapis.com"' --project "$PROJECT"
   gcloud logging buckets update kms-audit --location=global --locked --project "$PROJECT"
   ```

   Locking is irreversible and is the point: while the bucket holds entries within retention, nobody, including a compromised console, can shorten the retention or delete the bucket. Once every entry has aged past retention the bucket can be deleted, which is why the retention below is long.

   Retention chosen: 400 days. Rationale: a year of trail plus the slack to notice a problem at the end of it. Change the number here if it changes there.

3. Confirm the console's runtime identity can neither delete entries, reconfigure logging, nor rewrite the project policy that holds the audit configuration. It needs only KMS roles: `roles/cloudkms.publicKeyViewer` to fetch the public half, `roles/cloudkms.cryptoKeyDecrypter` to unwrap, and `roles/cloudkms.viewer` to read a version's state.

   ```sh
   gcloud projects get-iam-policy "$PROJECT" --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:serviceAccount:<console service account>"
   ```

   No `roles/logging.*` role, no `roles/owner`, no `roles/editor` may appear.

   That reads the project policy alone. A binding inherited from the folder or the organization grants the same access without appearing there, so also ask for the effective answer on the permissions that matter, which walks the whole hierarchy:

   ```sh
   for permission in logging.buckets.update logging.buckets.delete logging.sinks.update logging.sinks.delete logging.logs.delete resourcemanager.projects.setIamPolicy; do
     gcloud policy-troubleshoot iam "//cloudresourcemanager.googleapis.com/projects/$PROJECT" --principal-email="<console service account>" --permission="$permission"
   done
   ```

   Every answer must be that access is not granted. The last permission is the one that matters most: whoever holds it can edit `auditConfigs` and switch the trail off, whatever the logging permissions say.

4. Verify a successful decrypt appears with its caller, key version, operation and outcome. Deploy once with a secret on that environment, then:

   ```sh
   gcloud logging read 'protoPayload.serviceName="cloudkms.googleapis.com" AND protoPayload.methodName="AsymmetricDecrypt"' --limit 5 --project "$PROJECT" --format=json \
     | jq '.[] | {caller: .protoPayload.authenticationInfo.principalEmail, version: .protoPayload.resourceName, method: .protoPayload.methodName, status: .protoPayload.status}'
   ```

5. Verify a failed decrypt appears with its error outcome, since the deferred alerts depend on failures being visible. Ask the key service to decrypt something the version cannot open, then read the trail again and confirm an entry with a non-empty `status`:

   ```sh
   head -c 384 /dev/urandom > garbage.bin
   gcloud kms asymmetric-decrypt --location "$GCP_KMS_LOCATION" --keyring "$GCP_KMS_KEY_RING" --key "$GCP_KMS_KEY" --version <version> --ciphertext-file garbage.bin --plaintext-file /dev/null
   ```

What the trail cannot answer, so nobody builds an alert on data that is not there:

- It cannot say whose data key was unwrapped. `asymmetricDecrypt` carries no authenticated data, so every unwrap looks identical: same principal, same key version, same operation. Attribution comes only from the console's own `USER_DATA_KEY_UNWRAPPED` events.
- It never sees a stored secret being opened. Tokens are decrypted locally under the data key with no key-service call, so token opens, including the failed ones that signal tampering, produce no entry, ever. The only signal for a tampered token is `SECRET_DECRYPT_FAILED` in section 5.1.
- Routine wrapping makes no decrypt call. Signups and the sealing context appear as `GetPublicKey`, and one deploy is one `AsymmetricDecrypt` however many secrets it carries.

## 7. Deleting a data key deletes the secrets

No copy of a stored token is readable without the data key row it names, and no data key is readable without the KMS version that wrapped it. Deleting a user therefore makes their secrets unreadable in the live database at once, without touching a token, and reaches the backups on a delay:

- A backup taken while the `data_keys` row existed still holds the wrapped key, so restoring that backup restores readability for as long as the KMS version that wrapped it is enabled. For backups the shred completes only once they age out of retention or that version is destroyed, so backup retention is part of how long a deleted user's secrets survive.
- Any feature that copies, exports or escrows a data key, or logs it, silently removes the property. There is deliberately no such feature.

The same property is what makes section 2 step 5 load-bearing: destroying a KMS version with rows still under it deletes those users' secrets.

## 8. Events and metrics

| Name                                              | Kind         | Meaning                                                                                                                               |
| ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_DATA_KEY_UNWRAPPED`                         | event, info  | A request unwrapped a user's data key. Carries `userId`, `dataKeyId`, `kid`. The only per-user record of secret access.               |
| `USER_DATA_KEY_WRAPPED_UNDER_UNKNOWN_KID`         | event, error | A data key names a KMS version the console cannot resolve or the service refuses (disabled, destroyed, unknown). The user gets a 503. |
| `USER_DATA_KEY_UNWRAP_FAILED`                     | event, error | The key service was unreachable or answered nonsense. Transient; the user gets a 503.                                                 |
| `USER_DATA_KEY_UNREADABLE`                        | event, error | The wrapped key itself is corrupt. Permanent.                                                                                         |
| `SECRET_DECRYPT_FAILED`                           | event, error | A stored token would not open. Section 5.1.                                                                                           |
| `SDL_SECRETS_SEALED`, `SDL_SECRETS_STORED_OPENED` | event, info  | A token was written or read for a deployment.                                                                                         |
| `DATA_KEY_REWRAP_*`                               | events       | The scheduled rotation's start, batches, refusals, failures and end report.                                                           |
| `DATA_KEY_REKEY_*`                                | events       | The per-user re-key's start, retirement, batches, kept or deleted retired key, and end report.                                        |
| `kms_key_service_calls_total{status,failure}`     | counter      | Key-service unwraps by outcome.                                                                                                       |
| `kms_key_service_call_duration_ms`                | histogram    | Key-service latency.                                                                                                                  |
| `user_data_key_unwraps_per_request`               | histogram    | Unwraps a request spent on one user's key. Expected 1; 2 during that user's re-key window.                                            |
