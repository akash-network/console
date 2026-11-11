import type { FC } from "react";
import { CollapsibleCard } from "@akashnetwork/ui/components";
import { CpuIcon, PackageOpenIcon } from "lucide-react";

import { useAddCredits } from "@src/hooks/useAddCredits";
import type { AddCreditsRequest } from "@src/store/addCreditsStore";
import { isTrialBlockedGpuSelection, isTrialGpuRestrictionActive } from "@src/utils/deploymentData/v1beta3";
import { useRevalidateUniqueness } from "../../DeploymentPane/useRevalidateUniqueness/useRevalidateUniqueness";
import { computeResourcesTooltip, presetsTooltip } from "../cardTooltips";
import { ComputeResourcesCard } from "../ComputeResourcesCard/ComputeResourcesCard";
import { GpuCard } from "../GpuCard/GpuCard";
import { PersistentStorageCard } from "../PersistentStorageCard/PersistentStorageCard";
import { PresetsCard } from "../PresetsCard/PresetsCard";
import { RamStorageCard } from "../RamStorageCard/RamStorageCard";
import { SecurityCard } from "../SecurityCard/SecurityCard";
import { TrialGpuBlockHint } from "../TrialGpuBlockHint/TrialGpuBlockHint";
import { TrialResourceLimitHint } from "../TrialResourceLimitHint/TrialResourceLimitHint";
import { useTrialGate } from "./useTrialGate/useTrialGate";

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
  SecurityCard,
  TrialGpuBlockHint,
  TrialResourceLimitHint,
  useAddCredits,
  useRevalidateUniqueness,
  useTrialGate
};

type UnlockReason = "gpu" | "preset" | "gpu_interconnect" | "confidential_gpu" | "size_limit";

const UNLOCK_REQUESTS: Record<UnlockReason, Required<Pick<AddCreditsRequest, "description" | "context">>> = {
  gpu: {
    context: "configure_unlock_gpu",
    description: "High-end GPUs aren't covered by your free trial. Add credits to run this deployment on one, along with longer runtimes and the full Console."
  },
  preset: {
    context: "configure_unlock_preset",
    description:
      "Presets with high-end GPUs aren't covered by your free trial. Add credits to use any preset for this deployment, along with longer runtimes and the full Console."
  },
  gpu_interconnect: {
    context: "configure_unlock_gpu_interconnect",
    description: "GPU interconnect isn't covered by your free trial. Add credits to use it in this deployment, along with longer runtimes and the full Console."
  },
  confidential_gpu: {
    context: "configure_unlock_confidential_gpu",
    description:
      "Confidential compute on a GPU isn't covered by your free trial. Add credits to attest a GPU in this deployment, along with longer runtimes and the full Console."
  },
  size_limit: {
    context: "configure_unlock_size_limit",
    description:
      "This deployment needs more CPU or memory than your free trial allows. Add credits to deploy it at this size, along with longer runtimes and the full Console."
  }
};

type Props = {
  serviceIndex: number;
  /** While locked the hardware controls are disabled (cards stay expandable for viewing). */
  locked?: boolean;
  /** The trial size cap covers the whole deployment, so a view showing several services' hardware shows it once. */
  showsDeploymentLimit?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The "HARDWARE" section of the Configuration pane for the selected service:
 * Presets, GPU, Compute, Security, RAM storage and Persistent storage cards. Each
 * card edits the selected service on the shared deployment model. The GPU,
 * Security and storage cards own their card shell.
 *
 * Persistent and RAM volumes share `profile.storage` and must each have a unique
 * name and mount; re-validating the whole array on any name or mount change keeps
 * the "must be unique" error in sync across every conflicting row, not just the
 * edited one.
 */
export const HardwareSection: FC<Props> = ({ serviceIndex, locked = false, showsDeploymentLimit = true, dependencies: d = DEPENDENCIES }) => {
  d.useRevalidateUniqueness(`services.${serviceIndex}.profile.storage`, storageUniquenessKey);
  const { isRestricted } = d.useTrialGate();
  const openAddCredits = d.useAddCredits();

  const unlock = (reason: UnlockReason) => () => openAddCredits({ initialTab: "purchase", suggestFirstDeployment: false, ...UNLOCK_REQUESTS[reason] });

  /**
   * True only for GPU selections the trial blocks and only while the pane is editable — so the lock never
   * fights the quote-lock read-only state. Uses {@link isTrialBlockedGpuSelection}, which also treats an
   * empty ("any") model as blocked for a vendor with blocked models (UI-only, stricter than the SDL policy).
   */
  const isBlockedModel = (vendor?: string | null, model?: string | null) => isRestricted && !locked && isTrialBlockedGpuSelection(vendor, model);

  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">Hardware</p>
      {!locked && showsDeploymentLimit && isRestricted && <d.TrialGpuBlockHint />}
      {!locked && showsDeploymentLimit && <d.TrialResourceLimitHint onUnlock={unlock("size_limit")} />}
      <div className="flex flex-col gap-4">
        <d.CollapsibleCard locked={locked} title="Presets" icon={<PackageOpenIcon className="h-4 w-4" />} infoTooltip={presetsTooltip}>
          <d.PresetsCard serviceIndex={serviceIndex} locked={locked} isBlockedModel={isBlockedModel} onUnlock={unlock("preset")} />
        </d.CollapsibleCard>

        <d.GpuCard
          serviceIndex={serviceIndex}
          locked={locked}
          isBlockedModel={isBlockedModel}
          isInterconnectTrialBlocked={isRestricted && !locked && isTrialGpuRestrictionActive()}
          onUnlock={unlock("gpu")}
          onUnlockInterconnect={unlock("gpu_interconnect")}
        />

        <d.CollapsibleCard locked={locked} title="Compute" icon={<CpuIcon className="h-4 w-4" />} infoTooltip={computeResourcesTooltip}>
          <d.ComputeResourcesCard serviceIndex={serviceIndex} locked={locked} />
        </d.CollapsibleCard>

        <d.SecurityCard
          serviceIndex={serviceIndex}
          locked={locked}
          isGpuBlocked={isRestricted && !locked && isTrialGpuRestrictionActive()}
          onUnlock={unlock("confidential_gpu")}
        />

        <d.RamStorageCard serviceIndex={serviceIndex} locked={locked} />

        <d.PersistentStorageCard serviceIndex={serviceIndex} locked={locked} />
      </div>
    </div>
  );
};
