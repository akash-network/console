# Akash Provider Resource Matching — Acceptance Criteria

This document is a human-readable description of the resource matching engine implemented in
[cluster/kube/operators/clients/inventory/inventory.go](../cluster/kube/operators/clients/inventory/inventory.go).
It captures the **observable behavior** of `tryAdjust` and `Adjust` — what a deployment matches
against, what causes a node-level reject (try next node), and what causes a cluster-level reject
(entire deployment fails).

Each acceptance criterion answers **WHAT** the engine should do and **HOW** it should appear from
the outside, without leaking internal implementation details. Examples show both successful matches
and rejections, with attention to edge cases (multiple replicas, varied configurations, mixed GPUs).

---

## What this engine does

When an Akash provider receives a deployment, this engine answers: **"Can my cluster actually run
this workload?"** It tries to fit every replica of every service onto available nodes — like
packing boxes into trucks. If everything fits, the bid is valid. If not, the provider passes.

The match is **all-or-nothing**: every replica of every service must find a home, or the whole
deployment is rejected. Inventory is only updated if all placements succeed.

> **Scope note — leased IPs (AC18–AC21).** One part of the decision happens *outside* this
> engine. **Leased IPs** (public IP addresses a tenant leases for a service) are checked by the
> **inventory service** ([cluster/inventory.go](../cluster/inventory.go)) as a **cluster-level
> pre-check, before** `tryAdjust`/`Adjust` is ever called. It is not part of the per-node engine,
> but it *is* part of the same overall "can my cluster run this?" question and obeys the same
> all-or-nothing outcome: if the provider lacks enough free leased IPs, the deployment is rejected
> and the per-node engine never runs. The leased-IP criteria below (AC18–AC21) document that
> pre-check.

---

## Core Concepts

- **Node** — one machine with its own CPU, RAM, GPUs, and local disk.
- **Cluster storage** — shared persistent disk pools (e.g., `beta2`, `beta3`) usable by any node
  that supports that class.
- **Leased IP** — a dedicated public IP a tenant leases for a service. Drawn from a single, finite
  **provider-wide** pool (managed by MetalLB), not tied to any node.
- **Resource group** — one service definition + a replica count.
- **Available capacity** — `Allocatable − Allocated`, never negative. An `Allocatable` of `-1` is
  treated as effectively unlimited.
- **Node-level failure** — this node cannot host this replica; engine tries the next node.
- **Cluster-level failure** — no node could ever host this; engine aborts the entire deployment.

---

## Acceptance Criteria

### AC1 — CPU fitting
**WHAT:** Each replica's CPU request (in milli-CPU) must fit within a node's free CPU. CPU is the
first dimension checked on every node.
**HOW:** A node accepts a replica only if `node.cpu.available ≥ replica.cpu.request`. If not, the
engine skips this node and tries the next one.

- ✅ **Match:** Node has 2000m free; replica wants 1500m → placed, node now has 500m free.
- ❌ **Skip node:** Node has 800m free; replica wants 1000m → skipped; try next node.
- ❌ **Reject deployment:** Cluster has 4 nodes with `[68780m, 68800m, 119525m, 119495m]` free.
  Request: 3 replicas × 100000m. Only two nodes can hold a 100000m replica; the third has nowhere
  → `ErrInsufficientCapacity`.
- ✅ **Match (spread):** Same cluster, 4 replicas × 68780m → one replica per node, all placed.

### AC2 — Memory fitting
**WHAT:** Each replica's memory request (bytes) must fit within a node's free memory. Memory is
checked after CPU and GPU.
**HOW:** Same shape as CPU but on the memory pool. RAM-backed volumes (AC6) also draw from this
same pool, so a single replica may deduct from memory more than once.

- ✅ **Match:** Node has 16Gi free; replica wants 8Gi memory + 2Gi RAM volume → 6Gi remains.
- ❌ **Skip node:** Node has 10Gi free; replica wants 8Gi memory + 4Gi RAM volume → 12Gi > 10Gi →
  skip node.

### AC3 — Ephemeral storage fitting
**WHAT:** Non-persistent, non-RAM volumes must fit in the node's local ephemeral disk.
**HOW:** Deducted from `node.ephemeralStorage.available`.

- ✅ **Match:** Node has 100Gi ephemeral free; replica wants a 20Gi ephemeral volume → 80Gi remains.
- ❌ **Skip node:** Node has 5Gi ephemeral free; replica wants 10Gi ephemeral → skip node.

