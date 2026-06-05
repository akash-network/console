# deploy-web — domain context

## Lease reclamation (AEP-82, network v2.1.0)

After the v2.1.0 upgrade a provider can **reclaim** a lease it no longer wants to host. The flow:

```
active ──provider initiates reclamation──▶ reclaiming ──deadline passes / tenant inaction──▶ closed (+ group paused)
```

### Glossary

- **Reclamation** — a provider-initiated, time-bounded process that ends a lease. Governed by a
  window (gov param, 1h–720h). It is **terminal**: there is no restart. `MsgStartGroup` does **not**
  resume a reclaimed (paused) group. Recovery is **close & redeploy**.
- **`reclaiming` lease** (`Lease_State.reclaiming = 4`) — still running during the grace period.
  Workload tools (logs, shell, service status) stay live. Surfaced by `isReclaiming()` /
  `isLeaseLive()`.
- **Reclaimed lease** — the terminal state: lease `closed` **and** there is reclamation evidence.
  Surfaced by `isProviderReclaimed()`.
- **`reclamation` object** (optional, on the chain `Lease`) — `{ window, started_at, deadline, reason }`.
  Absent on pre-2.1 leases, so the UI degrades to today's behavior. `deadline` is **unix seconds**.
- **`LeaseClosedReason`** — encodes *who* closed a lease by numeric range:
  `1..9999` tenant (owner), `10000..19999` provider, `20000..29999` network (insufficient funds).
  `0` invalid, `-1` UNRECOGNIZED. Single source of truth for classification + copy:
  `src/utils/reclamationUtils.ts` (components never call `LeaseClosedReason` directly).

### Surfaces

- **`ReclamationBanner`** — top of `DeploymentDetail`, shown only while ≥1 lease is `reclaiming`.
  Live countdown to the nearest deadline + "redeploy elsewhere" CTA.
- **`ReclamationCard`** — per-lease, in `LeaseRow`, for the terminal reclaimed case. Close (recover
  escrow) + Redeploy CTAs; no restart control.
- **List**: `LeaseChip` shows a "Reclaiming" badge + amber dot; `DeploymentListRow`'s Leases column
  shows the live chips, a "closes in Xh" countdown for reclaiming, and a close-reason badge for
  closed leases (this revived the previously-unreachable "all leases closed" cell).
- **`StatusPill`** — amber (`bg-amber-500`) for `reclaiming`.

## Flagged ambiguities / decisions

- **"Reclaimed" = reclamation evidence, NOT a provider-range close reason alone.** A lease counts as
  provider-reclaimed only when `reclamation.startedAt > 0` **or** `group.state === "paused"`. A bare
  provider-range `LeaseClosedReason` with no reclamation evidence is treated as a *generic closed*
  lease. This is the project's decision in lieu of an ADR. (`isProviderReclaimed` in
  `reclamationUtils.ts`.)
- **A reclaimed deployment stays `active`** — only the lease closes and its group pauses. The detail
  page must not redirect an all-paused/zero-live-lease deployment to bid selection.
- **Unverified against real 2.1 data (mainnet upgrade ~2026-06-11):** the exact REST casing of the
  `reclamation` fields and the `deadline` unit (assumed unix **seconds** — a wrong unit breaks the
  countdown by 1000×). The chain may or may not auto-close a deployment once all groups are paused.
