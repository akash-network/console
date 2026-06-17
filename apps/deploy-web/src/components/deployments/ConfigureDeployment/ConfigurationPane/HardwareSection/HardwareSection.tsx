import type { FC } from "react";
import { CollapsibleCard } from "@akashnetwork/ui/components";
import { CpuIcon } from "lucide-react";

import { useRevalidateUniqueness } from "../../DeploymentPane/useRevalidateUniqueness/useRevalidateUniqueness";
import { computeResourcesTooltip } from "../cardTooltips";
import { ComputeResourcesCard } from "../ComputeResourcesCard/ComputeResourcesCard";
import { PersistentStorageCard } from "../PersistentStorageCard/PersistentStorageCard";
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
  ComputeResourcesCard,
  RamStorageCard,
  PersistentStorageCard,
  useRevalidateUniqueness
};

type Props = {
  serviceIndex: number;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The "HARDWARE" section of the Configuration pane for the selected service:
 * CPU (with memory & ephemeral storage), RAM-backed storage and Persistent
 * Storage cards. Each card edits `services.${serviceIndex}.profile.*` on the
 * shared deployment model. The RAM and Persistent Storage cards own their own
 * card shell because they carry a header switch.
 *
 * Persistent and RAM volumes share `profile.storage` and must each have a unique
 * name and mount; re-validating the whole array on any name or mount change keeps
 * the "must be unique" error in sync across every conflicting row, not just the
 * edited one.
 */
export const HardwareSection: FC<Props> = ({ serviceIndex, dependencies: d = DEPENDENCIES }) => {
  d.useRevalidateUniqueness(`services.${serviceIndex}.profile.storage`, storageUniquenessKey);

  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">Hardware</p>
      <div className="flex flex-col gap-4">
        <d.CollapsibleCard title="Compute Resources" icon={<CpuIcon className="h-4 w-4" />} infoTooltip={computeResourcesTooltip}>
          <d.ComputeResourcesCard serviceIndex={serviceIndex} />
        </d.CollapsibleCard>

        <d.RamStorageCard serviceIndex={serviceIndex} />

        <d.PersistentStorageCard serviceIndex={serviceIndex} />
      </div>
    </div>
  );
};