### AC4 — Persistent storage fitting
**WHAT:** Persistent volumes are deducted from the **cluster-wide** pool matching their storage
class, and only nodes that **support** that class can host the workload.
**HOW:**
1. The node must list the requested class in its supported classes (node-level check — failure is
   recoverable on another node).
2. A cluster pool with that class must exist and have enough free space (cluster-level check —
   failure aborts the deployment).

> Note: this engine does **not** enforce a fixed whitelist of class names. Allowed class names
> (e.g., `default`, `beta1`, `beta2`, `beta3`) are validated upstream during SDL parsing. The
> engine only checks node support + pool availability.

- ✅ **Match:** Replica wants 50Gi persistent `beta2`. Node supports `beta2`; cluster `beta2` pool
  has 200Gi free → 150Gi remains in pool.
- ❌ **Skip node (recoverable):** Node does not list `beta3` in supported classes → engine skips
  this node and tries another.
- ❌ **Reject deployment (cluster-level):** Cluster `beta2` pool has 10Gi free; replica wants 50Gi
  → no other node can save this → `ErrInsufficientCapacity`.
- ❌ **Reject deployment (cluster-level):** Volume declared `persistent: true` with no class (or
  class `ram`) → invalid request → deployment rejected immediately, no node is tried.
- ❌ **Reject deployment (cluster-level):** Requested class has no matching pool in the cluster
  storage list → deployment rejected immediately.

### AC5 — Storage classification
**WHAT:** Each volume falls into exactly one bucket, determined by its `persistent` and `class`
attributes:

| `persistent` | `class`        | Bucket          | Deducts from           |
|--------------|----------------|-----------------|------------------------|
| false        | `ram`          | RAM-backed      | Node memory            |
| false        | anything else  | Ephemeral       | Node ephemeral storage |
| true         | any non-empty  | Persistent      | Cluster pool for class |

### AC6 — RAM-backed volume special case
**WHAT:** A volume with `class=ram, persistent=false` is a tmpfs-style volume that consumes RAM,
not disk.
**HOW:** The volume's quantity is subtracted from the node's memory pool in **addition** to the
replica's regular memory request. A single replica with several RAM volumes deducts from memory
multiple times.

- ✅ **Match:** Replica wants 4Gi memory + one 1Gi RAM volume → 5Gi total deducted from node memory.
- ❌ **Skip node:** Node has 4Gi memory free; replica wants 4Gi memory + 1Gi RAM volume → 5Gi > 4Gi
  → skip node.

### AC7 — GPU vendor and model matching
**WHAT:** A GPU request specifies `vendor/<name>/model/<name>` (optionally `/ram/<size>` and/or
`/interface/<type>`). The engine matches the request against the physical GPUs reported by each
node.
**HOW:**
- Both **vendor** and **model** must match a physical GPU on the node. Model `*` is a wildcard
  meaning "any model from that vendor."
- If `ram` is specified in the request, it must equal the physical GPU's `MemorySize` after the
  request value is normalized to a `Gi` suffix. Example: `ram/81920Mi` normalizes to `80Gi` and
  matches a GPU with `MemorySize: "80Gi"`.
- If `interface` is specified, it must be exactly `pcie` or `sxm` (other values are rejected as
  invalid requests). The physical GPU's interface is normalized for comparison: all `sxm*` variants
  (`sxm2`, `sxm3`, `SXM4`, …) collapse to `sxm`. A user request of `interface/sxm` matches a
  physical GPU reported as `sxm4`. The normalization is one-sided (hardware side only).

When a matching set of physical GPUs is found, scheduler params are emitted: `vendor`, `model`,
and `runtimeClass = "nvidia"` (for NVIDIA GPUs).

Examples — node has `2× NVIDIA A100 PCIe 80Gi`:

- ✅ **Match:** `vendor/nvidia/model/a100`, 1 GPU → 1 A100 consumed; scheduler params set vendor=`nvidia`, model=`a100`, runtimeClass=`nvidia`.
- ✅ **Match:** `vendor/nvidia/model/a100/ram/80Gi/interface/pcie`, 2 GPUs → both A100s consumed.
- ✅ **Match (wildcard):** `vendor/nvidia/model/*` → matches the A100.
- ✅ **Match (sxm normalization):** Node reports physical interface `sxm4`; request `interface/sxm`
  matches.
