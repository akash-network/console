# Feature Specification: Bid Screening

**Feature Branch**: `001-bid-screening`
**Created**: 2026-04-27
**Status**: Draft
**Input**: User description: "Build bid screening functionality to prefilter providers from database based on Akash SDL"

## Clarifications

### Session 2026-04-27

- Q: How do SDL storage classes map to database storage classes? → A: Database stores beta1/beta2/beta3 directly (beta1=HDD, beta2=SSD, beta3=NVMe). No translation layer needed.
- Q: Can SDL services be split across providers? → A: No. A single provider MUST fulfil ALL resource groups in the SDL. If a provider cannot accommodate the entire deployment, it is excluded.
- Q: Does the replica consistency invariant apply only to GPUs? → A: No. Hardware spec consistency applies to ALL resource types (CPU, memory, storage, GPU). All replicas of the same service MUST resolve to identical resource configurations across every dimension.
- Q: How are providers filtered beyond resource capacity? → A: Providers are also filtered by placement attributes (key-value pairs with glob/wildcard support) and auditor signatures (signedBy allOf/anyOf). Existing `getProvidersHostUriByAttributes` demonstrates this pattern.
- Q: What is the input format? → A: The input is a `GroupSpec` from the `@akashnetwork/chain-sdk` protobuf package (deployment/v1beta4), containing placement requirements (attributes + signedBy) and resource units (CPU, memory, GPU, storage[], endpoints, count).
- Q: What should the screening return for each matching provider? → A: Provider address (owner), region, uptime (7d), host URI, and audited (boolean).
- Q: Should attribute filtering run before bin-packing? → A: Yes, as a sanity check. If zero providers match attributes, fail fast. Use the resulting provider addresses to scope subsequent queries for performance. Exact pipeline order is flexible during implementation.
- Q: What makes a provider "audited"? → A: A provider is audited if it has been signed by a known auditor. Currently the only auditor is Akash (akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63). The list of known auditors may grow over time.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Resource Filtering (Priority: P1)

A deployment creator edits their SDL definition and wants to instantly
see which online providers have enough CPU, memory, and ephemeral
storage to fulfil the entire deployment. The system receives a
GroupSpec (parsed SDL), queries the provider inventory database, runs
the matching algorithm across all online providers, and returns a
filtered list of providers that can accommodate every resource group
(service + replica count). A provider MUST be able to fulfil ALL
resource groups — services cannot be split across providers.

**Why this priority**: This is the core value proposition. Without
basic resource matching, no other screening feature is useful. Most
Akash deployments today request only CPU, memory, and ephemeral
storage.

**Independent Test**: Submit a GroupSpec requesting 2 vCPUs, 4 GiB
memory, and 10 GiB ephemeral storage. Verify that only providers
whose latest snapshot shows sufficient available capacity on at least
one node are returned.

**Acceptance Scenarios**:

1. **Given** a GroupSpec with a single resource unit requesting 1 vCPU,
   2 GiB memory, 1 GiB ephemeral storage, **When** the screening is
   executed, **Then** all online providers with at least one node
   having sufficient available CPU, memory, and ephemeral storage are
   returned.
2. **Given** a GroupSpec with a resource unit requesting 500 vCPUs,
   **When** the screening is executed, **Then** zero providers are
   returned because no single node has that capacity.
3. **Given** a GroupSpec with two resource units (services) each with
   3 replicas, **When** the screening is executed, **Then** only
   providers whose node inventory can accommodate all 6 replica
   placements (using greedy bin-packing across nodes) are returned.
4. **Given** a provider that is offline (isOnline = false), **When**
   the screening is executed, **Then** that provider is excluded from
   results regardless of its resource capacity.
5. **Given** a GroupSpec with 3 resource units where a provider can
   fulfil 2 but not the third, **When** the screening is executed,
   **Then** that provider is excluded because all services must be
   fulfilled by a single provider.

---

### User Story 2 - GPU-Aware Filtering (Priority: P2)

A deployment creator specifies GPU requirements in their SDL
(vendor, model, optional RAM size and interface type). The screening
filters providers to only those that have matching GPU hardware
available on their nodes. Wildcard model matching (e.g.,
"any NVIDIA GPU") is supported.

**Why this priority**: GPU deployments are high-value workloads on
Akash. Users need to quickly find providers with specific GPU
hardware. This is the second most impactful filter after basic
resources.

**Independent Test**: Submit a GroupSpec requesting 1 NVIDIA A100 GPU
with 80Gi VRAM. Verify that only providers with at least one node
containing an available A100 with 80Gi memory are returned.

