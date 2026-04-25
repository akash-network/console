---
name: akash-bid-matcher
description: Diagnose why an Akash SDL isn't getting bids (or predict if it will) by matching its compute requirements against the live provider set from console-api.akash.network. Use whenever the user asks "why am I not getting bids", "will this SDL get bids", "which providers can run this", "adapt my SDL to get bids", "check provider availability for my deployment", or pastes an SDL and wants a feasibility check. Also trigger when a bid/auction is failing or stuck, when a user complains about empty bid lists on the Console, or when planning a GPU/large deployment and wants to verify provider capacity beforehand. Filters to isOnline + isAudited providers, matches CPU/memory/storage/GPU/IP capabilities, and produces a funnel showing which single constraint is filtering the pool. Companion to the `akash` skill (which handles SDL syntax/validation) — this one answers the live-market feasibility question the akash skill can't.
---

# Akash Bid Matcher

## What this skill does

Given an SDL, it answers: **"Can this deployment actually get bids right now, and if not, what's blocking it?"**

It does this by:

1. Fetching live providers from `https://console-api.akash.network/v1/providers`.
2. Keeping only providers where `isOnline === true` AND `isAudited === true`. Both filters matter — offline providers won't bid at all, and audited providers are what Console surfaces by default.
3. Extracting compute requirements from every profile in the SDL (CPU millis, memory, ephemeral + persistent storage, storage class, GPU count + vendor + model, IP endpoint need, denom).
4. Checking each provider's `stats.*.available` and capability flags against those requirements.
5. Producing a funnel that shows which single constraint collapses the provider pool. This is almost always more useful than knowing the final count, because the *biggest filter* tells the user what to relax.

## When to use

- User asks "why am I not getting bids" on an Akash deployment
- User pastes an SDL and wants a feasibility check before deploying
- User is planning a GPU deployment (where provider scarcity is the usual blocker)
- Bid lists on Console are empty or too small
- User asks to "adapt" or "optimize" an SDL for better bid coverage

Pair this with the `akash` skill. The `akash` skill validates SDL syntax; this skill validates SDL against live supply.

## How to run

The skill ships with `scripts/match_providers.py`. Given an SDL file path, it fetches live providers and prints a JSON report.

```bash
python3 scripts/match_providers.py /path/to/deploy.yaml
```

Optional flags:
- `--top N` — include top N matching providers per profile (default 5)
- `--api URL` — override the providers endpoint
- `--json` — emit only JSON (default behavior anyway)

If the user pasted an SDL inline, save it to a temp file first:

```bash
TMP=$(mktemp --suffix=.yaml)
cat > "$TMP" <<'EOF'
<paste SDL here>
EOF
python3 scripts/match_providers.py "$TMP"
```

Requires `pyyaml`. If missing: `pip3 install --user pyyaml` (or use a venv).

## Interpreting the report

The script returns a JSON document with this shape:

```json
{
  "total_providers": 60,
  "online_providers": 34,
  "online_audited_providers": 22,
  "profiles": [
    {
      "profile": "sglang",
      "services": ["sglang"],
      "count": 1,
      "requirements": { ... },
      "funnel": [
        {"stage": "total_providers", "count": 60},
        {"stage": "online", "count": 34},
        {"stage": "online_audited", "count": 22},
        {"stage": "passes_cpu", "count": 8, "applicable": true},
        {"stage": "passes_memory", "count": 6, "applicable": true},
        {"stage": "passes_gpu_model", "count": 0, "applicable": true},
        ...
      ],
      "biggest_filter": "passes_gpu_model",
      "match_count": 0,
      "top_matches": [],
      "feasible": false,
      "denom_note": "denom 'uact' is not uakt/ibc — ..."
    }
  ]
}
```

**The most important field is `biggest_filter`.** It names the single constraint that the fewest providers pass. That's the lever the user should pull first to widen the pool.

Each `passes_<check>` stage has an `applicable` flag — checks that don't apply to this profile (e.g., `passes_gpu_model` when the profile has no GPU) should be ignored.

## How to present results

Every response must include both the diagnosis **and** a complete adapted SDL — even if the verdict is "feasible" (in which case the adapted SDL is identical to the input, noted as such). The user wants to copy/paste a ready-to-deploy file, not hand-merge snippets.

Structure:

1. **One-line feasibility verdict** — "X of Y online+audited providers can satisfy profile `<name>`." If zero, say so plainly.
2. **Funnel** — show the dropoff stage by stage. A compact table works well. Highlight the biggest filter.
3. **Requirement summary** — what the profile asks for (human-readable: "96 cores, 512 GiB RAM, 8× nvidia/h200, 800 GiB persistent beta3").
4. **Top matching providers** (if any) — name, region, GPUs. Don't dump all fields.
5. **Changes made** — a tight bullet list naming every field you're about to modify and why, ordered by impact. One line per change.
6. **Full adapted SDL** — a single fenced ```yaml``` block containing the entire adapted document, not a diff or partial snippet. Preserve the user's original keys, comments, ordering, and structure except where you're deliberately changing things.
7. **Caveats** — anything the report can't verify (denom acceptance, per-model GPU availability, provider price floors). See "Known limitations" below.

The full SDL is required on every invocation; never skip it with "here are the changes, apply them to your file." If the SDL already matches ≥5 providers and no change is warranted, output the original SDL verbatim under step 6 and say "no changes needed" in step 5.

When picking changes:

- Work from the biggest filter outward — don't relax things that aren't filtering.
- Never silently change semantics (e.g., don't drop a persistent volume the app needs, don't remove an IP endpoint the service depends on). If a relaxation would break the app, say so in step 5 and skip it rather than applying it.
- If the user's app intent is ambiguous (e.g., can the workload fit on fewer GPUs?), make the conservative choice (keep the count) and mention the alternative in step 5 for them to opt into.
- Preserve the input's version, image tags, env vars, command/args, and anything else untouched by your changes. Do not reformat YAML or restyle it.

## Adapting the SDL — what to change, what to leave alone

**Never modify `pricing.<profile>.amount` or `pricing.<profile>.denom`.** The Akash chain enforces a max bid price; raising the amount can trip a "Unit price exceeds the maximum allowed by the network" error and reject the deployment outright. The denom is a deployer choice, not a bid-matching lever (the providers endpoint doesn't expose denom acceptance anyway). The skill's job is to match the SDL's compute requirements to provider supply — pricing is out of scope.

Changes the skill *does* make, in order — try each tier before reaching for the next:

1. **Reduce GPU count, keep the requested model.** This is the safest first move because the model the user picked is presumably the one their workload actually runs on; smaller count keeps GPU architecture, memory-per-card, and bandwidth identical, so behavior at startup is predictable. If the workload (TP/DP config, model memory footprint) genuinely needs N GPUs, this lever is unavailable — but always try it first. Example: 8× H200 → 4× H200 before considering H100.
2. **Add fallback GPU models *of similar or larger memory*.** Only after step 1. Order from closest match downward (H200 → H100 → A100). For each model added, sanity-check the workload's memory budget — adding a smaller-memory GPU just trades "no bids" for "bids that OOM at startup," which costs the user real money on the lease before they can close it. **Never add a model the workload cannot fit.** When unsure of fit, say so and let the user confirm.
3. **Drop the model constraint entirely** (`nvidia:` with no model list). Last resort; only if step 2 still yields nothing and the user has explicitly accepted the OOM/quality risk.
4. **Storage class** — `beta3` is supported by fewer providers than `beta2`. RAM-class volumes require opt-in. Class support is read from `attributes[]` keys `capabilities/storage/<N>/class` (paired with `.../persistent`).
5. **Persistent storage** — if the workload can tolerate ephemeral, skip persistent entirely. Verify provider has `featPersistentStorage=true` (or attribute `feat-persistent-storage=true`) before assuming a persistent volume will land.
6. **IP endpoints** — `featEndpointIp` is relatively rare; avoid if not essential.
7. **CPU/memory size** — very large single-node asks (>64 CPU, >256 GiB) narrow the pool. Sizing should follow real workload need; oversized asks filter providers without buying anything.

When changes are exhausted (e.g., 1–2 capability matches and the workload can't be relaxed further), say so directly. Don't keep mutating the SDL — recommend out-of-band actions instead (direct provider contact, smaller-model functional test, pre-arranged capacity).

## What can the providers endpoint tell us about feature support?

Use these fields/attributes when deciding whether a provider can satisfy a feature:

| Feature | Where to look |
|---|---|
| Persistent storage at all | top-level `featPersistentStorage` boolean, OR attribute `feat-persistent-storage=true` |
| Specific persistent class (`beta2`/`beta3`) | attributes `capabilities/storage/<N>/class=<cls>` paired with `capabilities/storage/<N>/persistent=true`; fallback `feat-persistent-storage-type=<cls>` |
| RAM-class volumes | attribute `capabilities/storage/<N>/class=ram` |
| IP endpoints | top-level `featEndpointIp` boolean |
| Custom domains | top-level `featEndpointCustomDomain` boolean |
| CPU architecture | top-level `hardwareCpuArch` (`x86-64`, `arm64`) or attribute `capabilities/cpu/arch` |
| GPU vendor/model | `gpuModels[]` with `{vendor, model, ram, interface}` |
| GPU free count (any model) | `stats.gpu.available` |
| Region / location | `locationRegion`, `country`, `ipCountry`, attributes `region`, `location-region` |

**Note `stats.gpu.available` is not broken down by model** — a provider with mixed GPU models reports a single total. Treat the match as best-effort and surface the caveat.

The providers endpoint does **not** expose: accepted denoms, bid-engine price floors, deployment ACLs, or per-model GPU availability. When a deployment capability-matches but gets no bids, those invisible factors are usually the gate; the skill should say so rather than keep tweaking the SDL.

## Known limitations

- **Denom support is not in the providers endpoint.** The script notes this when denom is neither `uakt` nor `ibc/…`, but can't verify custom denoms (e.g., `uact`) directly.
- **Per-GPU-model availability is not exposed.** The endpoint reports total GPU count via `stats.gpu.available` and a list of models via `gpuModels[]`, but not a per-model available count. The skill treats "provider has this model in `gpuModels` AND total GPUs available ≥ requested" as a match — it can overcount if one provider has mixed models.
- **Provider-side bid config (floor prices, deployment filters) is not exposed.** A provider can technically satisfy the SDL but refuse the bid based on its own pricing rules. The report predicts *capability*, not *intent*.
- **Stats are snapshots.** Available capacity changes minute-to-minute as leases come and go.

Surface these caveats when they matter — especially when the verdict is "feasible" but the user is still not getting bids.

## References

- `references/matching-rules.md` — details on how SDL fields map to provider capability fields, unit conversions, and edge cases.