- ❌ **Skip node:** `vendor/nvidia/model/h100` → no A100 match for the requested model → skip node.
- ❌ **Skip node:** `vendor/amd/model/mi300` on an NVIDIA-only node → skip node.
- ❌ **Skip node:** `vendor/nvidia/model/a100/ram/40Gi` against an 80Gi A100 → skip node.
- ❌ **Skip node:** `vendor/nvidia/model/a100/interface/sxm` against a PCIe A100 → skip node.
- ❌ **Skip node:** Request 4× A100 on a node with only 2× A100 → skip node (continues to next
  node; if no other node has 4 matching A100s → `ErrInsufficientCapacity`).
- ❌ **Skip node:** Request 1× GPU on a node where `gpu.available == 0`, even if its info list has
  matching entries → skip node (a fully-allocated GPU node is treated as unavailable).
- ❌ **Reject deployment:** GPU request with `units > 0` and **no** vendor/model attributes →
  matches no physical GPU on any node → `ErrInsufficientCapacity`. (The request is malformed for
  the engine's purposes; it never succeeds.)
- ❌ **Reject deployment:** GPU request with `interface/sxm5` (or any value other than `pcie` /
  `sxm`) → invalid request → cluster-level failure on first parse, deployment rejected.

### AC8 — Zero-GPU requests
**WHAT:** A replica that does not request a GPU (`gpu.units == 0`) is GPU-trivially-satisfied
everywhere; no scheduler GPU params are emitted.

- ✅ **Match:** `gpu.units = 0` on a CPU-only node — fine.
- ✅ **Match:** `gpu.units = 0` on a GPU node — fine; the node's GPUs are untouched.

### AC9 — Replica consistency (uniform hardware across replicas)
**WHAT:** All replicas of the same service must end up matched to the **same** vendor, model, and
(if specified) RAM/interface. Replicas with a wildcard request all resolve to whatever the first
replica matched.
**HOW:** After the first replica is placed, its resolved GPU configuration becomes the canonical
request for the rest of the group. Every subsequent replica is matched against this canonical (no
longer a wildcard). The practical effects:

- A wildcard request `vendor/nvidia/model/*` placed first on an A100 node freezes the group to
  `model/a100`. The remaining replicas now require A100 hardware; H100 nodes are skipped as
  model-mismatches.
- If no further A100 capacity exists in the cluster, the deployment fails with
  `ErrInsufficientCapacity` — **not** `ErrGroupResourceMismatch`. The freezing mechanism converts
  most cross-replica heterogeneity into capacity failures.
- `ErrGroupResourceMismatch` is a defensive guardrail: if a subsequent replica somehow produces
  different adjusted resources or scheduler params than the first replica, the deployment is
  rejected with this error. In current code paths this is rare and indicates an unexpected state.

Examples — cluster has Node A (`2× A100`) and Node B (`2× H100`):

- ✅ **Match:** Service with 3 replicas requesting `vendor/nvidia/model/a100`, no wildcard → first
  two land on Node A; third has no A100 capacity → `ErrInsufficientCapacity`.
- ✅ **Match:** Service with 2 replicas requesting `vendor/nvidia/model/*` → both placed on Node A
  (first replica freezes to `a100`; second matches A100 on same node).
- ❌ **Reject (capacity, not mismatch):** Service with 3 replicas requesting
  `vendor/nvidia/model/*` → first two land on Node A as A100; third needs A100 but only H100 is
  left → `ErrInsufficientCapacity`.

### AC10 — Greedy placement with restart
**WHAT:** The engine packs as many replicas of a service onto a node as fit before moving on.
Once a service is fully placed, the node scan **restarts from the first node** so remaining
services can use earlier nodes that were skipped or have leftover capacity.

- ✅ **Match (spread):** 4 replicas × 68780m on `[68780m, 68800m, 119525m, 119495m]` → one per node,
  all placed.
- ✅ **Match (pack):** 2 replicas × 50000m on a node with 119525m free → both on the same node;
  remaining 19525m stays available for other services.

### AC11 — Multiple services with different configurations
**WHAT:** A deployment may contain several services, each with its own resource shape and replica
count. **All** services must place successfully; partial success commits nothing.

- ✅ **Match:** Service A (2 replicas, 1 CPU, no GPU) + Service B (1 replica, 2 CPU + 1× A100) on
  a cluster with one A100 node and one CPU-only node → B gets the A100 node; A spreads across both.
- ❌ **Reject:** Same deployment, but the cluster has no GPU node → B fails → entire deployment
  fails with `ErrInsufficientCapacity`; A is **not** committed even though it could have fit.

### AC12 — Transactional commit (all-or-nothing)
**WHAT:** Inventory is updated only when every replica of every service places successfully. Any
failure leaves the original inventory untouched.

- ✅ **Success:** All 5 replicas place → inventory updated atomically.
- ❌ **Partial failure:** 4 of 5 replicas place; 5th has no home → inventory rolled back; nothing
  is committed.

### AC13 — Dry-run mode
**WHAT:** Same matching logic, but **never** commits to inventory, even on full success.
**HOW:** The reservation still receives resolved scheduler params and adjusted resources, so the
caller can inspect what would have been allocated. The engine's inventory does not shrink.

- ✅ **Dry-run success:** Caller gets resolved scheduler params and adjusted resources; inventory
  unchanged.
- ❌ **Dry-run failure:** Same error codes as the live path; inventory unchanged.

### AC14 — Empty cluster
**WHAT:** A cluster with zero nodes always rejects any non-empty deployment.

- ❌ **Reject:** Any non-empty reservation against a 0-node cluster → `ErrInsufficientCapacity`.

### AC15 — Node-level vs cluster-level failure
**WHAT:** Two failure shapes drive different recovery:
- **Node-level** (this node lacks CPU / memory / GPU / ephemeral, or doesn't support a requested
  persistent storage class) → engine tries the next node.
- **Cluster-level** (persistent storage pool exhausted, requested class not present anywhere in
  the cluster, or malformed storage attributes) → engine aborts immediately; no other node could
  help.

- Recoverable example: Node 1 has no GPU → engine tries Node 2.
- Fatal example: Cluster `beta2` pool is empty when any replica needs it → stop;
  `ErrInsufficientCapacity`.
- Fatal example: Not enough free leased IPs (AC19) → stop before any node is tried.

### AC16 — "Unlimited" allocatable
**WHAT:** When a node's `Allocatable` for a resource is `-1`, that dimension is treated as
effectively unlimited (capped at `MAX_INT64`). Used for resources that aren't constrained by
Kubernetes.

- ✅ **Match:** Node memory `Allocatable = -1` → any memory request fits (assuming nothing else
  blocks it).

### AC17 — Check ordering and short-circuit
**WHAT:** For each node, the engine checks resources in a fixed order and stops at the first
failure: **CPU → GPU → Memory → Storage volumes (in declaration order)**.

- A node failing CPU is never tested for GPU / memory / storage on this replica.
- A node failing GPU is never tested for memory / storage.
- The first storage volume that fails determines the failure kind (node-level for ephemeral /
  class-not-supported / RAM-volume-over-memory; cluster-level for pool exhaustion or bad
  attributes).

### AC18 — Leased IP counting
**WHAT:** The number of leased IPs a deployment needs is the count of **unique** `LEASED_IP`
endpoint sequence numbers across the whole group spec. The same endpoint referenced by several services is **one** IP, not many.
**HOW:** The provider counts via `GetEndpointQuantityOfResourceGroup(gspec, Endpoint_LEASED_IP)`,
which collects distinct endpoint sequence numbers into a set and returns the set size. This is
computed once per reservation and stored as the reservation's endpoint quantity.

- ✅ **Counts as 1:** Three services all reference leased-IP endpoint `#1` → requested = 1.
- ✅ **Counts as 2:** Group references leased-IP endpoints `#1` and `#2` → requested = 2.

### AC19 — Leased IP availability gate (cluster-level, pre-engine)
**WHAT:** Before any node is examined, the provider checks it has enough free leased IPs for the whole deployment. This is a single cluster-wide pool — never per-node, never per-replica.
**HOW:** `available = leased_ip.allocatable − leased_ip.allocated`, where
`allocated = in-use + reserved`. `reserved` counts IPs held by reservations that the IP operator
has **not yet confirmed**, so pending bids still consume availability. If `requested > available`,
the reservation is rejected with **`insufficient number of IPs`** and the per-node engine never
runs.

- ✅ **Match:** Pool of 10, 4 in use, 2 reserved → available 4; request 3 → passes; engine proceeds
  to fit CPU/memory/GPU/storage.
- ❌ **Reject (cluster-level):** Same pool, request 5 > available 4 → `insufficient number of IPs`;
  no node is tried.
- ❌ **No double-claiming:** Reserved-but-unconfirmed IPs still count as allocated, so two
  concurrent requests cannot both be offered the same free IPs — the second sees lower availability.

### AC20 — Provider without leased IP support
**WHAT:** A provider that has no IP operator configured cannot serve leased IPs at all. Any
deployment that needs at least one leased IP is rejected, regardless of node capacity.
**HOW:** If the requested leased IP count is non-zero and the inventory service has no IP client,
the reservation is rejected with **`no leased IPs available`**.

- ❌ **Reject:** Request 1 leased IP against a provider with no IP operator → `no leased IPs
  available`, even on an otherwise empty, fully-capable cluster.
- ✅ **Unaffected:** Same provider, deployment requesting 0 leased IPs → IP check skipped (AC21).

### AC21 — Zero leased IPs requested
**WHAT:** A deployment requesting no leased IPs skips the IP gate entirely and proceeds straight to
the per-node engine (parallels AC8 for GPUs). The reservation's IPs are treated as already
confirmed.

- ✅ **Match:** Requested leased IPs = 0 → no IP check; placement depends only on CPU/memory/GPU/storage.

---

## Worked Example — Mixed GPU Cluster, 3 Replicas

**Cluster:**
- Node A: 8 CPU, 16Gi RAM, `2× NVIDIA A100 PCIe 80Gi`
- Node B: 8 CPU, 16Gi RAM, `2× NVIDIA H100 SXM4 80Gi`
- Node C: 8 CPU, 16Gi RAM, no GPU

**Deployment:** Service S, 3 replicas × (2 CPU + 4Gi RAM + 1 GPU `vendor/nvidia/model/*`)

1. Replica 1 → Node A → matches A100 PCIe 80Gi. Group is frozen to
   `vendor/nvidia/model/a100`. Scheduler params: `{vendor: nvidia, model: a100, runtimeClass: nvidia}`.
2. Replica 2 → Node A → only 1 A100 remains; matches → consistent with frozen request. ✅
3. Replica 3 → Node A has no GPUs left → try Node B → H100 doesn't match `model/a100` → skip
   → Node C has no GPU → no nodes left → `ErrInsufficientCapacity`.

Variations:
- Request `vendor/nvidia/model/a100` (no wildcard), same cluster: replica 3 fails the same way →
  `ErrInsufficientCapacity`.
- 2 replicas instead of 3: both land on Node A → success.

---

## Failure Codes

| Error                       | When                                                                                              |
|-----------------------------|---------------------------------------------------------------------------------------------------|
| `ErrInsufficientCapacity`   | After exhausting all nodes, one or more replicas could not be placed; or a cluster-level resource (persistent pool, storage class, GPU constraint) blocks placement. |
| `ErrGroupResourceMismatch`  | Defensive guardrail — a subsequent replica produced different adjusted resources or scheduler params than the first replica of the same service. Rare in practice because request freezing usually converts heterogeneity into capacity failures. |
| `no leased IPs available`   | A deployment needs ≥1 leased IP but the provider has no IP operator configured (AC20). Wraps the inventory reservation error. |
| `insufficient number of IPs`| Requested leased IPs exceed `leased_ip.allocatable − leased_ip.allocated` (AC19). Cluster-level — no node is tried. Wraps the inventory reservation error. |

---

## Implementation references

- Main entry point: [Adjust](../cluster/kube/operators/clients/inventory/inventory.go#L214)
- Per-replica placement: [tryAdjust](../cluster/kube/operators/clients/inventory/inventory.go#L46)
- GPU matching: [tryAdjustGPU](../cluster/kube/operators/clients/inventory/inventory.go#L125)
- Attribute parsing: [ParseGPUAttributes / ParseStorageAttributes](../cluster/types/v1beta3/clients/inventory/metrics.go)
- Interface normalization: [FilterGPUInterface](../cluster/types/v1beta3/types.go#L160)
- Test fixtures (4-node CPU example): [client_test.go:609-704](../cluster/kube/operators/clients/inventory/client_test.go#L609-L704)

Leased IP (AC18–AC21), enforced in the inventory service, not the per-node engine:

- Leased IP gate: [handleRequest](../cluster/inventory.go#L457)
- Availability math: [availableLeasedIPs / countReservedIPs / leasedIPStatus](../cluster/inventory.go#L411-L444)
- Request counting: [GetEndpointQuantityOfResourceGroup](../cluster/util/endpoint_quantity.go#L8)
- Status reporting: `provider.Inventory.LeasedIP` (`leased_ip.{allocatable, allocated}` in the provider status stream)
