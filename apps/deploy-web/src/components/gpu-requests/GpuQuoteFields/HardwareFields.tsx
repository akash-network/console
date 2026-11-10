import { Input, QuantityStepper, RadioGroup, RadioGroupItem, Switch } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { SearchableSelect } from "@src/components/shared/SearchableSelect/SearchableSelect";
import {
  FABRICS,
  findCatalogGpu,
  GPU_CATALOG,
  MAX_GPU_COUNT,
  MAX_STORAGE_TB_PER_NODE,
  OTHER_GPU_MODEL,
  RECOMMENDED_STORAGE_TB_PER_NODE,
  STORAGE_SIZES_TB,
  UNIT_COUNTS
} from "../gpuQuoteDraft/gpuQuoteCatalog";
import type { GpuQuoteDraft, StartingPoint, StartingPointId } from "../gpuQuoteDraft/gpuQuoteDraft";
import {
  countUnits,
  CUSTOM_STARTING_POINT,
  describeGpuTotal,
  describeStartingPointCard,
  describeStorageTotal,
  pluralize,
  withGpuModel
} from "../gpuQuoteDraft/gpuQuoteDraft";
import { ChoiceChips, FieldGroup, OptionCards } from "./ChoiceControls";

export type DraftFieldProps = { draft: GpuQuoteDraft; onChange: (patch: Partial<GpuQuoteDraft>) => void };

const MAX_GPU_MODEL_LENGTH = 100;

const MAX_PACKAGES_PER_ROW = 3;

const ONE_ROW_PACKAGES_CLASSES = "grid-cols-1 gap-2.5 sm:grid-cols-3";

const TWO_COLUMN_PACKAGES_CLASSES = "grid-cols-1 gap-2.5 sm:grid-cols-2";

const PICKABLE_CARD_CLASSES =
  "cursor-pointer rounded-xl border bg-background shadow-sm transition-[border-color,box-shadow] hover:border-foreground/35 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-foreground";

/** Each package spans the five rows of its column's subgrid, so the same spec lines up across the cards beside it. */
const PACKAGE_CARD_CLASSES = cn(PICKABLE_CARD_CLASSES, "row-span-5 grid min-w-0 grid-rows-subgrid gap-y-0 overflow-hidden");

const CUSTOM_CARD_CLASSES = cn(PICKABLE_CARD_CLASSES, "col-span-full flex items-start gap-3 px-3.5 py-3");

const GPU_OPTIONS = [
  ...GPU_CATALOG.map(gpu => ({
    value: gpu.id,
    label: `${gpu.vendor} ${gpu.label}`,
    hint: gpu.rack ? `${gpu.memory} · ${gpu.rack.gpuCount} per rack` : gpu.memory,
    keywords: [gpu.vendor, gpu.label, gpu.group]
  })),
  { value: OTHER_GPU_MODEL, label: "Something else…", keywords: ["other", "not listed"] }
];

export function StartingPointField({
  startingPoints,
  value,
  onPick
}: {
  startingPoints: StartingPoint[];
  value: StartingPointId | null;
  onPick: (startingPoint: StartingPoint) => void;
}) {
  const packages = startingPoints.filter(startingPoint => startingPoint.id !== CUSTOM_STARTING_POINT.id);

  return (
    <RadioGroup
      aria-label="Starting point"
      value={value ?? ""}
      onValueChange={id => onPick(startingPoints.find(startingPoint => startingPoint.id === id)!)}
      className={packages.length > MAX_PACKAGES_PER_ROW ? TWO_COLUMN_PACKAGES_CLASSES : ONE_ROW_PACKAGES_CLASSES}
    >
      {packages.map(startingPoint => (
        <PackageCard key={startingPoint.id} startingPoint={startingPoint} />
      ))}
      <label className={CUSTOM_CARD_CLASSES}>
        <RadioGroupItem value={CUSTOM_STARTING_POINT.id} className="mt-0.5 shrink-0" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold">{CUSTOM_STARTING_POINT.name}</span>
          <span className="text-[13px] text-muted-foreground">{CUSTOM_STARTING_POINT.use}</span>
        </span>
      </label>
    </RadioGroup>
  );
}

function PackageCard({ startingPoint }: { startingPoint: StartingPoint }) {
  const { gpuCount, model, memory, specs } = describeStartingPointCard(startingPoint);

  return (
    <label className={PACKAGE_CARD_CLASSES}>
      <span className="flex min-w-0 items-start gap-2 px-3.5 pb-3 pt-[13px]">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold">{startingPoint.name}</span>
          <span className="text-[12.5px] leading-snug text-muted-foreground">{startingPoint.use}</span>
          {startingPoint.detail && <span className="font-mono text-xs text-muted-foreground">{startingPoint.detail}</span>}
        </span>
        <RadioGroupItem value={startingPoint.id} className="mt-0.5 shrink-0" />
      </span>
      <span className="flex min-w-0 flex-col gap-[3px] border-t px-3.5 pb-[13px] pt-3">
        <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{memory ?? "From your SDL"}</span>
        <span className="flex min-w-0 items-baseline gap-[5px]">
          {gpuCount !== undefined && <span className="shrink-0 font-mono text-sm font-semibold text-muted-foreground">{gpuCount}×</span>}
          <span className="min-w-0 truncate text-2xl font-bold leading-[30px] tracking-[-0.015em]">{model}</span>
        </span>
      </span>
      {specs.map(spec => (
        <span key={spec.label} className="flex min-w-0 items-baseline justify-between gap-2.5 border-t px-3.5 py-[7px] last:pb-3">
          <span className="shrink-0 text-xs text-muted-foreground">{spec.label}</span>
          <span className="min-w-0 text-right font-mono text-xs leading-[17px] [overflow-wrap:anywhere]">{spec.value}</span>
        </span>
      ))}
    </label>
  );
}

