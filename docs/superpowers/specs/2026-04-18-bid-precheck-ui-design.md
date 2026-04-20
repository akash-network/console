# Bid Precheck UI — Configure & Match Providers (POC)

**Issue:** CON-186
**Date:** 2026-04-18

## Context

The current deployment flow is: Choose Template → Edit SDL → Deploy on-chain → Wait for bids → Choose provider. This is slow and opaque — users don't know which providers can serve their workload until after they've committed an on-chain transaction.

This POC replaces step 2 (Edit Deployment) with a new "Configure & Match Providers" experience. The SDL builder controls on the left act as live filters — each applied change queries the Stage 1 `/v1/bid-screening` endpoint to show matching providers in a table on the right. Users can get a price quote from any provider (mocked Stage 2) and accept it to proceed to the existing lease creation flow.

This is the foundation for the full bid precheck deployment flow (Stage 2 integration, direct deploy, etc.).

## Flow

```
1. Choose template (unchanged)
2. Configure & match providers (NEW — replaces ManifestEdit)
   ├── Left panel: Workload config (reuses existing SDL form controls)
   ├── Right panel: Provider table (from bid-screening API)
   ├── "Apply filter" → snapshots state, queries API, shows snackbar
   ├── "Get a quote →" per provider → mocked Stage 2 → quote modal
   └── "Accept & create lease →" → creates deployment on-chain → step 3
3. Create leases (existing — unchanged)
```

## Component Architecture

### Component Tree

```
NewDeploymentContainer
  └── ConfigureProviders (replaces ManifestEdit when step === editDeployment)
        ├── ConfigureProvidersHeader
        │     ├── Deployment name input
        │     ├── Template badge ("Llama-3.1-8B · 1 vCPU · 8Gi · 1×A100 | Change")
        │     └── Undo/Redo arrow buttons
        ├── SplitPanel (CSS grid: left ~380px fixed, right flex-1)
        │     ├── WorkloadConfigPanel (left, vertical scroll, collapsible sections)
        │     │     ├── CpuFormControl
        │     │     ├── GpuFormControl
        │     │     ├── MemoryFormControl
        │     │     ├── EphemeralStorageFormControl
        │     │     ├── PersistentStorageSection (on/off toggle + controls)
        │     │     ├── PlacementSection
        │     │     │     ├── Max price slider + ACT/block input
        │     │     │     ├── Audited by chip group (Any | Akash Network | Overclock Labs)
        │     │     │     └── Region chip group (Any | N. America | Europe | APAC)
        │     │     └── ServiceCountSection (replica count)
        │     └── ProviderListPanel (right)
        │           ├── ProviderListToolbar
        │           │     ├── Search input (name, host, region)
        │           │     ├── Active / Audited / Favorites checkbox toggles
        │           │     └── Sort dropdown (Active Leases desc, default)
        │           ├── Match count badge ("36 of 184 providers match")
        │           ├── ProviderTable (sortable data table)
        │           │     └── Columns: Name, Location, Uptime(7d), Active Leases,
        │           │         CPU (used/total), GPU (used/total), Memory, Disk,
        │           │         Audited, Favorite, "Get a quote →"
        │           └── Pagination (rows per page selector + page nav)
        ├── FilterActionBar (sticky bottom bar)
        │     ├── "N pending changes" label
        │     ├── "Revert all" text button
        │     └── "Apply filter · M" primary button (M = match count)
        ├── FilterSnackbar (center bottom overlay, above action bar)
        │     ├── "Filter applied. X providers match." / "Filter reverted."
        │     ├── Undo / Redo button
        │     └── "Press Esc to exit" hint
        └── QuoteModal (Dialog)
              ├── Provider name + location + auditor badge
              ├── Price hero: X.XXX ACT/block ≈ $Y.YY/mo
              ├── Cost breakdown table (CPU, Memory, Ephemeral, GPU, Storage lines)
              ├── Total line (highlighted)
              ├── "Quote expires in Ns · includes 7-day SLA uptime guarantee."
              └── Actions: [Cancel] [Accept & create lease →]
```

### File Structure (new files)

