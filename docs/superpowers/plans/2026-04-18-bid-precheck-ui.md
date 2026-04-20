# Bid Precheck UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the EditDeployment step in the new-deployment flow with a split-panel "Configure & Match Providers" UI that queries the bid-screening API as the user adjusts workload config.

**Architecture:** The new `ConfigureProviders` component replaces `ManifestEdit` in `NewDeploymentContainer`'s step routing. It reuses the existing react-hook-form + Zod SDL builder form, wrapping the existing form controls (CpuFormControl, GpuFormControl, etc.) in a left panel. A right panel shows a paginated provider table powered by `POST /v1/bid-screening`. An undo/redo filter history with snackbar notifications tracks applied filter states. A quote modal (mocked Stage 2) shows pricing breakdowns per provider.

**Tech Stack:** React 18, Next.js 14, react-hook-form + Zod, TanStack React Query, Tailwind CSS, Radix UI primitives via @akashnetwork/ui, notistack for snackbars, TypeScript strict mode.

---

## File Map

```
NEW FILES:
apps/deploy-web/src/
  components/new-deployment/ConfigureProviders/
    ConfigureProviders.tsx               — Main component: form provider, split layout, orchestration
    ConfigureProvidersHeader.tsx          — Top bar: deployment name, template badge, undo/redo arrows
    WorkloadConfigPanel.tsx              — Left panel: collapsible sections wrapping existing SDL controls
    PlacementSection.tsx                 — Max price slider, audited-by chips, region chips
    ProviderListPanel.tsx                — Right panel: toolbar + table + pagination
    ProviderTable.tsx                    — Sortable data table for providers
    FilterActionBar.tsx                  — Sticky bottom: pending changes count, revert, apply
    FilterSnackbar.tsx                   — Center-bottom notification with undo/redo
    QuoteModal.tsx                       — Price quote dialog (mocked Stage 2)
  hooks/
    useFilterHistory.ts                  — Undo/redo snapshot stack hook
    useBidScreening.ts                   — React Query hook for POST /v1/bid-screening
  utils/
    sdlFormToBidScreeningRequest.ts      — Transform SDL form values → API request shape
    mockQuoteGenerator.ts                — Generate mock Stage 2 pricing

MODIFIED FILES:
  components/new-deployment/NewDeploymentContainer/NewDeploymentContainer.tsx  — Wire ConfigureProviders into step 2
  queries/queryKeys.ts                   — Add bid-screening query key
  utils/apiUtils.ts                      — Add bidScreening() URL helper
```

---

### Task 1: sdlFormToBidScreeningRequest utility

**Files:**
- Create: `apps/deploy-web/src/utils/sdlFormToBidScreeningRequest.ts`
- Test: `apps/deploy-web/src/utils/sdlFormToBidScreeningRequest.spec.ts`

This is the pure data-transformation layer with no UI dependencies. It converts the react-hook-form `SdlBuilderFormValuesType` into the `POST /v1/bid-screening` request body.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/deploy-web/src/utils/sdlFormToBidScreeningRequest.spec.ts
import { describe, expect, it } from "vitest";

import type { PlacementFilters } from "./sdlFormToBidScreeningRequest";
import { sdlFormToBidScreeningRequest } from "./sdlFormToBidScreeningRequest";

