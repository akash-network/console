# Data Model: Bid Screening

**Feature**: Bid Screening
**Date**: 2026-04-27

## Existing Entities (Read-Only — No Schema Changes)

All entities below already exist in `packages/database/dbSchemas/akash/`.
The bid screening feature reads them but does not modify their schemas.

### Provider

| Field | Type | Notes |
|-------|------|-------|
| owner | string (PK) | Provider address on Akash chain |
| hostUri | string | Provider HTTPS endpoint |
| isOnline | boolean | Latest uptime check result |
| lastSuccessfulSnapshotId | UUID | FK to ProviderSnapshot |
| ipRegion | string | Geo-resolved region name |
| ipCountry | string | Geo-resolved country |
| uptime7d | double | 7-day uptime percentage |

**Relationships**: HasMany ProviderAttribute, HasMany ProviderAttributeSignature, BelongsTo ProviderSnapshot (lastSuccessfulSnapshot)

### ProviderAttribute

| Field | Type | Notes |
|-------|------|-------|
| provider | string | FK to Provider.owner |
| key | string | Attribute key (supports glob matching) |
| value | string | Attribute value |

### ProviderAttributeSignature

| Field | Type | Notes |
|-------|------|-------|
| provider | string | FK to Provider.owner |
| auditor | string | Auditor address |
| key | string | Signed attribute key |
| value | string | Signed attribute value |

### ProviderSnapshot

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | Snapshot identifier |
| owner | string | FK to Provider.owner |
| isOnline | boolean | Online at snapshot time |
| checkDate | Date | Snapshot timestamp |

**Relationships**: HasMany ProviderSnapshotNode, HasMany ProviderSnapshotStorage

### ProviderSnapshotNode

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | Node identifier |
| snapshotId | UUID | FK to ProviderSnapshot.id |
| name | string | Node name within cluster |
| cpuAllocatable | bigint | Milli-CPU (1000 = 1 vCPU) |
| cpuAllocated | bigint | Milli-CPU currently in use |
| memoryAllocatable | bigint | Bytes |
| memoryAllocated | bigint | Bytes |
| ephemeralStorageAllocatable | bigint | Bytes |
| ephemeralStorageAllocated | bigint | Bytes |
| gpuAllocatable | bigint | GPU count |
| gpuAllocated | bigint | GPU count |
| capabilitiesStorageHDD | boolean | Supports beta1 (HDD) |
| capabilitiesStorageSSD | boolean | Supports beta2 (SSD) |
| capabilitiesStorageNVME | boolean | Supports beta3 (NVMe) |

**Relationships**: HasMany ProviderSnapshotNodeGPU, HasMany ProviderSnapshotNodeCPU

### ProviderSnapshotNodeGPU

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | GPU record identifier |
| snapshotNodeId | UUID | FK to ProviderSnapshotNode.id |
| vendor | string | e.g., "nvidia", "amd" |
| name | string | Model name, e.g., "a100" |
| modelId | string | PCI model ID |
| interface | string | e.g., "PCIe", "SXM4" |
| memorySize | string | e.g., "80Gi" |

### ProviderSnapshotStorage

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | Storage record identifier |
| snapshotId | UUID | FK to ProviderSnapshot.id |
| class | string | "beta1" (HDD), "beta2" (SSD), "beta3" (NVMe) |
| allocatable | bigint | Bytes |
| allocated | bigint | Bytes |

## In-Memory Algorithm Data Structures

These types are created at runtime for the bin-packing algorithm.
They mirror the Go reference implementation's data model.

### ClusterInventory

Constructed from a provider's snapshot data for the matching algorithm.

```
ClusterInventory
  nodes: NodeInventory[]
  storage: ClusterStoragePool[]
```

### NodeInventory

Constructed from ProviderSnapshotNode + ProviderSnapshotNodeGPU.

```
NodeInventory
  name: string
  cpu: ResourcePair              // milli-CPU
  memory: ResourcePair           // bytes
  ephemeralStorage: ResourcePair // bytes
  gpu: GpuInventory
  storageClasses: string[]       // ["beta1", "beta2", "beta3"]
```

### ResourcePair

The fundamental allocation primitive. Tracks capacity and allocation.

```
ResourcePair
  allocatable: bigint
  allocated: bigint

  available(): bigint            // allocatable - allocated, clamped to 0
  subNLZ(val: bigint): boolean   // subtract-not-less-than-zero
  subMilliNLZ(val: bigint): boolean // milli-unit variant (CPU)
```

### GpuInventory

```
GpuInventory
  quantity: ResourcePair         // GPU count
  info: GpuInfo[]                // physical GPU descriptions
```

### GpuInfo

```
GpuInfo
  vendor: string
  name: string
  modelId: string
  interface: string
  memorySize: string
```

### ClusterStoragePool

```
ClusterStoragePool
  class: string                  // "beta1", "beta2", "beta3"
  quantity: ResourcePair         // bytes
```

### RequestedResources (from GroupSpec)

Mapped from GroupSpec.resources[].resource.

```
RequestedResourceUnit
  id: number
  resources: RequestedResources
  count: number                  // replica count

RequestedResources
  cpu: { units: bigint; attributes: Attribute[] }
  gpu: { units: bigint; attributes: Attribute[] }
  memory: { quantity: bigint; attributes: Attribute[] }
  storage: RequestedStorage[]

RequestedStorage
  name: string
  quantity: bigint
  attributes: Attribute[]        // persistent, class, etc.
```

### MatchResult

```
MatchResult
  matched: boolean
  error?: "INSUFFICIENT_CAPACITY" | "GROUP_RESOURCE_MISMATCH"
```

## Data Flow

```
GroupSpec (input)
  │
  ├─[1]─ Extract requirements.attributes + signedBy
  │      → ProviderRepository.getProvidersHostUriByAttributes()
  │      → candidate provider addresses[]
  │
  ├─[2]─ For each candidate: load Provider + lastSuccessfulSnapshot
  │      + nodes + nodeGPUs + storage
  │      → BidScreeningRepository
  │
  ├─[3]─ For each provider: build ClusterInventory from snapshot
  │      → ClusterInventoryMatcherService.match(inventory, resourceUnits)
  │      → MatchResult
  │
  └─[4]─ Collect passing providers with metadata
         → BidScreeningResponse[]
```