```
apps/deploy-web/src/
  components/
    new-deployment/
      ConfigureProviders/
        ConfigureProviders.tsx          # Main component, form provider, split layout
        ConfigureProvidersHeader.tsx     # Deployment name + template badge + undo/redo
        WorkloadConfigPanel.tsx         # Left panel: collapsible sections wrapping existing form controls
        PlacementSection.tsx            # Max price, audited by, regions
        ProviderListPanel.tsx           # Right panel: toolbar + table + pagination
        ProviderTable.tsx               # Data table with sortable columns
        ProviderRow.tsx                 # Single provider row with "Get a quote" button
        FilterActionBar.tsx             # Sticky bottom: pending changes + apply
        FilterSnackbar.tsx              # Center bottom notification with undo/redo
        QuoteModal.tsx                  # Price quote dialog (mocked Stage 2)
  hooks/
    useBidScreening.ts                  # React Query hook for POST /v1/bid-screening
    useFilterHistory.ts                 # Undo/redo state management hook
  utils/
    sdlFormToBidScreeningRequest.ts     # Transform SDL form values → API request shape
    mockQuoteGenerator.ts               # Generate mock Stage 2 pricing data
```

## State Management

### Form State (react-hook-form)

Reuses the existing `SdlBuilderFormValuesType` schema and `SdlBuilderFormValuesSchema` Zod validation from `apps/deploy-web/src/types/sdlBuilder/sdlBuilder.ts`. The form is initialized from the selected template (same hydration path as the existing `SdlBuilder`).

### Filter History (useFilterHistory hook)

```typescript
type PlacementFilters = {
  maxPrice: number | null;       // ACT/block, null = no limit
  auditedBy: string[];           // auditor addresses, empty = any
  regions: string[];             // region keys, empty = any
};

type FilterSnapshot = {
  formValues: SdlBuilderFormValuesType;
  placementFilters: PlacementFilters;
  timestamp: number;
  resultCount: number;
};

type FilterHistory = {
  stack: FilterSnapshot[];
  current: number;  // index into stack
};

// Hook API
function useFilterHistory(initialValues: SdlBuilderFormValuesType, initialPlacement: PlacementFilters): {
  snapshots: FilterSnapshot[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  apply: (formValues: SdlBuilderFormValuesType, placement: PlacementFilters, resultCount: number) => void;
  undo: () => FilterSnapshot;
  redo: () => FilterSnapshot;
  pendingChanges: (currentValues: SdlBuilderFormValuesType, currentPlacement: PlacementFilters) => number;
};
```

**Rules:**
- Stack capped at 20 snapshots (oldest dropped when exceeded)
- Applying after an undo discards all redo entries (standard undo/redo behavior)
- `pendingChanges()` counts fields that differ from `stack[current].formValues`

### Placement Filters (PlacementFilters type, part of FilterSnapshot)

These are additional filters not in the SDL form schema, tracked as a separate `PlacementFilters` object alongside `formValues` in each `FilterSnapshot`:

- **Max price (ACT/block):** Client-side filter on provider table (not sent to API). Range: 0.01–2.0, step 0.01. `null` means no limit.
- **Audited by:** Maps to `requirements.signedBy.anyOf` with known auditor addresses. Empty array means "Any" (no auditor filter). The auditor address mapping is a constant: `{ "Akash Network": "akash1...", "Overclock Labs": "akash1..." }`.
- **Regions:** Client-side filter on provider location. Empty array means "Any". Region mapping: `{ "N. America": ["US", "CA", "MX"], "Europe": ["DE", "FR", "GB", "NL", "IE", ...], "APAC": ["JP", "SG", "AU", "HK", "KR", ...] }`.

### Provider Data (React Query)

```typescript
function useBidScreening(params: BidScreeningRequest | null) {
  return useQuery({
    queryKey: ["bid-screening", params],
    queryFn: () => fetch("POST /v1/bid-screening", params),
    enabled: !!params,
    staleTime: 30_000,  // 30s cache
  });
}
```

## Data Flow

### SDL Form → Bid Screening Request

`sdlFormToBidScreeningRequest(formValues, placementFilters)`:

| SDL Form Field | API Field | Transform |
|---|---|---|
| `services[i].profile.cpu` | `resources[i].cpu` | Parse vCPU string → millicpu int (e.g., "0.5" → 500) |
| `services[i].profile.ram` | `resources[i].memory` | Parse size string → bytes int |
| `services[i].profile.gpu` | `resources[i].gpu` | Parse int, default 0 |
| `services[i].profile.gpuModels[0]` | `resources[i].gpuAttributes` | `{ vendor, model, interface, memorySize }` |
| `services[i].profile.storage[0]` (ephemeral) | `resources[i].ephemeralStorage` | Parse size → bytes |
| `services[i].profile.persistentStorage` | `resources[i].persistentStorage` | Parse size → bytes (optional) |
| `services[i].profile.persistentStorageClass` | `resources[i].persistentStorageClass` | "beta1"/"beta2"/"beta3" |
| `services[i].count` | `resources[i].count` | int |
| Audited by chips → auditor addresses | `requirements.signedBy.anyOf` | Map display name → on-chain address |
| `services[i].placement.attributes` | `requirements.attributes` | `[{ key, value }]` |

**Multiple services:** Each service in the SDL becomes a separate `ResourceUnit` in the `resources` array.

### "Get a Quote" → Mock Stage 2

`mockQuoteGenerator(provider, requestedResources)`:

Generates deterministic mock pricing in ACT (the primary denom — AKT deployments no longer exist):
- CPU: `0.012 * (cpu_millicpu / 1000)` ACT/block
- Memory: `0.004 * (memory_bytes / 1073741824)` ACT/block (per GiB)
- Ephemeral: `0.0005 * (storage_bytes / 1073741824)` ACT/block (per GiB)
- GPU: `0.10 * gpu_count` ACT/block
- Monthly estimate: `price_per_block * 438000 * act_usd_price` (438k blocks/month avg)

Returns `{ pricePerBlock, monthlyCostUsd, breakdown: { cpu, memory, ephemeral, gpu?, persistentStorage? }, expiresIn: 120 }`.

**Display:** Always show the $ monthly amount prominently (≈ $X.XX / mo). The ACT/block amount is secondary/technical detail.

### "Accept & Create Lease" → Existing Flow

1. Generate final SDL YAML from current form values (using existing `generateSdl()`)
2. Create deployment on-chain (same as current ManifestEdit "Create Deployment" button)
3. On success, navigate to step 3 (`RouteStep.createLeases`) with `dseq` query param
4. Existing `CreateLease` component takes over for bid acceptance and manifest sending

## Undo/Redo System

### Lifecycle

1. **Mount:** Template hydrates form → auto-apply → first bid-screening call → snapshot 0
2. **User edits:** Form fields change → pending changes counter updates in real-time
3. **Apply:** User clicks "Apply filter" →
   - Push new snapshot to stack (truncate any redo entries)
   - Fire bid-screening query with new params
   - Show snackbar: "Filter applied. X providers match." + [Undo]
4. **Undo:** Click Undo button (snackbar or header) →
   - Decrement `current` index
   - Restore form values from `stack[current]`
   - Re-query bid-screening
   - Show snackbar: "Filter reverted." + [Redo]
5. **Redo:** Click Redo →
   - Increment `current`, restore, re-query
   - Show snackbar: "Filter re-applied. X providers match." + [Undo]
6. **Revert all:** Discard pending changes → reset form to `stack[current]` values
7. **Esc key:** Dismiss snackbar

### Snackbar Behavior

- Appears center-bottom, above the FilterActionBar
- Auto-dismisses after 5 seconds
- Only one snackbar visible at a time (new actions replace current)
- Esc key dismisses immediately

### Stack Limits

- Max 20 snapshots
- When exceeded, drop oldest snapshot(s), adjust `current` index accordingly

## Provider Table

### Columns

| Column | Source | Sortable | Notes |
|---|---|---|---|
| Name | `hostUri` (truncated) | Yes | Link-style, truncated with ellipsis |
| Location | Provider metadata | Yes | 3-letter code + country |
| Uptime (7d) | Provider status | Yes | Percentage, green when >95% |
| Active Leases | `leaseCount` | Yes (default desc) | Number, count in parentheses if multiple groups |
| CPU | `availableCpu` | Yes | "used / total" format |
| GPU | `availableGpu` | Yes | "used / total" + model badge if applicable |
| Memory | `availableMemory` | Yes | GB format |
| Disk | computed | Yes | Ephemeral + persistent |
| Audited | provider attributes | No | "Yes ✓" green badge or empty |
| Favorite | user preference | No | Star toggle (localStorage) |
| Action | — | No | "Get a quote →" button |