**Acceptance Scenarios**:

1. **Given** a GroupSpec requesting 1 GPU with vendor=nvidia,
   model=a100, **When** the screening is executed, **Then** only
   providers with available NVIDIA A100 GPUs are returned.
2. **Given** a GroupSpec requesting 1 GPU with vendor=nvidia, model=*
   (wildcard), **When** the screening is executed, **Then** providers
   with any available NVIDIA GPU are returned.
3. **Given** a GroupSpec requesting 1 GPU with vendor=nvidia,
   model=a100, ram=80Gi, interface=sxm, **When** the screening is
   executed, **Then** only providers with A100 GPUs having exactly
   80Gi VRAM and SXM-family interface are returned. Interface
   normalization collapses sxm2/sxm3/sxm4 to match "sxm".
4. **Given** a GroupSpec requesting 2 GPUs of the same model, **When**
   the screening is executed, **Then** only providers with at least 2
   matching GPUs available on a single node are returned.

---

### User Story 3 - Persistent Storage Class Filtering (Priority: P3)

A deployment creator specifies persistent storage volumes with a
required storage class (beta1, beta2, or beta3). The screening
verifies that a provider has both: (a) nodes that support the
requested storage class, and (b) sufficient cluster-wide persistent
storage pool capacity for that class.

**Why this priority**: Persistent storage is a common requirement for
database workloads and stateful services. Without class-aware
filtering, users see providers that cannot actually serve their
storage needs.

**Independent Test**: Submit a GroupSpec requesting a 50 GiB persistent
volume with class "beta2". Verify that only providers whose nodes
support "beta2" (capabilitiesStorageSSD = true) and whose cluster
storage pool for "beta2" has at least 50 GiB available are returned.

**Acceptance Scenarios**:

1. **Given** a GroupSpec with a persistent volume of class "beta2"
   requesting 100 GiB, **When** the screening is executed, **Then**
   only providers whose nodes declare "beta2" capability AND whose
   cluster storage pool for "beta2" has >= 100 GiB available are
   returned.
2. **Given** a GroupSpec with a non-persistent storage volume of class
   "ram", **When** the screening is executed, **Then** the volume
   quantity is deducted from node memory (not ephemeral storage), and
   providers are filtered accordingly.
3. **Given** a GroupSpec requesting persistent storage with an empty
   class or class "ram", **When** the screening is executed, **Then**
   the request is rejected with a validation error explaining that
   persistent volumes must specify a valid storage class.

---

### User Story 4 - Provider Attribute & Auditor Filtering (Priority: P4)

A deployment creator's SDL includes placement requirements: provider
attributes (key-value pairs) and auditor constraints (signedBy with
allOf and/or anyOf lists). Before running the resource bin-packing
check, the screening filters providers to only those whose attributes
match the required key-value pairs (with glob/wildcard support in
keys) and whose attribute signatures satisfy the auditor constraints.

**Why this priority**: Attribute filtering allows users to target
providers by region, tier, capabilities, or audited trust level.
Without this, users would see providers that match on resources but
fail placement requirements on-chain.

**Independent Test**: Submit a GroupSpec with placement requirements
specifying attribute `tier=community` and `signedBy.allOf` containing
one auditor address. Verify that only providers whose attributes
include `tier=community` AND have that auditor's signature are
returned.

**Acceptance Scenarios**:

1. **Given** a GroupSpec with placement attribute
   `capabilities/gpu/vendor/nvidia/model/*=true`, **When** the
   screening is executed, **Then** only providers whose attributes
   match the glob pattern (any NVIDIA GPU model) are included in the
   candidate set.
2. **Given** a GroupSpec with `signedBy.allOf` containing auditors
   [A, B], **When** the screening is executed, **Then** only providers
   whose attributes are signed by BOTH auditor A and auditor B are
   included.
3. **Given** a GroupSpec with `signedBy.anyOf` containing auditors
   [A, B], **When** the screening is executed, **Then** providers
   signed by either A or B (or both) are included.
4. **Given** a GroupSpec with both attributes and signedBy constraints,
   **When** the screening is executed, **Then** both filters are
   applied: attribute match AND auditor match must pass.
5. **Given** a GroupSpec with no placement requirements (empty
   attributes and signedBy), **When** the screening is executed,
   **Then** all online providers are considered candidates (no
   attribute filtering applied).

---

### User Story 5 - Multi-Group Replica Consistency (Priority: P5)

