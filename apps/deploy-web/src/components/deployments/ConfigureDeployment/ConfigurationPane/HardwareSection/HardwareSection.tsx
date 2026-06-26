import type { FC } from "react";
import { CollapsibleCard } from "@akashnetwork/ui/components";
import { CpuIcon, PackageOpenIcon } from "lucide-react";

import { useRevalidateUniqueness } from "../../DeploymentPane/useRevalidateUniqueness/useRevalidateUniqueness";
import { computeResourcesTooltip, presetsTooltip } from "../cardTooltips";
import { ComputeResourcesCard } from "../ComputeResourcesCard/ComputeResourcesCard";
import { ConfidentialComputeCard } from "../ConfidentialComputeCard/ConfidentialComputeCard";
import { GpuCard } from "../GpuCard/GpuCard";
import { PersistentStorageCard } from "../PersistentStorageCard/PersistentStorageCard";
import { PresetsCard } from "../PresetsCard/PresetsCard";
import { RamStorageCard } from "../RamStorageCard/RamStorageCard";

type StorageVolume = { name?: string; mount?: string };

/**
 * Uniqueness key for a storage volume. The space separator is load-bearing:
 * without it `name`+`mount` of two different volumes can concatenate to the same
 * string (e.g. `"ab"`+`"c"` vs `"a"`+`"bc"`), which would let the revalidation
 * effect skip a real conflict. Exported so the test harness keys volumes the same
 * way the component does and cannot silently drift from it.
 */
export const storageUniquenessKey = (storage: StorageVolume) => `${storage.name ?? ""} ${storage.mount ?? ""}`;

export const DEPENDENCIES = {
  CollapsibleCard,
  PresetsCard,
  GpuCard,
  ComputeResourcesCard,
  RamStorageCard,
  PersistentStorageCard,
  ConfidentialComputeCard,
  useRevalidateUniqueness
};

type Props = {
  serviceIndex: number;
  /** While locked the hardware controls are disabled (cards stay expandable for viewing). */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The "HARDWARE" section of the Configuration pane for the selected service:
 * Presets, GPU, CPU (with memory & storage) and Persistent Storage cards. Each
 * card edits `services.${serviceIndex}.profile.*` on the shared deployment
 * model. The GPU and Persistent Storage cards own their own card shell because
 * they carry a header switch.
 *
 * Persistent and RAM volumes share `profile.storage` and must each have a unique
 * name and mount; re-validating the whole array on any name or mount change keeps
 * the "must be unique" error in sync across every conflicting row, not just the
 * edited one.
 */
export const HardwareSection: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  d.useRevalidateUniqueness(`services.${serviceIndex}.profile.storage`, storageUniquenessKey);

  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">Hardware</p>
      <div className="flex flex-col gap-4">
        <d.CollapsibleCard title="Presets" icon={<PackageOpenIcon className="h-4 w-4" />} infoTooltip={presetsTooltip}>
          <d.PresetsCard serviceIndex={serviceIndex} locked={locked} />
        </d.CollapsibleCard>

        <d.GpuCard serviceIndex={serviceIndex} locked={locked} />

        <d.CollapsibleCard title="Compute Resources" icon={<CpuIcon className="h-4 w-4" />} infoTooltip={computeResourcesTooltip}>
          <d.ComputeResourcesCard serviceIndex={serviceIndex} locked={locked} />
        </d.CollapsibleCard>

        <d.ConfidentialComputeCard serviceIndex={serviceIndex} locked={locked} />

        <d.RamStorageCard serviceIndex={serviceIndex} locked={locked} />

        <d.PersistentStorageCard serviceIndex={serviceIndex} locked={locked} />
      </div>
    </div>
  );
};
