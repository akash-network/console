import { Input, QuantityStepper, Switch } from "@akashnetwork/ui/components";

import type { Interconnect } from "../gpuQuoteDraft/gpuQuoteCatalog";
import { FABRIC_SPEEDS, FABRICS, GPU_CATALOG, GPUS_PER_NODE, MAX_STORAGE_TB_PER_NODE, OTHER_GPU_MODEL } from "../gpuQuoteDraft/gpuQuoteCatalog";
import type { GpuQuoteDraft, StartingPoint, StartingPointId } from "../gpuQuoteDraft/gpuQuoteDraft";
import { describeStartingPoint, isWholeNodes } from "../gpuQuoteDraft/gpuQuoteDraft";
import type { Choice, Option } from "./ChoiceControls";
import { ChoiceChips, FieldGroup, OptionCards } from "./ChoiceControls";

export type DraftFieldProps = { draft: GpuQuoteDraft; onChange: (patch: Partial<GpuQuoteDraft>) => void };

const MAX_SERVERS = 125;
const MAX_GPU_MODEL_LENGTH = 100;
const WHOLE_SERVERS = "servers";

const GPU_GROUPS: { name: string; choices: Choice<string>[] }[] = [
  ...[...new Set(GPU_CATALOG.map(gpu => gpu.group))].map(group => ({
    name: group,
    choices: GPU_CATALOG.filter(gpu => gpu.group === group).map(gpu => ({ value: gpu.id, label: gpu.label, detail: gpu.memory }))
  })),
  { name: "Not listed", choices: [{ value: OTHER_GPU_MODEL, label: "Something else" }] }
];

type GpuCountChoice = number | typeof WHOLE_SERVERS;

const GPU_COUNT_CHOICES: Choice<GpuCountChoice>[] = [
  { value: 1, label: "1 GPU" },
  { value: 2, label: "2 GPUs" },
  { value: 4, label: "4 GPUs" },
  { value: WHOLE_SERVERS, label: "Whole servers of 8" }
];

const INTERCONNECT_OPTIONS: Option<Interconnect>[] = [
  { value: "none", title: "Not needed", description: "Each GPU runs its own work, like inference or batch jobs.", detail: "PCIe only" },
  {
    value: "server",
    title: "Linked inside each server",
    description: "GPUs in the same server share memory at full speed. Common for fine-tuning and large models.",
    detail: "NVLink or Infinity Fabric"
  },
  {
    value: "cluster",
    title: "Linked across servers",
    description: "Servers work together as one cluster, for multi-node training.",
    detail: "InfiniBand or RoCE between servers"
  }
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
  return (
    <OptionCards
      label="Starting point"
      options={startingPoints.map(startingPoint => ({
        value: startingPoint.id,
        title: startingPoint.name,
        description: startingPoint.use,
        detail: describeStartingPoint(startingPoint)
      }))}
      value={value}
      onChange={id => onPick(startingPoints.find(startingPoint => startingPoint.id === id)!)}
    />
  );
}

export function GpuField({ draft, onChange }: DraftFieldProps) {
  const isWholeServers = isWholeNodes(draft.gpuCount);

  return (
    <div className="flex flex-col gap-6">
      <FieldGroup label="Model">
        {GPU_GROUPS.map(group => (
          <div key={group.name} className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{group.name}</span>
            <ChoiceChips label={group.name} choices={group.choices} value={draft.gpuModel} onChange={gpuModel => onChange({ gpuModel })} />
          </div>
        ))}
        {draft.gpuModel === OTHER_GPU_MODEL && (
          <Input
            id="gpu-quote-other-model"
            label="Which GPU?"
            placeholder="e.g. GB200, Gaudi 3"
            maxLength={MAX_GPU_MODEL_LENGTH}
            value={draft.otherGpuModel}
            onChange={event => onChange({ otherGpuModel: event.target.value })}
          />
        )}
      </FieldGroup>
      <FieldGroup label="How many?">
        <ChoiceChips<GpuCountChoice>
          label="How many GPUs"
          choices={GPU_COUNT_CHOICES}
          value={isWholeServers ? WHOLE_SERVERS : draft.gpuCount}
          onChange={count => onChange({ gpuCount: count === WHOLE_SERVERS ? GPUS_PER_NODE : count })}
        />
        {isWholeServers && (
          <div className="flex flex-wrap items-center gap-3">
            <QuantityStepper
              label="Servers"
              value={draft.gpuCount / GPUS_PER_NODE}
              min={1}
              max={MAX_SERVERS}
              onChange={servers => onChange({ gpuCount: servers * GPUS_PER_NODE })}
            />
            <span className="text-sm text-muted-foreground">{draft.gpuCount} GPUs in total</span>
          </div>
        )}
      </FieldGroup>
    </div>
  );
}

export function InterconnectField({ draft, onChange }: DraftFieldProps) {
  return (
    <div className="flex flex-col gap-6">
      <OptionCards label="Interconnect" options={INTERCONNECT_OPTIONS} value={draft.interconnect} onChange={interconnect => onChange({ interconnect })} />
      {draft.interconnect === "cluster" && (
        <>
          <FieldGroup label="Network between servers">
            <ChoiceChips label="Network between servers" choices={FABRICS} value={draft.fabric} onChange={fabric => onChange({ fabric })} />
          </FieldGroup>
          <FieldGroup label="Speed per GPU">
            <ChoiceChips
              label="Speed per GPU"
              choices={FABRIC_SPEEDS.map(speed => ({ value: speed, label: `${speed} Gb/s` }))}
              value={draft.fabricGbps}
              onChange={fabricGbps => onChange({ fabricGbps })}
            />
          </FieldGroup>
        </>
      )}
    </div>
  );
}

export function StorageField({ draft, onChange }: DraftFieldProps) {
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup label="Terabytes" hint={isWholeNodes(draft.gpuCount) ? "In each server" : undefined}>
        <QuantityStepper
          label="Storage in TB"
          value={draft.storageTbPerNode}
          min={0}
          max={MAX_STORAGE_TB_PER_NODE}
          onChange={storageTbPerNode => onChange({ storageTbPerNode })}
        />
      </FieldGroup>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">Fast local disk</span>
          <span className="font-mono text-xs text-muted-foreground">NVMe SSD in the same server as the GPUs</span>
        </span>
        <Switch checked={draft.nvme} onCheckedChange={nvme => onChange({ nvme })} />
      </label>
    </div>
  );
}