export function GpuField({ draft, onChange }: DraftFieldProps) {
  const gpu = findCatalogGpu(draft.gpuModel);
  const { unit, count } = countUnits(draft);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3">
        <FieldGroup label="Model" hint={gpu ? `${gpu.memory} memory each` : undefined}>
          <SearchableSelect
            ariaLabel="GPU model"
            searchLabel="Search GPUs"
            searchPlaceholder="Search GPUs…"
            notFoundMessage="No GPU matches. Choose Something else to type it."
            placeholder="Choose a GPU"
            options={GPU_OPTIONS}
            value={draft.gpuModel ?? ""}
            renderValue={value => GPU_OPTIONS.find(option => option.value === value)?.label}
            onChange={gpuModel => onChange(withGpuModel(draft, gpuModel))}
            triggerClassName="h-9"
          />
        </FieldGroup>
        {draft.gpuModel === OTHER_GPU_MODEL && (
          <Input
            id="gpu-quote-other-model"
            label="Which GPU?"
            labelClassName="text-[12.5px] font-medium"
            placeholder="e.g. GB200 NVL72, Gaudi 3"
            maxLength={MAX_GPU_MODEL_LENGTH}
            value={draft.otherGpuModel}
            onChange={event => onChange({ otherGpuModel: event.target.value })}
          />
        )}
      </div>
      <FieldGroup label={`How many ${unit.name}s?`} hint={`${unit.gpuCount} GPUs per ${unit.name}`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <QuantityStepper
            label={`${unit.name}s`}
            value={count}
            min={1}
            max={Math.floor(MAX_GPU_COUNT / unit.gpuCount)}
            onChange={units => onChange({ gpuCount: units * unit.gpuCount })}
          />
          <ChoiceChips
            label={`Common ${unit.name} counts`}
            choices={UNIT_COUNTS[unit.name].map(units => ({ value: units, label: String(units) }))}
            value={count}
            onChange={units => onChange({ gpuCount: units * unit.gpuCount })}
          />
        </div>
        <Equation terms={`${pluralize(count, unit.name)} × ${unit.gpuCount} GPUs = `} result={describeGpuTotal(draft.gpuCount)} />
      </FieldGroup>
    </div>
  );
}

export function InterconnectField({ draft, onChange }: DraftFieldProps) {
  const gpu = findCatalogGpu(draft.gpuModel);
  const { unit } = countUnits(draft);

  return (
    <div className="flex flex-col gap-3">
      <OptionCards label="Network between servers" options={FABRICS} value={draft.fabric} onChange={fabric => onChange({ fabric })} />
      {gpu && (
        <p className="text-[12.5px] text-muted-foreground">
          Inside each {unit.name === "rack" ? "rack" : "server"}, {gpu.label} GPUs connect over {gpu.serverLink ?? "PCIe"}.
        </p>
      )}
    </div>
  );
}

export function StorageField({ draft, onChange }: DraftFieldProps) {
  const { unit, count } = countUnits(draft);
  const storageTotal = describeStorageTotal(draft);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex items-center gap-2">
          <QuantityStepper
            label="Storage in TB"
            value={draft.storageTbPerNode}
            min={0}
            max={MAX_STORAGE_TB_PER_NODE}
            onChange={storageTbPerNode => onChange({ storageTbPerNode })}
          />
          <span className="font-mono text-[12.5px] text-muted-foreground">TB</span>
        </span>
        <ChoiceChips
          label="Common sizes"
          choices={STORAGE_SIZES_TB.map(size => ({
            value: size,
            label: `${size} TB`,
            detail: size === RECOMMENDED_STORAGE_TB_PER_NODE ? "Recommended" : undefined
          }))}
          value={draft.storageTbPerNode}
          onChange={storageTbPerNode => onChange({ storageTbPerNode })}
        />
      </div>
      {storageTotal && <Equation terms={`${draft.storageTbPerNode} TB × ${pluralize(count, unit.name)} = `} result={storageTotal} />}
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border bg-background px-3.5 py-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold">Fast local disk</span>
          <span className="font-mono text-[11.5px] text-muted-foreground">NVMe SSD in the same server as the GPUs</span>
        </span>
        <Switch checked={draft.nvme} onCheckedChange={nvme => onChange({ nvme })} />
      </label>
    </div>
  );
}

function Equation({ terms, result }: { terms: string; result: string }) {
  return (
    <p className="font-mono text-[12.5px] text-muted-foreground">
      {terms}
      <span className="font-semibold text-foreground">{result}</span>
    </p>
  );
}