### Client-Side Filters (toolbar)

- **Search:** Filters on name, hostUri, location (case-insensitive substring match)
- **Active:** Only show providers where `isOnline === true` (default: on)
- **Audited:** Only show providers with auditor signatures (default: on in screenshots)
- **Favorites:** Only show favorited providers (default: off)

### Sorting

Default sort: Active Leases (desc). User can click column headers to change sort.

### Pagination

- Rows per page: 10 (default), 25, 50
- Standard page navigation (Previous / 1 2 3 / Next)

### Enrichment

The bid-screening API returns minimal provider data (`owner`, `hostUri`, `leaseCount`, available resources). Additional display data (location, uptime, auditor names, GPU models) comes from the existing provider list data already cached in React Query from the providers page. Join on `owner` address.

## Quote Modal

### Layout

```
┌─────────────────────────────────────────────┐
│ Quote from prov...valiant.cloud         [×] │
│ HKG · Audited by Akash Network              │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ ≈ $1.34 / mo        0.008 ACT / block  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ CPU · 0.5 vCPU                      0.0060  │
│ Memory · 512Mi                      0.0020  │
│ Ephemeral · 1Gi                     0.0005  │
│ ─────────────────────────────────────────── │
│ Total                      0.008 ACT/block  │
│                                             │
│ Quote expires in 120s · 7-day SLA uptime.   │
│                                             │
│              [Cancel]  [Accept & create →]   │
└─────────────────────────────────────────────┘
```

### Behavior

- Opens when user clicks "Get a quote →" on a provider row
- Shows loading spinner while "fetching" mock data (500ms delay for realism)
- Countdown timer ticks from 120s (visual only for POC)
- **Cancel:** Closes modal, returns to provider table
- **Accept & create lease →:** Triggers deployment creation on-chain → navigates to step 3

## Existing Components Reused

| Component | Package/Path | Usage |
|---|---|---|
| `CpuFormControl` | `components/sdl/CpuFormControl.tsx` | Left panel CPU section |
| `GpuFormControl` | `components/sdl/GpuFormControl.tsx` | Left panel GPU section |
| `MemoryFormControl` | `components/sdl/MemoryFormControl.tsx` | Left panel Memory section |
| `EphemeralStorageFormControl` | `components/sdl/EphemeralStorageFormControl.tsx` | Left panel Storage section |
| `SdlBuilderFormValuesSchema` | `types/sdlBuilder/sdlBuilder.ts` | Form validation |
| `generateSdl()` | `utils/sdl/sdlGenerator.ts` | Final SDL generation for deploy |
| `Popup` / `Dialog` | `@akashnetwork/ui/components` | Quote modal |
| `Slider` | `@akashnetwork/ui/components` | Max price slider |
| `Badge` | `@akashnetwork/ui/components` | Audit badges, GPU model badges |
| `Button` | `@akashnetwork/ui/components` | All buttons |
| `Input` | `@akashnetwork/ui/components` | Search, deployment name, price |
| `useToast` | `@akashnetwork/ui/components` | Error notifications |
| `Spinner` | `@akashnetwork/ui/components` | Loading states |
| `DataTable` patterns | `@akashnetwork/ui/components` | Provider table structure |
| `CustomizedSteppers` | `components/new-deployment/Stepper.tsx` | Step indicator (unchanged) |

## API Dependencies

| Endpoint | Status | Usage |
|---|---|---|
| `POST /v1/bid-screening` | Live (Stage 1) | Provider filtering |
| `GET /v1/providers` | Live | Provider metadata enrichment (location, uptime, auditors) |
| Stage 2 provider endpoint | Not yet implemented | Mocked for POC |

## Out of Scope (for this POC)

- Real Stage 2 bid screening (provider-side `/v1/bid-screening`)
- Direct deploy (skip step 3)
- Multi-service SDL visualization in the provider table
- Region data in the bid-screening API (client-side filter for now)
- Max price filtering in the API (client-side for now)
- Feature flag to toggle between old/new step 2
- Responsive/mobile layout
- E2E tests (unit tests only for new hooks and utilities)