A deployment creator defines a GroupSpec with multiple resource units,
each having different resource requirements and replica counts. The
screening performs full bin-packing simulation: replicas are placed
greedily across nodes, and a provider passes only if ALL replicas of
ALL resource groups can be placed. Replicas of the same service MUST
resolve to identical resource configurations across ALL dimensions
(CPU, memory, storage, GPU) — the replica consistency invariant.

**Why this priority**: Complex deployments with multiple services
are common in production. Without full bin-packing simulation, the
screening would over-report eligible providers.

**Independent Test**: Submit a GroupSpec with Resource Unit A
(4 replicas, 1 vCPU each) and Resource Unit B (2 replicas, 2 vCPU +
1 GPU each). Verify that a provider with 3 nodes (2 CPU-only,
1 GPU-enabled) is correctly evaluated: Unit A replicas spread across
CPU nodes, Unit B replicas placed on the GPU node, and the provider
passes only if all 6 placements succeed.

**Acceptance Scenarios**:

1. **Given** a GroupSpec with 2 resource units totalling 6 replicas,
   **When** a provider has enough aggregate resources but no single
   node can fit all replicas, **Then** the bin-packing simulation
   correctly spreads replicas across nodes and the provider passes.
2. **Given** a GroupSpec with 4 replicas of a GPU resource unit,
   **When** a provider has 4 matching GPUs spread across 2 nodes
   (2 each), **Then** the provider passes because replicas can be
   split across nodes.
3. **Given** a GroupSpec where the third replica of a resource unit
   would resolve to a different GPU model than the first two,
   **Then** the provider fails the consistency check and is excluded.
4. **Given** a GroupSpec where replicas of the same resource unit
   would land on nodes with different CPU or memory configurations,
   **Then** this is acceptable as long as each node has sufficient
   allocatable capacity — the consistency invariant applies to the
   adjusted resource attributes (particularly GPU matching), not to
   underlying hardware homogeneity.

---

### Edge Cases

- What happens when a provider has zero nodes in its latest snapshot?
  The provider is excluded (no capacity).
- What happens when the GroupSpec contains no resource units? The
  request is rejected with a validation error.
- What happens when a provider's snapshot data is stale (e.g., hours
  old)? The screening uses the latest available snapshot. Staleness is
  accepted as an inherent trade-off of database-based screening vs.
  real-time blockchain queries.
- What happens when two providers tie on eligibility? All eligible
  providers are returned; the screening does not rank or sort by
  preference.
- What happens when the GroupSpec requests resources that exceed any
  known provider's total capacity? An empty provider list is returned
  (not an error).
- What happens when a provider matches on resources but fails
  attribute/auditor filtering? The provider is excluded. Attribute
  filtering is applied before resource matching.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept a GroupSpec (from
  @akashnetwork/chain-sdk protobuf, deployment/v1beta4) as input and
  return a list of matching providers. Each provider in the response
  MUST include: owner address, region, uptime (7-day), host URI, and
  audited status (boolean — true if the provider has been signed by
  a known auditor from a maintained list; currently only the Akash
  auditor). The GroupSpec contains placement
  requirements (attributes + signedBy) and resource units (CPU,
  memory, GPU, storage[], endpoints, count).
- **FR-002**: The system MUST implement greedy bin-packing across
  provider nodes, matching the semantics of the Go reference
  implementation's Adjust() algorithm (transactional, deep-copy-based,
  with node restart after group completion).
- **FR-003**: The system MUST evaluate only online providers (those
  with isOnline = true in their latest snapshot).
- **FR-004**: The system MUST match GPU requirements by vendor, model
  (with wildcard support), optional RAM size, and optional interface
  type. Interface comparison MUST normalize all "sxm*" variants to
  "sxm".
- **FR-005**: The system MUST classify storage volumes into three
  categories: RAM-backed (deducted from node memory), ephemeral
  (deducted from node ephemeral storage), and persistent (deducted
  from cluster storage pool by class). Storage classes in the database
  are stored as beta1 (HDD), beta2 (SSD), and beta3 (NVMe).
- **FR-006**: The system MUST enforce the replica consistency
  invariant: all replicas of the same resource unit MUST resolve to
  identical adjusted resource attributes across ALL dimensions (CPU,
  memory, storage, GPU).
- **FR-007**: The system MUST reject invalid inputs with descriptive
  error messages (e.g., persistent volume without storage class,
  malformed GPU attributes, empty resource units).
- **FR-008**: The system MUST return results within 5 seconds under
  all conditions, including concurrent requests and up to 10,000
  online providers. This is a hard latency ceiling, not a best-effort
  target. Under normal load (~1,000 providers), responses SHOULD be
  significantly faster (sub-second).
