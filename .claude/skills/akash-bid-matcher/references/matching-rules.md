# SDL ↔ Provider Field Mapping

Reference for how the matcher maps SDL compute requirements to provider capability fields returned by `https://console-api.akash.network/v1/providers`.

## Filter: which providers to consider

| Provider field | Required value | Why |
|----------------|----------------|-----|
| `isOnline` | `true` | Offline providers don't respond to bid requests at all. |
| `isAudited` | `true` | Console and most tooling surfaces audited providers by default; unaudited providers exist but are not the pool most deployments land on. |

Both filters are applied up front before any capability checks. The funnel reports the dropoff at each stage.

## CPU

- **SDL:** `resources.cpu.units` — accepts `0.5`, `2`, or `"500m"` (millicores)
- **Provider:** `stats.cpu.available` — reported in millicores
- **Match:** `stats.cpu.available >= requested_millis * deployment.count`

The script multiplies per-service requirements by `deployment[svc][placement].count` because a single provider typically has to fit all replicas.

## Memory

- **SDL:** `resources.memory.size` — accepts `Ki`/`Mi`/`Gi`/`Ti` (binary) and `k`/`M`/`G`/`T` (decimal)
- **Provider:** `stats.memory.available` — bytes
- **Match:** `stats.memory.available >= requested_bytes * count`

## Storage

SDL storage can be a single object (`size: 5Gi`) or an array of named volumes with attributes.

### Ephemeral

- **SDL:** storage entries without `attributes.persistent: true`
- **Provider:** `stats.storage.ephemeral.available`
- **Match:** sum of ephemeral requests ≤ available

### Persistent

- **SDL:** storage entries with `attributes.persistent: true` and a `class` (e.g., `beta2`, `beta3`)
- **Provider capacity:** `stats.storage.persistent.available` (bytes)
- **Provider class support:** derived from the `attributes[]` array, which declares pairs of:
  - `capabilities/storage/<N>/class = <beta1|beta2|beta3|ram|...>`
  - `capabilities/storage/<N>/persistent = true|false`

  A class counts as persistent-capable when the matching slot's `persistent` is `true`. The older `feat-persistent-storage-type=<class>` attribute is also honored as a fallback.
- **Match:** capacity sufficient AND the requested class is in the provider's set of persistent-capable classes.

Do **not** use `featPersistentStorageType` to match SDL classes — that field uses hardware taxonomy (`hdd`, `ssd`, `nvme`), not Akash's SDL class taxonomy (`beta1`, `beta2`, `beta3`). They are unrelated.

The providers endpoint does not break down persistent capacity by class, so total persistent availability is the only capacity check available — class support is verified via the attribute pairs above.

### RAM-class volumes

RAM-class storage (`class: ram`) is ephemeral by definition. The current matcher treats it as ephemeral capacity. Not all providers expose RAM-class volumes, but this endpoint doesn't explicitly report that — be aware the match can be optimistic for RAM volumes.

## GPU

- **SDL:** `resources.gpu.units` + `resources.gpu.attributes.vendor.<vendor>[{ model, ram, interface }]`
- **Provider:** `stats.gpu.available` (count), `gpuModels[]` (array of `{ vendor, model, ram, interface }`)
- **Match:**
  - `stats.gpu.available >= units * count`, AND
  - if a specific model is requested, the provider's `gpuModels` contains at least one entry matching the vendor and model (case-insensitive)

### GPU matching caveats

- `stats.gpu.available` is not broken down by model. A provider with 4× A100 and 4× H100 reports `available: 8` even if only A100s are free. The match can overcount.
- Rare models (H200, B200, MI300X) appear in very few providers' `gpuModels`. The biggest-filter analysis surfaces this automatically.
- For multi-model fallback, the user can declare multiple entries under `vendor.nvidia:` — the matcher considers any match a pass.

## IP endpoints

- **SDL v2.1 trigger:** a service's `expose[*].to[*]` contains `{ ip: <name> }`, or the top-level `endpoints:` block declares one
- **Provider:** `featEndpointIp === true`
- **Match:** required iff the SDL uses an IP endpoint

## Pricing / denom

After the BME rollout, **`uact` (ACT) is the primary denom** on Akash; `uakt` still works as a fallback, and USDC is supported via its IBC denom. The providers endpoint does **not** expose which denominations a provider accepts, so denom support can't be verified from this data.

The matcher treats `uakt`, `uact`, and any `ibc/[A-F0-9]{64}` denom as recognized (no warning). Anything else gets a note that it's unrecognized. Do **not** advise switching denoms to "fix bids" — in practice the bottleneck is almost always GPU model/count/storage class, not denom.

## Unit conversion quick reference

| Input | Parsed as |
|-------|-----------|
| `0.5` (cpu.units) | 500 millicores |
| `2` (cpu.units) | 2000 millicores |
| `"500m"` | 500 millicores |
| `512Mi` | 536,870,912 bytes |
| `2Gi` | 2,147,483,648 bytes |
| `100M` | 100,000,000 bytes |

## Edge cases

- **Missing `count`** — defaults to 1 per placement.
- **Multiple placements for one service** — the matcher uses the pricing/placement pair from each deployment entry; each profile is checked against the union of its usages.
- **Storage name without `class`** — treated as ephemeral with no class constraint.
- **GPU with `units: 0` and attributes** — invalid per SDL rules, ignored by the matcher (no GPU check applied).
- **`gpuModels` empty but `stats.gpu.available > 0`** — provider has GPUs but model is unknown; the model check fails for any model-constrained request.

## Keep in mind

This matcher predicts **capability**, not **intent**. A provider can satisfy the SDL on paper and still decline to bid because of its own price floor, regional policy, or deployment filter. Treat a positive match as "the bid can land here if the provider's price engine agrees," not as a guarantee.