describe("sdlFormToBidScreeningRequest", () => {
  it("converts a basic CPU-only service to a bid screening request", () => {
    const result = setup();

    expect(result).toEqual({
      data: {
        resources: [
          {
            cpu: 500,
            memory: 536870912,
            gpu: 0,
            ephemeralStorage: 1073741824,
            count: 1
          }
        ],
        requirements: {},
        limit: 200
      }
    });
  });

  it("converts GPU service with model attributes", () => {
    const result = setup({
      services: [
        makeService({
          profile: {
            cpu: 4,
            hasGpu: true,
            gpu: 2,
            gpuModels: [{ vendor: "nvidia", name: "a100", memory: "80Gi", interface: "PCIe" }],
            ram: 32,
            ramUnit: "Gi",
            storage: [{ size: 100, unit: "Gi", isPersistent: false }]
          },
          count: 3
        })
      ]
    });

    expect(result.data.resources[0]).toEqual({
      cpu: 4000,
      memory: 34359738368,
      gpu: 2,
      gpuAttributes: { vendor: "nvidia", model: "a100", memorySize: "80Gi", interface: "PCIe" },
      ephemeralStorage: 107374182400,
      count: 3
    });
  });

  it("includes persistent storage when present", () => {
    const result = setup({
      services: [
        makeService({
          profile: {
            cpu: 1,
            ram: 1,
            ramUnit: "Gi",
            storage: [
              { size: 1, unit: "Gi", isPersistent: false },
              { size: 10, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/data" }
            ]
          }
        })
      ]
    });

    expect(result.data.resources[0].persistentStorage).toBe(10737418240);
    expect(result.data.resources[0].persistentStorageClass).toBe("beta3");
  });

  it("includes auditor signedBy from placement filters", () => {
    const result = setup({
      placementFilters: {
        maxPrice: null,
        auditedBy: ["akash1auditor1address"],
        regions: []
      }
    });

    expect(result.data.requirements).toEqual({
      signedBy: { anyOf: ["akash1auditor1address"] }
    });
  });

  it("maps multiple services to multiple resource units", () => {
    const result = setup({
      services: [
        makeService({ profile: { cpu: 0.5, ram: 512, ramUnit: "Mi", storage: [{ size: 1, unit: "Gi", isPersistent: false }] } }),
        makeService({ profile: { cpu: 2, ram: 4, ramUnit: "Gi", storage: [{ size: 10, unit: "Gi", isPersistent: false }] } })
      ]
    });

    expect(result.data.resources).toHaveLength(2);
    expect(result.data.resources[0].cpu).toBe(500);
    expect(result.data.resources[1].cpu).toBe(2000);
  });

  function makeService(overrides: Record<string, any> = {}) {
    return {
      id: "test-id",
      title: "service-1",
      image: "nginx",
      profile: {
        cpu: 0.5,
        hasGpu: false,
        gpu: 1,
        gpuModels: [{ vendor: "nvidia" }],
        ram: 512,
        ramUnit: "Mi",
        storage: [{ size: 1, unit: "Gi", isPersistent: false }],
        ...overrides.profile
      },
      expose: [{ id: "e1", port: 80, as: 80, proto: "http", global: true, to: [], accept: [], ipName: "", httpOptions: {} }],
      command: { command: "", arg: "" },
      env: [],
      placement: {
        name: "dcloud",
        pricing: { amount: 100000, denom: "uact" },
        signedBy: { anyOf: [], allOf: [] },
        attributes: []
      },
      count: 1,
      ...overrides
    };
  }

  function setup(input: { services?: any[]; placementFilters?: PlacementFilters } = {}) {
    const services = input.services ?? [makeService()];
    const placementFilters: PlacementFilters = input.placementFilters ?? {
      maxPrice: null,
      auditedBy: [],
      regions: []
    };

    return sdlFormToBidScreeningRequest({ services } as any, placementFilters);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/deploy-web && npx vitest run src/utils/sdlFormToBidScreeningRequest.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// apps/deploy-web/src/utils/sdlFormToBidScreeningRequest.ts
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";

export type PlacementFilters = {
  maxPrice: number | null;
  auditedBy: string[];
  regions: string[];
};

type ResourceUnit = {
  cpu: number;
  memory: number;
  gpu: number;
  gpuAttributes?: { vendor: string; model?: string; interface?: string; memorySize?: string };
  ephemeralStorage: number;
  persistentStorage?: number;
  persistentStorageClass?: "beta1" | "beta2" | "beta3";
  count: number;
};

type BidScreeningRequest = {
  data: {
    resources: ResourceUnit[];
    requirements: {
      attributes?: { key: string; value: string }[];
      signedBy?: { allOf?: string[]; anyOf?: string[] };
    };
    limit: number;
  };
};

const UNIT_MULTIPLIERS: Record<string, number> = {
  mi: 1048576,
  mb: 1000000,
  gi: 1073741824,
  gb: 1000000000,
  ti: 1099511627776,
  tb: 1000000000000
};

function toBytes(size: number, unit: string): number {
  const multiplier = UNIT_MULTIPLIERS[unit.toLowerCase()] ?? 1;
  return Math.round(size * multiplier);
}

function serviceToResourceUnit(service: ServiceType): ResourceUnit {
  const { profile, count } = service;
  const ephemeralStorage = profile.storage.find(s => !s.isPersistent);
  const persistentStorage = profile.storage.find(s => s.isPersistent);

  const unit: ResourceUnit = {
    cpu: Math.round(profile.cpu * 1000),
    memory: toBytes(profile.ram, profile.ramUnit),
    gpu: profile.hasGpu ? (profile.gpu ?? 0) : 0,
    ephemeralStorage: ephemeralStorage ? toBytes(ephemeralStorage.size, ephemeralStorage.unit) : toBytes(1, "Gi"),
    count: count ?? 1
  };

  if (unit.gpu > 0 && profile.gpuModels?.length) {
    const model = profile.gpuModels[0];
    unit.gpuAttributes = {
      vendor: model.vendor,
      ...(model.name && { model: model.name }),
      ...(model.interface && { interface: model.interface }),
      ...(model.memory && { memorySize: model.memory })
    };
  }

  if (persistentStorage) {
    unit.persistentStorage = toBytes(persistentStorage.size, persistentStorage.unit);
    if (persistentStorage.type && ["beta1", "beta2", "beta3"].includes(persistentStorage.type)) {
      unit.persistentStorageClass = persistentStorage.type as "beta1" | "beta2" | "beta3";
    }
  }

  return unit;
}

export function sdlFormToBidScreeningRequest(formValues: SdlBuilderFormValuesType, placementFilters: PlacementFilters): BidScreeningRequest {
  const resources = formValues.services.map(serviceToResourceUnit);

  const requirements: BidScreeningRequest["data"]["requirements"] = {};

  const firstService = formValues.services[0];
  if (firstService?.placement?.attributes?.length) {
    requirements.attributes = firstService.placement.attributes.map(attr => ({
      key: attr.key ?? "",
      value: attr.value ?? ""
    }));
  }

  const hasAuditedBy = placementFilters.auditedBy.length > 0;
  const hasSignedByAllOf = firstService?.placement?.signedBy?.allOf?.length > 0;
  const hasSignedByAnyOf = firstService?.placement?.signedBy?.anyOf?.length > 0;

  if (hasAuditedBy || hasSignedByAllOf || hasSignedByAnyOf) {
    requirements.signedBy = {};
    const anyOf = [...(firstService?.placement?.signedBy?.anyOf?.map(s => s.value) ?? []), ...placementFilters.auditedBy];
    if (anyOf.length > 0) requirements.signedBy.anyOf = anyOf;
    const allOf = firstService?.placement?.signedBy?.allOf?.map(s => s.value) ?? [];
    if (allOf.length > 0) requirements.signedBy.allOf = allOf;
  }

  return {
    data: {
      resources,
      requirements,
      limit: 200
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/deploy-web && npx vitest run src/utils/sdlFormToBidScreeningRequest.spec.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/deploy-web/src/utils/sdlFormToBidScreeningRequest.ts apps/deploy-web/src/utils/sdlFormToBidScreeningRequest.spec.ts
git commit -m "feat(deploy-web): add sdlFormToBidScreeningRequest utility

Transforms SDL builder form values into the POST /v1/bid-screening
API request shape. Handles CPU→millicpu, memory/storage→bytes
conversions, GPU attributes, persistent storage, and auditor
signedBy requirements from placement filters.

Part of CON-186"
```

---

### Task 2: mockQuoteGenerator utility

**Files:**
- Create: `apps/deploy-web/src/utils/mockQuoteGenerator.ts`
- Test: `apps/deploy-web/src/utils/mockQuoteGenerator.spec.ts`

Generates deterministic mock pricing for the Stage 2 quote modal.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/deploy-web/src/utils/mockQuoteGenerator.spec.ts
import { describe, expect, it } from "vitest";

import { generateMockQuote } from "./mockQuoteGenerator";

describe("generateMockQuote", () => {
  it("generates a quote for a basic CPU workload", () => {
    const result = setup();

    expect(result.pricePerBlock).toBeCloseTo(0.0085, 4);
    expect(result.monthlyCostUsd).toBeGreaterThan(0);
    expect(result.breakdown.cpu).toBeCloseTo(0.006, 4);
    expect(result.breakdown.memory).toBeCloseTo(0.002, 4);
    expect(result.breakdown.ephemeral).toBeCloseTo(0.0005, 4);
    expect(result.expiresIn).toBe(120);
  });

  it("includes GPU cost when gpu > 0", () => {
    const result = setup({
      resources: [{ cpu: 4000, memory: 34359738368, gpu: 2, ephemeralStorage: 107374182400, count: 1 }]
    });

    expect(result.breakdown.gpu).toBeCloseTo(0.2, 4);
    expect(result.pricePerBlock).toBeGreaterThan(0.2);
  });

  it("includes persistent storage cost", () => {
    const result = setup({
      resources: [{ cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, persistentStorage: 10737418240, count: 1 }]
    });

    expect(result.breakdown.persistentStorage).toBeCloseTo(0.005, 4);
  });

  function setup(input: { resources?: any[]; actUsdPrice?: number } = {}) {
    const resources = input.resources ?? [{ cpu: 500, memory: 536870912, gpu: 0, ephemeralStorage: 1073741824, count: 1 }];
    const actUsdPrice = input.actUsdPrice ?? 0.35;
    return generateMockQuote(resources, actUsdPrice);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/deploy-web && npx vitest run src/utils/mockQuoteGenerator.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// apps/deploy-web/src/utils/mockQuoteGenerator.ts
type ResourceUnit = {
  cpu: number;
  memory: number;
  gpu: number;
  ephemeralStorage: number;
  persistentStorage?: number;
  count: number;
};

export type MockQuote = {
  pricePerBlock: number;
  monthlyCostUsd: number;
  breakdown: {
    cpu: number;
    memory: number;
    ephemeral: number;
    gpu?: number;
    persistentStorage?: number;
  };
  expiresIn: number;
};

const GIB = 1073741824;
const BLOCKS_PER_MONTH = 438000;

export function generateMockQuote(resources: ResourceUnit[], actUsdPrice: number): MockQuote {
  let totalCpu = 0;
  let totalMemory = 0;
  let totalGpu = 0;
  let totalEphemeral = 0;
  let totalPersistent = 0;

  for (const r of resources) {
    totalCpu += (r.cpu / 1000) * r.count;
    totalMemory += (r.memory / GIB) * r.count;
    totalGpu += r.gpu * r.count;
    totalEphemeral += (r.ephemeralStorage / GIB) * r.count;
    totalPersistent += ((r.persistentStorage ?? 0) / GIB) * r.count;
  }

  const cpuCost = 0.012 * totalCpu;
  const memoryCost = 0.004 * totalMemory;
  const ephemeralCost = 0.0005 * totalEphemeral;
  const gpuCost = totalGpu > 0 ? 0.1 * totalGpu : 0;
  const persistentCost = totalPersistent > 0 ? 0.0005 * totalPersistent : 0;

  const pricePerBlock = cpuCost + memoryCost + ephemeralCost + gpuCost + persistentCost;
  const monthlyCostUsd = pricePerBlock * BLOCKS_PER_MONTH * actUsdPrice;

  const breakdown: MockQuote["breakdown"] = {
    cpu: cpuCost,
    memory: memoryCost,
    ephemeral: ephemeralCost
  };
  if (gpuCost > 0) breakdown.gpu = gpuCost;
  if (persistentCost > 0) breakdown.persistentStorage = persistentCost;

  return { pricePerBlock, monthlyCostUsd, breakdown, expiresIn: 120 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/deploy-web && npx vitest run src/utils/mockQuoteGenerator.spec.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/deploy-web/src/utils/mockQuoteGenerator.ts apps/deploy-web/src/utils/mockQuoteGenerator.spec.ts
git commit -m "feat(deploy-web): add mock quote generator for Stage 2 POC

Generates deterministic ACT/block pricing based on requested
resources: CPU, memory, ephemeral storage, GPU, and persistent
storage with per-GiB rates.

Part of CON-186"
```

---

### Task 3: useFilterHistory hook

**Files:**
- Create: `apps/deploy-web/src/hooks/useFilterHistory.ts`
- Test: `apps/deploy-web/src/hooks/useFilterHistory.spec.ts`

Manages the undo/redo snapshot stack for filter batches.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/deploy-web/src/hooks/useFilterHistory.spec.ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { useFilterHistory } from "./useFilterHistory";

describe("useFilterHistory", () => {
  it("initializes with a single snapshot", () => {
    const { result } = setup();

    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("pushes a new snapshot on apply", () => {
    const { result } = setup();

    act(() => {
      result.current.apply(makeFormValues({ cpu: 2 }), makePlacement(), 25);
    });

    expect(result.current.snapshots).toHaveLength(2);
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.snapshots[1].resultCount).toBe(25);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("undo restores previous snapshot", () => {
    const { result } = setup();

    act(() => {
      result.current.apply(makeFormValues({ cpu: 2 }), makePlacement(), 25);
    });
    act(() => {
      result.current.undo();
    });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("redo re-applies after undo", () => {
    const { result } = setup();

    act(() => result.current.apply(makeFormValues({ cpu: 2 }), makePlacement(), 25));
    act(() => result.current.undo());
    act(() => result.current.redo());

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("apply after undo discards redo entries", () => {
    const { result } = setup();

    act(() => result.current.apply(makeFormValues({ cpu: 2 }), makePlacement(), 25));
    act(() => result.current.apply(makeFormValues({ cpu: 4 }), makePlacement(), 10));
    act(() => result.current.undo());
    act(() => result.current.apply(makeFormValues({ cpu: 8 }), makePlacement(), 5));

    expect(result.current.snapshots).toHaveLength(3);
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.snapshots[2].resultCount).toBe(5);
  });

  it("caps stack at MAX_SNAPSHOTS (20)", () => {
    const { result } = setup();

    for (let i = 1; i <= 25; i++) {
      act(() => result.current.apply(makeFormValues({ cpu: i }), makePlacement(), i));
    }

    expect(result.current.snapshots.length).toBeLessThanOrEqual(20);
    expect(result.current.currentIndex).toBe(result.current.snapshots.length - 1);
  });

  it("pendingChanges counts differing fields", () => {
    const { result } = setup();

    const changes = result.current.pendingChanges(makeFormValues({ cpu: 2 }), makePlacement());
    expect(changes).toBeGreaterThan(0);
  });

  it("pendingChanges returns 0 when values match snapshot", () => {
    const { result } = setup();

    const changes = result.current.pendingChanges(makeFormValues(), makePlacement());
    expect(changes).toBe(0);
  });

  function makeFormValues(overrides: Record<string, any> = {}) {
    return {
      services: [
        {
          id: "test",
          title: "service-1",
          image: "nginx",
          profile: {
            cpu: overrides.cpu ?? 0.5,
            hasGpu: false,
            gpu: 1,
            gpuModels: [{ vendor: "nvidia" }],
            ram: 512,
            ramUnit: "Mi",
            storage: [{ size: 1, unit: "Gi", isPersistent: false }]
          },
          expose: [],
          command: { command: "", arg: "" },
          env: [],
          placement: { name: "dcloud", pricing: { amount: 100000, denom: "uact" }, signedBy: { anyOf: [], allOf: [] }, attributes: [] },
          count: 1
        }
      ]
    } as any;
  }

  function makePlacement(): PlacementFilters {
    return { maxPrice: null, auditedBy: [], regions: [] };
  }

  function setup() {
    return renderHook(() => useFilterHistory(makeFormValues(), makePlacement(), 36));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/deploy-web && npx vitest run src/hooks/useFilterHistory.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// apps/deploy-web/src/hooks/useFilterHistory.ts
import { useCallback, useState } from "react";

import type { SdlBuilderFormValuesType } from "@src/types";
import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";

export type FilterSnapshot = {
  formValues: SdlBuilderFormValuesType;
  placementFilters: PlacementFilters;
  timestamp: number;
  resultCount: number;
};

const MAX_SNAPSHOTS = 20;

export function useFilterHistory(initialFormValues: SdlBuilderFormValuesType, initialPlacement: PlacementFilters, initialResultCount: number) {
  const [state, setState] = useState<{ stack: FilterSnapshot[]; current: number }>(() => ({
    stack: [
      {
        formValues: structuredClone(initialFormValues),
        placementFilters: structuredClone(initialPlacement),
        timestamp: Date.now(),
        resultCount: initialResultCount
      }
    ],
    current: 0
  }));

  const apply = useCallback((formValues: SdlBuilderFormValuesType, placement: PlacementFilters, resultCount: number) => {
    setState(prev => {
      const truncated = prev.stack.slice(0, prev.current + 1);
      const next: FilterSnapshot = {
        formValues: structuredClone(formValues),
        placementFilters: structuredClone(placement),
        timestamp: Date.now(),
        resultCount
      };
      const newStack = [...truncated, next];

      if (newStack.length > MAX_SNAPSHOTS) {
        const overflow = newStack.length - MAX_SNAPSHOTS;
        return { stack: newStack.slice(overflow), current: newStack.length - overflow - 1 };
      }

      return { stack: newStack, current: newStack.length - 1 };
    });
  }, []);

  const undo = useCallback(() => {
    setState(prev => ({
      ...prev,
      current: Math.max(0, prev.current - 1)
    }));
  }, []);

  const redo = useCallback(() => {
    setState(prev => ({
      ...prev,
      current: Math.min(prev.stack.length - 1, prev.current + 1)
    }));
  }, []);

  const pendingChanges = useCallback(
    (currentFormValues: SdlBuilderFormValuesType, currentPlacement: PlacementFilters): number => {
      const snapshot = state.stack[state.current];
      if (!snapshot) return 0;

      const currentJson = JSON.stringify({ f: currentFormValues.services, p: currentPlacement });
      const snapshotJson = JSON.stringify({ f: snapshot.formValues.services, p: snapshot.placementFilters });
      return currentJson === snapshotJson ? 0 : 1;
    },
    [state.stack, state.current]
  );

  return {
    snapshots: state.stack,
    currentIndex: state.current,
    currentSnapshot: state.stack[state.current],
    canUndo: state.current > 0,
    canRedo: state.current < state.stack.length - 1,
    apply,
    undo,
    redo,
    pendingChanges
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/deploy-web && npx vitest run src/hooks/useFilterHistory.spec.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/deploy-web/src/hooks/useFilterHistory.ts apps/deploy-web/src/hooks/useFilterHistory.spec.ts
git commit -m "feat(deploy-web): add useFilterHistory hook for undo/redo filter batches

Manages a snapshot stack of applied filter states. Supports
apply (push), undo, redo, and pending change detection. Stack
capped at 20 entries with oldest-first eviction.

Part of CON-186"
```

---

### Task 4: useBidScreening hook + API wiring

**Files:**
- Create: `apps/deploy-web/src/hooks/useBidScreening.ts`
- Modify: `apps/deploy-web/src/utils/apiUtils.ts` — add `bidScreening()` URL helper
- Modify: `apps/deploy-web/src/queries/queryKeys.ts` — add bid-screening key

- [ ] **Step 1: Add the API URL helper**

In `apps/deploy-web/src/utils/apiUtils.ts`, add this static method to the `ApiUrlService` class alongside the existing `providerList()` method:

```typescript
  static bidScreening() {
    return `${this.baseApiUrl}/v1/bid-screening`;
  }
```

- [ ] **Step 2: Add the query key**

In `apps/deploy-web/src/queries/queryKeys.ts`, add this static method inside the `QueryKeys` class:

```typescript
  static getBidScreeningKey = (params: unknown) => ["BID_SCREENING", params];
```

- [ ] **Step 3: Write the hook**

```typescript
// apps/deploy-web/src/hooks/useBidScreening.ts
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { QueryKeys } from "@src/queries/queryKeys";
import { ApiUrlService } from "@src/utils/apiUtils";

type BidScreeningRequest = {
  data: {
    resources: Array<{
      cpu: number;
      memory: number;
      gpu: number;
      gpuAttributes?: { vendor: string; model?: string; interface?: string; memorySize?: string };
      ephemeralStorage: number;
      persistentStorage?: number;
      persistentStorageClass?: "beta1" | "beta2" | "beta3";
      count: number;
    }>;
    requirements: {
      attributes?: { key: string; value: string }[];
      signedBy?: { allOf?: string[]; anyOf?: string[] };
    };
    limit: number;
  };
};

export type BidScreeningProvider = {
  owner: string;
  hostUri: string;
  leaseCount: number;
  availableCpu: number;
  availableMemory: number;
  availableGpu: number;
  availableEphemeralStorage: number;
  availablePersistentStorage: number;
};

type BidScreeningConstraint = {
  name: string;
  count: number;
  actionableFeedback: string;
};

export type BidScreeningResponse = {
  data: {
    providers: BidScreeningProvider[];
    total: number;
    queryTimeMs: number;
    constraints?: BidScreeningConstraint[];
  };
};

export function useBidScreening(params: BidScreeningRequest | null) {
  const { publicConsoleApiHttpClient } = useServices();

  return useQuery({
    queryKey: QueryKeys.getBidScreeningKey(params),
    queryFn: async () => {
      const response = await publicConsoleApiHttpClient.post<BidScreeningResponse["data"]>(ApiUrlService.bidScreening(), params);
      return response.data;
    },
    enabled: !!params,
    staleTime: 30_000
  });
}
```

- [ ] **Step 4: Verify types compile**

Run: `cd apps/deploy-web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors referencing useBidScreening, apiUtils, or queryKeys

- [ ] **Step 5: Commit**

```bash
git add apps/deploy-web/src/hooks/useBidScreening.ts apps/deploy-web/src/utils/apiUtils.ts apps/deploy-web/src/queries/queryKeys.ts
git commit -m "feat(deploy-web): add useBidScreening hook and API wiring

React Query hook calling POST /v1/bid-screening with 30s stale
time. Adds bidScreening() URL helper and BID_SCREENING query key.

Part of CON-186"
```

---

### Task 5: FilterSnackbar component

**Files:**
- Create: `apps/deploy-web/src/components/new-deployment/ConfigureProviders/FilterSnackbar.tsx`

This is a self-contained presentational component with no external dependencies beyond UI primitives.

- [ ] **Step 1: Write the component**

```typescript
// apps/deploy-web/src/components/new-deployment/ConfigureProviders/FilterSnackbar.tsx
"use client";
import type { FC } from "react";
import { useEffect } from "react";
import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Redo, Undo } from "iconoir-react";

type Props = {
  message: string;
  visible: boolean;
  action: "undo" | "redo" | null;
  onUndo: () => void;
  onRedo: () => void;
  onDismiss: () => void;
};

export const FilterSnackbar: FC<Props> = ({ message, visible, action, onUndo, onRedo, onDismiss }) => {
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 left-1/2 z-50 -translate-x-1/2",
        "flex items-center gap-3 rounded-lg bg-popover px-4 py-3 shadow-lg border border-border"
      )}
    >
      <span className="text-sm font-medium">{message}</span>
      {action === "undo" && (
        <Button variant="text" size="xs" onClick={onUndo} className="gap-1">
          <Undo className="h-3.5 w-3.5" />
          Undo
        </Button>
      )}
      {action === "redo" && (
        <Button variant="text" size="xs" onClick={onRedo} className="gap-1">
          <Redo className="h-3.5 w-3.5" />
          Redo
        </Button>
      )}
      <span className="text-xs text-muted-foreground">Press Esc to exit</span>
    </div>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/deploy-web && npx tsc --noEmit --pretty 2>&1 | grep -i filtersnackbar || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/deploy-web/src/components/new-deployment/ConfigureProviders/FilterSnackbar.tsx
git commit -m "feat(deploy-web): add FilterSnackbar component

Center-bottom notification showing filter results with undo/redo
action. Auto-dismisses after 5s, Esc key dismisses immediately.

Part of CON-186"
```

---

### Task 6: FilterActionBar component

**Files:**
- Create: `apps/deploy-web/src/components/new-deployment/ConfigureProviders/FilterActionBar.tsx`

- [ ] **Step 1: Write the component**

```typescript
// apps/deploy-web/src/components/new-deployment/ConfigureProviders/FilterActionBar.tsx
"use client";
import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";

type Props = {
  pendingChanges: number;
  matchCount: number | null;
  isLoading: boolean;
  onRevert: () => void;
  onApply: () => void;
};

export const FilterActionBar: FC<Props> = ({ pendingChanges, matchCount, isLoading, onRevert, onApply }) => {
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-border bg-background px-4 py-3">
      <span className="text-sm text-muted-foreground">
        {pendingChanges} pending change{pendingChanges !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-3">
        <Button variant="text" size="sm" onClick={onRevert} disabled={pendingChanges === 0}>
          Revert all
        </Button>
        <Button variant="default" size="sm" onClick={onApply} disabled={pendingChanges === 0 && !isLoading}>
          {isLoading ? "Applying..." : `Apply filter${matchCount != null ? ` · ${matchCount}` : ""}`}
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/deploy-web && npx tsc --noEmit --pretty 2>&1 | grep -i filteractionbar || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/deploy-web/src/components/new-deployment/ConfigureProviders/FilterActionBar.tsx
git commit -m "feat(deploy-web): add FilterActionBar component

Sticky bottom bar showing pending changes count, revert button,
and apply filter button with match count preview.

Part of CON-186"
```

---

### Task 7: QuoteModal component

**Files:**
- Create: `apps/deploy-web/src/components/new-deployment/ConfigureProviders/QuoteModal.tsx`

- [ ] **Step 1: Write the component**

```typescript
// apps/deploy-web/src/components/new-deployment/ConfigureProviders/QuoteModal.tsx
"use client";
import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { Button, Popup, Spinner } from "@akashnetwork/ui/components";

import type { MockQuote } from "@src/utils/mockQuoteGenerator";

type ProviderInfo = {
  name: string;
  location: string;
  auditor: string | null;
};

type Props = {
  open: boolean;
  provider: ProviderInfo | null;
  quote: MockQuote | null;
  isLoading: boolean;
  onClose: () => void;
  onAccept: () => void;
  isAccepting: boolean;
};

export const QuoteModal: FC<Props> = ({ open, provider, quote, isLoading, onClose, onAccept, isAccepting }) => {
  const [countdown, setCountdown] = useState(120);

  useEffect(() => {
    if (!open || !quote) {
      setCountdown(120);
      return;
    }
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [open, quote]);

  const formatPrice = useCallback((value: number) => value.toFixed(4), []);
  const formatUsd = useCallback((value: number) => `$${value.toFixed(2)}`, []);

  if (!provider) return null;

  return (
    <Popup
      open={open}
      variant="custom"
      title={`Quote from ${provider.name}`}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
      actions={[
        { label: "Cancel", side: "left" as const, variant: "text" as const, onClick: onClose },
        {
          label: isAccepting ? "Creating deployment..." : "Accept & create lease →",
          side: "right" as const,
          variant: "default" as const,
          onClick: onAccept,
          disabled: isLoading || isAccepting,
          isLoading: isAccepting,
          className: "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        }
      ]}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {provider.location}
          {provider.auditor && ` · Audited by ${provider.auditor}`}
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="medium" />
          </div>
        ) : quote ? (
          <>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4">
              <div>
                <span className="text-2xl font-bold">≈ {formatUsd(quote.monthlyCostUsd)}</span>
                <span className="ml-2 text-sm text-muted-foreground">/ mo</span>
              </div>
              <span className="text-sm text-muted-foreground">{formatPrice(quote.pricePerBlock)} ACT / block</span>
            </div>

            <div className="space-y-0">
              {Object.entries(quote.breakdown).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
                  <span className="capitalize text-muted-foreground">{key === "persistentStorage" ? "Persistent Storage" : key}</span>
                  <span>{formatPrice(value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 text-sm font-semibold">
                <span>Total</span>
                <span className="text-destructive">{formatPrice(quote.pricePerBlock)} ACT/block</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Quote expires in {countdown}s · includes 7-day SLA uptime guarantee.
            </p>
          </>
        ) : null}
      </div>
    </Popup>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/deploy-web && npx tsc --noEmit --pretty 2>&1 | grep -i quotemodal || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/deploy-web/src/components/new-deployment/ConfigureProviders/QuoteModal.tsx
git commit -m "feat(deploy-web): add QuoteModal component for mocked Stage 2

Displays ACT/block pricing with USD monthly estimate, per-resource
cost breakdown, countdown timer, and accept/cancel actions.

Part of CON-186"
```

---

### Task 8: PlacementSection component

**Files:**
- Create: `apps/deploy-web/src/components/new-deployment/ConfigureProviders/PlacementSection.tsx`

- [ ] **Step 1: Write the component**

```typescript
// apps/deploy-web/src/components/new-deployment/ConfigureProviders/PlacementSection.tsx
"use client";
import type { FC } from "react";
import { Input, Slider } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { FormPaper } from "../../sdl/FormPaper";

type AuditorOption = {
  label: string;
  address: string;
};

type RegionOption = {
  label: string;
  key: string;
};

export const AUDITOR_OPTIONS: AuditorOption[] = [
  { label: "Akash Network", address: "akash1365ez9ux3wm6cvahl5asp47f3ncqtqsagcsru2" },
  { label: "Overclock Labs", address: "akash10cl5rm0cqnpj45knzakpa4cnvn5amzwp4lhcal" }
];

export const REGION_OPTIONS: RegionOption[] = [
  { label: "N. America", key: "north-america" },
  { label: "Europe", key: "europe" },
  { label: "APAC", key: "apac" }
];

type Props = {
  filters: PlacementFilters;
  onChange: (filters: PlacementFilters) => void;
};

const ChipButton: FC<{ selected: boolean; onClick: () => void; children: React.ReactNode }> = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"
    )}
  >
    {children}
  </button>
);

export const PlacementSection: FC<Props> = ({ filters, onChange }) => {
  const handleMaxPriceChange = (values: number[]) => {
    onChange({ ...filters, maxPrice: values[0] });
  };

  const handleMaxPriceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0.01 && value <= 2.0) {
      onChange({ ...filters, maxPrice: value });
    }
  };

  const toggleAuditor = (address: string) => {
    const current = filters.auditedBy;
    const next = current.includes(address) ? current.filter(a => a !== address) : [...current, address];
    onChange({ ...filters, auditedBy: next });
  };

  const toggleRegion = (key: string) => {
    const current = filters.regions;
    const next = current.includes(key) ? current.filter(r => r !== key) : [...current, key];
    onChange({ ...filters, regions: next });
  };

  return (
    <FormPaper>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <strong className="text-sm">Placement</strong>
          {(filters.maxPrice || filters.auditedBy.length > 0 || filters.regions.length > 0) && (
            <span className="h-2 w-2 rounded-full bg-destructive" />
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs text-muted-foreground">Max price</label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={filters.maxPrice ?? ""}
              onChange={handleMaxPriceInput}
              placeholder="0.1"
              className="w-20"
              min={0.01}
              max={2.0}
              step={0.01}
            />
            <span className="text-xs text-muted-foreground">ACT / block</span>
          </div>
          <Slider
            value={[filters.maxPrice ?? 0.1]}
            onValueChange={handleMaxPriceChange}
            min={0.01}
            max={2.0}
            step={0.01}
            className="mt-2"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>0.01</span>
            <span>0.5</span>
            <span>1.0</span>
            <span>2.0</span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs text-muted-foreground">Audited by</label>
          <div className="flex flex-wrap gap-2">
            <ChipButton selected={filters.auditedBy.length === 0} onClick={() => onChange({ ...filters, auditedBy: [] })}>
              Any
            </ChipButton>
            {AUDITOR_OPTIONS.map(opt => (
              <ChipButton key={opt.address} selected={filters.auditedBy.includes(opt.address)} onClick={() => toggleAuditor(opt.address)}>
                {opt.label}
              </ChipButton>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs text-muted-foreground">Regions</label>
          <div className="flex flex-wrap gap-2">
            <ChipButton selected={filters.regions.length === 0} onClick={() => onChange({ ...filters, regions: [] })}>
              Any
            </ChipButton>
            {REGION_OPTIONS.map(opt => (
              <ChipButton key={opt.key} selected={filters.regions.includes(opt.key)} onClick={() => toggleRegion(opt.key)}>
                {opt.label}
              </ChipButton>
            ))}
          </div>
        </div>
      </div>
    </FormPaper>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/deploy-web && npx tsc --noEmit --pretty 2>&1 | grep -i placementsection || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/deploy-web/src/components/new-deployment/ConfigureProviders/PlacementSection.tsx
git commit -m "feat(deploy-web): add PlacementSection component

Max price slider (ACT/block), audited-by chip group, and region
chip group. Uses PlacementFilters type for state management.

Part of CON-186"
```

---

### Task 9: WorkloadConfigPanel component

**Files:**
- Create: `apps/deploy-web/src/components/new-deployment/ConfigureProviders/WorkloadConfigPanel.tsx`

Wraps the existing SDL form controls in the left panel layout.

- [ ] **Step 1: Write the component**

```typescript
// apps/deploy-web/src/components/new-deployment/ConfigureProviders/WorkloadConfigPanel.tsx
"use client";
import type { FC } from "react";
import type { Control, UseFormSetValue } from "react-hook-form";
import { FormField, FormItem, Input } from "@akashnetwork/ui/components";

import type { GpuVendor } from "@src/types/gpu";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { CpuFormControl } from "../../sdl/CpuFormControl";
import { EphemeralStorageFormControl } from "../../sdl/EphemeralStorageFormControl";
import { GpuFormControl } from "../../sdl/GpuFormControl";
import { MemoryFormControl } from "../../sdl/MemoryFormControl";
import { FormPaper } from "../../sdl/FormPaper";
import { PlacementSection } from "./PlacementSection";

type Props = {
  control: Control<SdlBuilderFormValuesType>;
  currentService: ServiceType;
  services: ServiceType[];
  serviceIndex: number;
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
  gpuModels: GpuVendor[] | undefined;
  placementFilters: PlacementFilters;
  onPlacementChange: (filters: PlacementFilters) => void;
};

export const WorkloadConfigPanel: FC<Props> = ({
  control,
  currentService,
  services,
  serviceIndex,
  setValue,
  gpuModels,
  placementFilters,
  onPlacementChange
}) => {
  return (
    <div className="flex flex-col gap-0 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
      <div className="border-b border-border px-1 pb-2">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workload config</h3>
        <p className="text-xs text-muted-foreground">
          Tweak your workload — the provider list filters live. Undo any change, or view the raw config.
        </p>
      </div>

      <CpuFormControl control={control} serviceIndex={serviceIndex} currentService={currentService} />

      <GpuFormControl
        control={control}
        serviceIndex={serviceIndex}
        hasGpu={currentService.profile.hasGpu ?? false}
        currentService={currentService}
        gpuModels={gpuModels}
        setValue={setValue}
      />

      <MemoryFormControl control={control} serviceIndex={serviceIndex} />

      <EphemeralStorageFormControl control={control} services={services} serviceIndex={serviceIndex} />

      <PlacementSection filters={placementFilters} onChange={onPlacementChange} />

      <FormPaper>
        <div className="space-y-2">
          <strong className="text-sm">Service Count</strong>
          <p className="text-xs text-muted-foreground">Number of replicas for this service</p>
          <FormField
            control={control}
            name={`services.${serviceIndex}.count`}
            render={({ field }) => (
              <FormItem>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={field.value}
                  onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
              </FormItem>
            )}
          />
        </div>
      </FormPaper>
    </div>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/deploy-web && npx tsc --noEmit --pretty 2>&1 | grep -i workloadconfigpanel || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/deploy-web/src/components/new-deployment/ConfigureProviders/WorkloadConfigPanel.tsx
git commit -m "feat(deploy-web): add WorkloadConfigPanel for left-side SDL controls

Wraps existing CpuFormControl, GpuFormControl, MemoryFormControl,
EphemeralStorageFormControl and PlacementSection in a scrollable
left panel layout.

Part of CON-186"
```

---

### Task 10: ProviderTable component

**Files:**
- Create: `apps/deploy-web/src/components/new-deployment/ConfigureProviders/ProviderTable.tsx`

- [ ] **Step 1: Write the component**

```typescript
// apps/deploy-web/src/components/new-deployment/ConfigureProviders/ProviderTable.tsx
"use client";
import type { FC } from "react";
import { useMemo, useState } from "react";
import { Badge, Button, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown, NavArrowUp, Star, StarSolid } from "iconoir-react";

import type { ApiProviderList } from "@src/types/provider";
import type { BidScreeningProvider } from "@src/hooks/useBidScreening";

export type EnrichedProvider = BidScreeningProvider & {
  name: string | null;
  location: string;
  countryCode: string;
  uptime7d: number;
  isAudited: boolean;
  gpuModels: { vendor: string; model: string }[];
  isFavorite: boolean;
  stats?: ApiProviderList["stats"];
};

type SortField = "leaseCount" | "uptime7d" | "availableCpu" | "availableGpu" | "availableMemory";
type SortDirection = "asc" | "desc";

type Props = {
  providers: EnrichedProvider[];
  isLoading: boolean;
  total: number;
  onGetQuote: (provider: EnrichedProvider) => void;
  onToggleFavorite: (owner: string) => void;
};

const PAGE_SIZES = [10, 25, 50];

function formatBytes(bytes: number): string {
  if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(0)}TB`;
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(0)}GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)}MB`;
  return `${bytes}B`;
}

function formatCpu(millicpu: number): string {
  return (millicpu / 1000).toFixed(0);
}

export const ProviderTable: FC<Props> = ({ providers, isLoading, total, onGetQuote, onToggleFavorite }) => {
  const [sortField, setSortField] = useState<SortField>("leaseCount");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const sorted = useMemo(() => {
    return [...providers].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [providers, sortField, sortDir]);

  const paged = useMemo(() => sorted.slice(page * pageSize, (page + 1) * pageSize), [sorted, page, pageSize]);
  const pageCount = Math.ceil(sorted.length / pageSize);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon: FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === "desc" ? <NavArrowDown className="ml-1 inline h-3 w-3" /> : <NavArrowUp className="ml-1 inline h-3 w-3" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="medium" />
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("uptime7d")}>
              Uptime (7d)
              <SortIcon field="uptime7d" />
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("leaseCount")}>
              Active Leases
              <SortIcon field="leaseCount" />
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("availableCpu")}>
              CPU
              <SortIcon field="availableCpu" />
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("availableGpu")}>
              GPU
              <SortIcon field="availableGpu" />
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("availableMemory")}>
              Memory
              <SortIcon field="availableMemory" />
            </TableHead>
            <TableHead>Audited</TableHead>
            <TableHead className="w-8" />
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map(provider => (
            <TableRow key={provider.owner}>
              <TableCell className="max-w-[160px] truncate font-medium">{provider.name ?? provider.hostUri.replace("https://", "")}</TableCell>
              <TableCell>{provider.location}</TableCell>
              <TableCell>
                <span className={cn(provider.uptime7d >= 95 ? "text-green-500" : "text-yellow-500")}>{provider.uptime7d.toFixed(2)}%</span>
              </TableCell>
              <TableCell>{provider.leaseCount}</TableCell>
              <TableCell>
                {provider.stats ? `${formatCpu(provider.stats.cpu.active)} / ${formatCpu(provider.stats.cpu.active + provider.stats.cpu.available)}` : formatCpu(provider.availableCpu)}
              </TableCell>
              <TableCell>
                <span>{provider.availableGpu}</span>
                {provider.gpuModels.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {provider.gpuModels[0].model}
                  </Badge>
                )}
              </TableCell>
              <TableCell>{formatBytes(provider.availableMemory)}</TableCell>
              <TableCell>
                {provider.isAudited && (
                  <span className="text-green-500">Yes ✓</span>
                )}
              </TableCell>
              <TableCell>
                <button type="button" onClick={() => onToggleFavorite(provider.owner)} className="text-muted-foreground hover:text-foreground">
                  {provider.isFavorite ? <StarSolid className="h-4 w-4 text-yellow-500" /> : <Star className="h-4 w-4" />}
                </button>
              </TableCell>
              <TableCell>
                <Button variant="outline" size="xs" onClick={() => onGetQuote(provider)}>
                  Get a quote →
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {paged.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                No providers match your current filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Rows per page
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          >
            {PAGE_SIZES.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Page {page + 1} of {Math.max(pageCount, 1)}
          </span>
          <Button variant="outline" size="xs" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
            Previous
          </Button>
          <Button variant="outline" size="xs" onClick={() => setPage(p => p + 1)} disabled={page >= pageCount - 1}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/deploy-web && npx tsc --noEmit --pretty 2>&1 | grep -i providertable || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/deploy-web/src/components/new-deployment/ConfigureProviders/ProviderTable.tsx
git commit -m "feat(deploy-web): add ProviderTable with sorting and pagination

Sortable data table showing provider name, location, uptime,
leases, CPU, GPU, memory, audit status, favorites, and
'Get a quote' action button. Client-side sort and pagination.

Part of CON-186"
```

---

### Task 11: ProviderListPanel component

**Files:**
- Create: `apps/deploy-web/src/components/new-deployment/ConfigureProviders/ProviderListPanel.tsx`

Wraps the ProviderTable with a toolbar (search, toggle filters, match count).

- [ ] **Step 1: Write the component**

```typescript
// apps/deploy-web/src/components/new-deployment/ConfigureProviders/ProviderListPanel.tsx
"use client";
import type { FC } from "react";
import { useMemo, useState } from "react";
import { Badge, CheckboxWithLabel, Input } from "@akashnetwork/ui/components";
import { Search } from "iconoir-react";

import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import type { EnrichedProvider } from "./ProviderTable";
import { ProviderTable } from "./ProviderTable";
import { REGION_OPTIONS } from "./PlacementSection";

const REGION_COUNTRY_MAP: Record<string, string[]> = {
  "north-america": ["US", "CA", "MX"],
  europe: ["DE", "FR", "GB", "NL", "IE", "SE", "NO", "FI", "DK", "CH", "AT", "BE", "PL", "CZ", "PT", "ES", "IT"],
  apac: ["JP", "SG", "AU", "HK", "KR", "IN", "TW", "NZ"]
};

type Props = {
  providers: EnrichedProvider[];
  total: number;
  isLoading: boolean;
  placementFilters: PlacementFilters;
  onGetQuote: (provider: EnrichedProvider) => void;
  onToggleFavorite: (owner: string) => void;
};

export const ProviderListPanel: FC<Props> = ({ providers, total, isLoading, placementFilters, onGetQuote, onToggleFavorite }) => {
  const [search, setSearch] = useState("");
  const [showActive, setShowActive] = useState(true);
  const [showAudited, setShowAudited] = useState(true);
  const [showFavorites, setShowFavorites] = useState(false);

  const filtered = useMemo(() => {
    let result = providers;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        p => (p.name ?? "").toLowerCase().includes(q) || p.hostUri.toLowerCase().includes(q) || p.location.toLowerCase().includes(q)
      );
    }

    if (showAudited) {
      result = result.filter(p => p.isAudited);
    }

    if (showFavorites) {
      result = result.filter(p => p.isFavorite);
    }

    if (placementFilters.regions.length > 0) {
      const allowedCountries = placementFilters.regions.flatMap(r => REGION_COUNTRY_MAP[r] ?? []);
      result = result.filter(p => allowedCountries.includes(p.countryCode));
    }

    return result;
  }, [providers, search, showActive, showAudited, showFavorites, placementFilters.regions]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search providers by name, host, region..."
          startIcon={<Search className="h-4 w-4" />}
          className="max-w-xs"
        />
        <CheckboxWithLabel label="Active" checked={showActive} onCheckedChange={v => setShowActive(v as boolean)} />
        <CheckboxWithLabel label="Audited" checked={showAudited} onCheckedChange={v => setShowAudited(v as boolean)} />
        <CheckboxWithLabel label="Favorites" checked={showFavorites} onCheckedChange={v => setShowFavorites(v as boolean)} />

        <div className="ml-auto">
          <Badge variant="outline" className="text-sm font-semibold">
            {filtered.length} of {total} providers match
          </Badge>
        </div>
      </div>

      <ProviderTable
        providers={filtered}
        isLoading={isLoading}
        total={total}
        onGetQuote={onGetQuote}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/deploy-web && npx tsc --noEmit --pretty 2>&1 | grep -i providerlistpanel || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/deploy-web/src/components/new-deployment/ConfigureProviders/ProviderListPanel.tsx
git commit -m "feat(deploy-web): add ProviderListPanel with search and toolbar

Wraps ProviderTable with search input, Active/Audited/Favorites
toggles, region filtering, and match count badge.

Part of CON-186"
```

---

### Task 12: ConfigureProvidersHeader component

**Files:**
- Create: `apps/deploy-web/src/components/new-deployment/ConfigureProviders/ConfigureProvidersHeader.tsx`

- [ ] **Step 1: Write the component**

```typescript
// apps/deploy-web/src/components/new-deployment/ConfigureProviders/ConfigureProvidersHeader.tsx
"use client";
import type { FC } from "react";
import { Badge, Button, Input } from "@akashnetwork/ui/components";
import { Redo, Undo } from "iconoir-react";

type Props = {
  deploymentName: string;
  onDeploymentNameChange: (name: string) => void;
  templateDescription: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export const ConfigureProvidersHeader: FC<Props> = ({
  deploymentName,
  onDeploymentNameChange,
  templateDescription,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}) => {
  return (
    <div className="flex items-center gap-4 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Deployment name</label>
        <Input
          value={deploymentName}
          onChange={e => onDeploymentNameChange(e.target.value)}
          className="h-8 w-48"
          placeholder="hello-world"
        />
      </div>

      {templateDescription && (
        <Badge variant="outline" className="text-xs">
          Template · {templateDescription}
        </Badge>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/deploy-web/src/components/new-deployment/ConfigureProviders/ConfigureProvidersHeader.tsx
git commit -m "feat(deploy-web): add ConfigureProvidersHeader component

Top bar with deployment name input, template badge, and undo/redo
arrow buttons.

Part of CON-186"
```

---

### Task 13: ConfigureProviders main orchestrator

**Files:**
- Create: `apps/deploy-web/src/components/new-deployment/ConfigureProviders/ConfigureProviders.tsx`

This is the main component that ties everything together: form provider, split layout, bid-screening query, filter history, quote modal, and deployment creation.

- [ ] **Step 1: Write the component**

```typescript
// apps/deploy-web/src/components/new-deployment/ConfigureProviders/ConfigureProviders.tsx
"use client";
import type { Dispatch, FC, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Spinner } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";
import { useRouter } from "next/navigation";

import { useSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCertificate } from "@src/hooks/useCertificate/useCertificate";
import type { BidScreeningProvider } from "@src/hooks/useBidScreening";
import { useBidScreening } from "@src/hooks/useBidScreening";
import { useFilterHistory } from "@src/hooks/useFilterHistory";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { TemplateCreation } from "@src/types";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import type { DepositParams } from "@src/types/deployment";
import { RouteStep } from "@src/types/route-steps.type";
import { createAndValidateSdl, getDefaultService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { deploymentData } from "@src/utils/deploymentData";
import { appendAuditorRequirement, replaceSdlDenom } from "@src/utils/deploymentData/v1beta3";
import { validateDeploymentData } from "@src/utils/deploymentUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { sdlFormToBidScreeningRequest } from "@src/utils/sdlFormToBidScreeningRequest";
import type { MockQuote } from "@src/utils/mockQuoteGenerator";
import { generateMockQuote } from "@src/utils/mockQuoteGenerator";
import type { EnrichedProvider } from "./ProviderTable";
import { ConfigureProvidersHeader } from "./ConfigureProvidersHeader";
import { WorkloadConfigPanel } from "./WorkloadConfigPanel";
import { ProviderListPanel } from "./ProviderListPanel";
import { FilterActionBar } from "./FilterActionBar";
import { FilterSnackbar } from "./FilterSnackbar";
import { QuoteModal } from "./QuoteModal";
import { useGpuModels } from "@src/queries/useGpuQuery";

const FAVORITE_PROVIDERS_KEY = "akash_favorite_providers";

function getFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITE_PROVIDERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function toggleFavoriteStorage(owner: string): string[] {
  const current = getFavorites();
  const next = current.includes(owner) ? current.filter(o => o !== owner) : [...current, owner];
  localStorage.setItem(FAVORITE_PROVIDERS_KEY, JSON.stringify(next));
  return next;
}

type Props = {
  selectedTemplate: TemplateCreation | null;
  onTemplateSelected: Dispatch<TemplateCreation | null>;
  editedManifest: string | null;
  setEditedManifest: Dispatch<SetStateAction<string>>;
};

export const ConfigureProviders: FC<Props> = ({ selectedTemplate, editedManifest, setEditedManifest }) => {
  const router = useRouter();
  const { hasComponent } = useSdlBuilder();
  const { analyticsService, chainApiHttpClient, deploymentLocalStorage } = useServices();
  const { address, signAndBroadcastTx, isManaged } = useWallet();
  const wallet = useWallet();
  const { genNewCertificateIfLocalIsInvalid, updateSelectedCertificate } = useCertificate();
  const { data: gpuModels } = useGpuModels();
  const { data: allProviders } = useProviderList();
  const { enqueueSnackbar } = useSnackbar();

  const [deploymentName, setDeploymentName] = useState(selectedTemplate?.name ?? "hello-world");
  const [isCreatingDeployment, setIsCreatingDeployment] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());

  const [placementFilters, setPlacementFilters] = useState<PlacementFilters>({
    maxPrice: 0.1,
    auditedBy: [],
    regions: []
  });

  // Quote modal state
  const [quoteProvider, setQuoteProvider] = useState<EnrichedProvider | null>(null);
  const [quoteData, setQuoteData] = useState<MockQuote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{ message: string; action: "undo" | "redo" | null; visible: boolean }>({
    message: "",
    action: null,
    visible: false
  });

  // Form setup — reuses existing SdlBuilder form schema
  const form = useForm<SdlBuilderFormValuesType>({
    defaultValues: {
      services: [getDefaultService({ supportsSSH: hasComponent("ssh") })],
      imageList: [],
      hasSSHKey: hasComponent("ssh")
    },
    resolver: zodResolver(SdlBuilderFormValuesSchema)
  });
  const { control, watch, setValue, getValues } = form;
  const formServices = watch("services");
  const currentService = formServices[0];

  // Hydrate form from template
  useEffect(() => {
    if (editedManifest) {
      try {
        const services = createAndValidateSdl(editedManifest);
        setValue("services", services as ServiceType[]);
      } catch {
        // Template parsing failed — keep defaults
      }
    }
  }, [editedManifest, setValue]);

  // Keep SDL in sync
  useEffect(() => {
    const { unsubscribe } = watch(data => {
      try {
        const sdl = generateSdl(data.services as ServiceType[]);
        setEditedManifest(sdl);
      } catch {
        // Ignore generation errors during editing
      }
    });
    return unsubscribe;
  }, [watch, setEditedManifest]);

  // Build bid-screening request from current applied snapshot
  const [appliedRequest, setAppliedRequest] = useState<ReturnType<typeof sdlFormToBidScreeningRequest> | null>(null);

  // Initial bid-screening call
  useEffect(() => {
    const values = getValues();
    const request = sdlFormToBidScreeningRequest(values, placementFilters);
    setAppliedRequest(request);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: bidScreeningData, isFetching: isBidScreeningLoading } = useBidScreening(appliedRequest);

  // Filter history — initialize once we have first results
  const filterHistory = useFilterHistory(getValues(), placementFilters, bidScreeningData?.total ?? 0);

  // Enrich bid-screening providers with metadata from the full provider list
  const enrichedProviders: EnrichedProvider[] = useMemo(() => {
    if (!bidScreeningData?.providers || !allProviders) return [];
    const providerMap = new Map(allProviders.map(p => [p.owner, p]));

    return bidScreeningData.providers.map(bp => {
      const full = providerMap.get(bp.owner);
      return {
        ...bp,
        name: full?.name ?? null,
        location: full ? `${full.ipRegion || full.ipCountryCode}` : "",
        countryCode: full?.ipCountryCode ?? "",
        uptime7d: full?.uptime7d ?? 0,
        isAudited: full?.isAudited ?? false,
        gpuModels: full?.gpuModels?.map(g => ({ vendor: g.vendor, model: g.model })) ?? [],
        isFavorite: favorites.includes(bp.owner),
        stats: full?.stats
      };
    });
  }, [bidScreeningData, allProviders, favorites]);

  // Template description for header
  const templateDescription = useMemo(() => {
    if (!currentService) return "";
    const parts: string[] = [];
    parts.push(`${currentService.profile.cpu} vCPU`);
    parts.push(`${currentService.profile.ram}${currentService.profile.ramUnit}`);
    if (currentService.profile.hasGpu && currentService.profile.gpu) {
      parts.push(`${currentService.profile.gpu}× GPU`);
    }
    return parts.join(" · ");
  }, [currentService]);

  // Pending changes count
  const pendingChanges = filterHistory.pendingChanges(getValues(), placementFilters);

  const handleApply = useCallback(() => {
    const values = getValues();
    const request = sdlFormToBidScreeningRequest(values, placementFilters);
    setAppliedRequest(request);
    // We'll update the filter history once the query resolves
    filterHistory.apply(values, placementFilters, bidScreeningData?.total ?? 0);
    setSnackbar({
      message: `Filter applied. ${bidScreeningData?.total ?? 0} providers match.`,
      action: "undo",
      visible: true
    });
  }, [getValues, placementFilters, filterHistory, bidScreeningData]);

  const handleUndo = useCallback(() => {
    filterHistory.undo();
    const snapshot = filterHistory.snapshots[filterHistory.currentIndex - 1];
    if (snapshot) {
      setValue("services", snapshot.formValues.services);
      setPlacementFilters(snapshot.placementFilters);
      setAppliedRequest(sdlFormToBidScreeningRequest(snapshot.formValues, snapshot.placementFilters));
      setSnackbar({ message: "Filter reverted.", action: "redo", visible: true });
    }
  }, [filterHistory, setValue]);

  const handleRedo = useCallback(() => {
    filterHistory.redo();
    const snapshot = filterHistory.snapshots[filterHistory.currentIndex + 1];
    if (snapshot) {
      setValue("services", snapshot.formValues.services);
      setPlacementFilters(snapshot.placementFilters);
      setAppliedRequest(sdlFormToBidScreeningRequest(snapshot.formValues, snapshot.placementFilters));
      setSnackbar({ message: `Filter re-applied. ${snapshot.resultCount} providers match.`, action: "undo", visible: true });
    }
  }, [filterHistory, setValue]);

  const handleRevert = useCallback(() => {
    const snapshot = filterHistory.currentSnapshot;
    if (snapshot) {
      setValue("services", snapshot.formValues.services);
      setPlacementFilters(snapshot.placementFilters);
    }
  }, [filterHistory, setValue]);

  const handleToggleFavorite = useCallback((owner: string) => {
    setFavorites(toggleFavoriteStorage(owner));
  }, []);

  const handleGetQuote = useCallback(
    (provider: EnrichedProvider) => {
      setQuoteProvider(provider);
      setQuoteData(null);
      setIsQuoteLoading(true);
      // Simulate Stage 2 API call
      setTimeout(() => {
        const values = getValues();
        const request = sdlFormToBidScreeningRequest(values, placementFilters);
        const quote = generateMockQuote(request.data.resources, 0.35);
        setQuoteData(quote);
        setIsQuoteLoading(false);
      }, 500);
    },
    [getValues, placementFilters]
  );

  const handleAcceptQuote = useCallback(async () => {
    if (!editedManifest) return;

    try {
      setIsCreatingDeployment(true);
      let sdl = editedManifest;

      if (wallet.isManaged) {
        sdl = appendAuditorRequirement(sdl);
        if (wallet.denom !== "uakt") {
          sdl = replaceSdlDenom(sdl, wallet.denom);
        }
      }

      const [dd, newCert] = await Promise.all([
        deploymentData.NewDeploymentData(chainApiHttpClient, sdl, null, address, wallet.isManaged ? undefined : undefined),
        genNewCertificateIfLocalIsInvalid()
      ]);

      if (!dd) return;

      const messages: EncodeObject[] = [];
      if (newCert) {
        messages.push(TransactionMessageData.getCreateCertificateMsg(address, newCert.cert, newCert.publicKey));
      }
      messages.push(TransactionMessageData.getCreateDeploymentMsg(dd));

      const response = await signAndBroadcastTx(messages);

      if (response) {
        if (newCert) await updateSelectedCertificate(newCert);

        deploymentLocalStorage.update(address, dd.deploymentId.dseq, {
          manifest: sdl,
          manifestVersion: dd.hash,
          name: deploymentName
        });

        router.replace(UrlService.newDeployment({ step: RouteStep.createLeases, dseq: dd.deploymentId.dseq }));

        analyticsService.track("create_deployment", {
          category: "deployments",
          label: "Create deployment from bid precheck"
        });
      }
    } finally {
      setIsCreatingDeployment(false);
      setQuoteProvider(null);
    }
  }, [editedManifest, wallet, chainApiHttpClient, address, signAndBroadcastTx, genNewCertificateIfLocalIsInvalid, updateSelectedCertificate, deploymentLocalStorage, deploymentName, router, analyticsService]);

  if (!currentService) return <Spinner size="medium" />;

  return (
    <div className="flex h-full flex-col">
      <ConfigureProvidersHeader
        deploymentName={deploymentName}
        onDeploymentNameChange={setDeploymentName}
        templateDescription={templateDescription}
        canUndo={filterHistory.canUndo}
        canRedo={filterHistory.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "380px 1fr" }}>
        <div className="overflow-y-auto border-r border-border">
          <WorkloadConfigPanel
            control={control}
            currentService={currentService}
            services={formServices as ServiceType[]}
            serviceIndex={0}
            setValue={setValue}
            gpuModels={gpuModels}
            placementFilters={placementFilters}
            onPlacementChange={setPlacementFilters}
          />
        </div>

        <div className="overflow-y-auto">
          <ProviderListPanel
            providers={enrichedProviders}
            total={bidScreeningData?.total ?? 0}
            isLoading={isBidScreeningLoading}
            placementFilters={placementFilters}
            onGetQuote={handleGetQuote}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
      </div>

      <FilterActionBar
        pendingChanges={pendingChanges}
        matchCount={bidScreeningData?.total ?? null}
        isLoading={isBidScreeningLoading}
        onRevert={handleRevert}
        onApply={handleApply}
      />

      <FilterSnackbar
        message={snackbar.message}
        visible={snackbar.visible}
        action={snackbar.action}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDismiss={() => setSnackbar(prev => ({ ...prev, visible: false }))}
      />

      <QuoteModal
        open={!!quoteProvider}
        provider={
          quoteProvider
            ? {
                name: quoteProvider.name ?? quoteProvider.hostUri.replace("https://", ""),
                location: quoteProvider.location,
                auditor: quoteProvider.isAudited ? "Akash Network" : null
              }
            : null
        }
        quote={quoteData}
        isLoading={isQuoteLoading}
        onClose={() => setQuoteProvider(null)}
        onAccept={handleAcceptQuote}
        isAccepting={isCreatingDeployment}
      />
    </div>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/deploy-web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors or only pre-existing errors unrelated to ConfigureProviders

- [ ] **Step 3: Commit**

```bash
git add apps/deploy-web/src/components/new-deployment/ConfigureProviders/ConfigureProviders.tsx
git commit -m "feat(deploy-web): add ConfigureProviders main orchestrator

Split-panel layout with SDL form controls (left) and bid-screening
provider table (right). Integrates filter history (undo/redo),
snackbar notifications, mock quote modal, and deployment creation
on-chain flow.

Part of CON-186"
```

---

### Task 14: Wire ConfigureProviders into NewDeploymentContainer

**Files:**
- Modify: `apps/deploy-web/src/components/new-deployment/NewDeploymentContainer/NewDeploymentContainer.tsx`

- [ ] **Step 1: Add import and DEPENDENCIES entry**

In `NewDeploymentContainer.tsx`, add the import at the top (alongside the existing `ManifestEdit` import on line 22):

```typescript
import { ConfigureProviders } from "../ConfigureProviders/ConfigureProviders";
```

Add to the `DEPENDENCIES` object (line 33-46):

```typescript
export const DEPENDENCIES = {
  Layout,
  TemplateList,
  ManifestEdit,
  ConfigureProviders,
  CreateLease,
  Editor,
  CustomizedSteppers,
  useRouter,
  useSearchParams,
  useSdlBuilder,
  useLocalNotes,
  useTemplates,
  useServices
};
```

- [ ] **Step 2: Replace ManifestEdit rendering with ConfigureProviders**

Replace the block at lines 180-188:

```typescript
// BEFORE:
{activeStepName === RouteStep.editDeployment && (
  <d.ManifestEdit
    selectedTemplate={selectedTemplate}
    onTemplateSelected={setSelectedTemplate}
    editedManifest={editedManifest}
    setEditedManifest={setEditedManifest}
    isGitProviderTemplate={isGitProviderTemplate}
  />
)}

// AFTER:
{activeStepName === RouteStep.editDeployment && (
  <d.ConfigureProviders
    selectedTemplate={selectedTemplate}
    onTemplateSelected={setSelectedTemplate}
    editedManifest={editedManifest}
    setEditedManifest={setEditedManifest}
  />
)}
```

- [ ] **Step 3: Verify types compile**

Run: `cd apps/deploy-web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/deploy-web/src/components/new-deployment/NewDeploymentContainer/NewDeploymentContainer.tsx
git commit -m "feat(deploy-web): wire ConfigureProviders into step 2

Replaces ManifestEdit with ConfigureProviders in the deployment
wizard's editDeployment step. Template data and manifest state
flow through the same props interface.

Part of CON-186"
```

---

### Task 15: Manual verification

- [ ] **Step 1: Run all unit tests**

Run: `cd apps/deploy-web && npm run test:unit -- --run`
Expected: All tests pass including new specs

- [ ] **Step 2: Run linting**

Run: `cd apps/deploy-web && npm run lint -- --quiet`
Expected: No errors

- [ ] **Step 3: Type check**

Run: `cd apps/deploy-web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Dev server smoke test**

Run: `cd apps/deploy-web && npm run dev`

Manual check:
1. Navigate to `/new-deployment`
2. Select a template (e.g., hello-world)
3. Verify the new split-panel UI loads with workload config (left) and provider table (right)
4. Adjust CPU slider → verify pending changes counter updates
5. Click "Apply filter" → verify snackbar appears and provider table updates
6. Click Undo → verify form reverts and snackbar shows "Filter reverted"
7. Click "Get a quote →" on a provider → verify quote modal shows pricing
8. Click "Accept & create lease →" → verify deployment creation flow navigates to step 3

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(deploy-web): address integration issues from manual testing

Part of CON-186"
```

---

## Verification Summary

| Check | Command | Expected |
|-------|---------|----------|
| Unit tests | `cd apps/deploy-web && npm run test:unit -- --run` | All pass |
| Lint | `cd apps/deploy-web && npm run lint -- --quiet` | No errors |
| Types | `cd apps/deploy-web && npx tsc --noEmit` | No errors |
| Dev server | Manual: template → configure → apply → quote → accept | Full flow works |