- **FR-009**: The system MUST operate in read-only mode against the
  database. No inventory state is modified (equivalent to the Go
  implementation's DryRun mode).
- **FR-010**: The system MUST use provider snapshot data from the
  database (latest successful snapshot per provider) as the source of
  truth for node-level and cluster-level resource availability.
- **FR-011**: A single provider MUST be able to fulfil ALL resource
  units in the GroupSpec. Services cannot be split across providers.
  If any resource unit cannot be placed, the provider is excluded.
- **FR-012**: The system MUST filter providers by placement attributes
  from GroupSpec.requirements.attributes, supporting glob/wildcard
  patterns in attribute keys (e.g.,
  `capabilities/gpu/vendor/nvidia/model/*`). Attribute filtering
  SHOULD run as a sanity check before resource bin-packing: if zero
  providers match placement requirements, the system MUST return an
  empty result immediately without running bin-packing. The resulting
  provider addresses SHOULD be used to scope subsequent database
  queries for performance.
- **FR-013**: The system MUST filter providers by auditor constraints
  from GroupSpec.requirements.signedBy, supporting both allOf
  (provider must be signed by ALL listed auditors) and anyOf (provider
  must be signed by at least ONE listed auditor).

### Key Entities

- **GroupSpec**: The protobuf input type from @akashnetwork/chain-sdk
  (deployment/v1beta4). Contains a name, placement requirements
  (attributes + signedBy), and an array of resource units.
- **Provider**: An entity offering compute resources on the Akash
  network. Identified by owner address. Has online/offline status,
  attributes (key-value pairs), attribute signatures (auditor-signed),
  and a latest snapshot.
- **Provider Snapshot**: A point-in-time record of a provider's
  resource inventory, including node-level and cluster-level storage
  data.
- **Snapshot Node**: A compute node within a provider, with CPU
  (allocatable/allocated in milli-units), memory (bytes), ephemeral
  storage (bytes), GPU count, and storage class capabilities
  (beta1/beta2/beta3 mapped to HDD/SSD/NVMe booleans).
- **Snapshot Node GPU**: A physical GPU on a node, described by
  vendor, model name, model ID, interface type, and memory size.
- **Snapshot Storage**: A cluster-wide persistent storage pool,
  described by class (beta1/beta2/beta3) and allocatable/allocated
  capacity in bytes.
- **Resource Unit**: A service from the GroupSpec with specific
  resource requirements (CPU, memory, GPU, storage[]) and a replica
  count. Multiple resource units form a deployment group.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The screening MUST return results within 5 seconds for
  up to 10,000 online providers, each with up to 50 nodes, when
  processing a GroupSpec with up to 10 resource units. Under normal
  load (~1,000 providers), response time SHOULD be sub-second.
- **SC-002**: The screening correctly identifies 100% of eligible
  providers (no false negatives) when compared against the Go
  reference implementation's matching logic for the same input.
- **SC-003**: The screening excludes 100% of ineligible providers (no
  false positives) when compared against the Go reference
  implementation's matching logic for the same input.
- **SC-004**: Users see the filtered provider list update within 5
  seconds of editing their SDL in the deployment flow.
- **SC-005**: 50 simultaneous screening requests MUST each complete
  within the 5-second ceiling. No request may be starved or timed
  out under concurrent load.

## Assumptions

- The existing provider snapshot data in the database is sufficiently
  fresh for screening purposes. The indexer updates snapshots
  periodically, and some staleness is acceptable since the screening
  is advisory (the actual bidding happens on-chain).
- The GroupSpec is provided as the input type. SDL-to-GroupSpec
  parsing is handled upstream and is out of scope for this feature.
- The screening operates as a read-only query. It does not modify
  provider inventory or create any blockchain transactions.
- The current ~100 online providers will grow to ~1,000 in the near
  term. The system should handle up to 10,000 providers as an upper
  bound.
- Provider nodes typically number between 1 and 50 per provider.
- A typical GroupSpec has 1-5 resource units (services) with 1-10
  replicas each.
- The existing provider snapshot schema (ProviderSnapshot,
  ProviderSnapshotNode, ProviderSnapshotNodeGPU,
  ProviderSnapshotStorage) contains all data needed for the matching
  algorithm. No schema changes are required.
- Storage classes in the database are stored as beta1/beta2/beta3,
  matching SDL storage class names directly. No translation is needed.
- Provider attribute filtering (including glob patterns and
  auditor-signed attributes) can leverage the existing
  ProviderRepository.getProvidersHostUriByAttributes pattern.
