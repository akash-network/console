import type { FC, ReactNode } from "react";
import { useId } from "react";
import { Button, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { GpuIcon, InfoIcon, LoaderCircleIcon, ServerIcon } from "lucide-react";

import { useNetworkProviderCount } from "@src/queries/useNetworkProviderCount";
import { useScreenedProviders } from "@src/queries/useScreenedProviders";
import type { PlacementType } from "@src/types";
import type { GpuAvailability } from "./useGpuAvailability/useGpuAvailability";
import { useGpuAvailability } from "./useGpuAvailability/useGpuAvailability";

export const DEPENDENCIES = { useScreenedProviders, useNetworkProviderCount, useGpuAvailability, CustomTooltip };

type Props = {
  sdl: string;
  placement: PlacementType;
  placementCount: number;
  isReady: boolean;
  isSubmitting: boolean;
  onChooseProvider: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const AvailabilityPane: FC<Props> = ({ sdl, placement, placementCount, isReady, isSubmitting, onChooseProvider, dependencies: d = DEPENDENCIES }) => {
  const headingId = useId();
  const subtitleId = useId();
  const screened = d.useScreenedProviders({ sdl, placementName: placement.name, region: placement.region });
  const network = d.useNetworkProviderCount();
  const gpuAvailability = d.useGpuAvailability(placement.id);
  const scope = placementCount > 1 ? "this placement" : "your deployment";

  return (
    <section aria-labelledby={headingId} className="flex h-full min-h-0 flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-zinc-300 px-4 dark:border-zinc-700">
        <h2 id={headingId} className="font-mono text-sm font-medium uppercase text-muted-foreground">
          Providers
        </h2>
        <span className="text-xs text-muted-foreground">Live view · nothing to select here</span>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {placementCount > 1 && (
          <p className="font-mono text-xs text-muted-foreground">
            {placement.name} · {placement.region || "Any region"}
          </p>
        )}
        <ProviderCountCard screened={screened} networkCount={network.count} scope={scope} />
        {!screened.isInvalid && !screened.isError && (
          <GpuAvailabilityCard
            gpuAvailability={gpuAvailability}
            requestedCount={screened.isLoading ? null : screened.providers.length}
            CustomTooltip={d.CustomTooltip}
          />
        )}
      </div>
      <footer className="shrink-0 space-y-3 border-t border-zinc-300 p-4 dark:border-zinc-700">
        {!isReady && <p className="text-sm text-muted-foreground">Add a container image and hardware to every service on the left to deploy.</p>}
        <Button
          type="button"
          aria-label="Choose a provider"
          aria-describedby={subtitleId}
          disabled={isSubmitting}
          onClick={onChooseProvider}
          className="h-auto w-full flex-col gap-0.5 py-3"
        >
          <span className="text-base font-semibold">Choose a provider</span>
          <span id={subtitleId} className="text-xs font-normal opacity-80">
            Compare live bids yourself
          </span>
        </Button>
      </footer>
    </section>
  );
};

type ProviderCountCardProps = {
  screened: ReturnType<typeof DEPENDENCIES.useScreenedProviders>;
  networkCount: number | null;
  scope: string;
};

function ProviderCountCard({ screened, networkCount, scope }: ProviderCountCardProps) {
  if (screened.isInvalid) {
    return (
      <AvailabilityCard>
        <p className="text-sm font-medium">No providers to show yet</p>
        <p className="text-sm text-muted-foreground">Fix the highlighted fields on the left to see which providers can host it.</p>
      </AvailabilityCard>
    );
  }
  if (screened.isError && screened.providers.length === 0) {
    return (
      <AvailabilityCard>
        <p role="alert" className="text-sm text-muted-foreground">
          Couldn&apos;t check providers right now. The count comes back when the network answers.
        </p>
      </AvailabilityCard>
    );
  }
  if (screened.isLoading) {
    return (
      <AvailabilityCard>
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking providers…
        </p>
      </AvailabilityCard>
    );
  }

  const eligibleCount = screened.providers.length;
  const eligibleShare = networkCount ? Math.min(1, eligibleCount / networkCount) : 0;

  return (
    <AvailabilityCard>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold">{eligibleCount}</span>
          <span className="text-sm text-muted-foreground">
            {eligibleCount === 1 ? "provider" : "providers"} can host {scope}
          </span>
        </p>
        {screened.isRefreshing && (
          <span role="status" className="flex items-center gap-1 text-xs text-muted-foreground">
            <LoaderCircleIcon className="h-3 w-3 animate-spin" aria-hidden="true" />
            Updating
          </span>
        )}
      </div>
      {networkCount !== null && (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${eligibleShare * 100}%` }} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ServerIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {networkCount} {networkCount === 1 ? "provider" : "providers"} on the network
          </p>
        </>
      )}
    </AvailabilityCard>
  );
}

type GpuAvailabilityCardProps = {
  gpuAvailability: GpuAvailability;
  requestedCount: number | null;
  CustomTooltip: typeof DEPENDENCIES.CustomTooltip;
};

function GpuAvailabilityCard({ gpuAvailability, requestedCount, CustomTooltip }: GpuAvailabilityCardProps) {
  const listId = useId();

  return (
    <AvailabilityCard>
      <div className="flex items-center gap-2">
        <GpuIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 id={listId} className="text-sm font-semibold">
          If you add a GPU
        </h3>
        <CustomTooltip title="Counts other than the current one cover the whole network and ignore CPU, memory and region.">
          <InfoIcon className="h-3.5 w-3.5 cursor-help text-muted-foreground" aria-label="How these counts work" />
        </CustomTooltip>
      </div>
      <ul aria-labelledby={listId} className="divide-y divide-zinc-200 dark:divide-zinc-800">
        <GpuRow label={gpuAvailability.requestedLabel} providerCount={requestedCount} isCurrent />
        {gpuAvailability.topModels.map(model => (
          <GpuRow key={model.key} label={model.label} providerCount={model.providerCount} />
        ))}
      </ul>
    </AvailabilityCard>
  );
}

function GpuRow({ label, providerCount, isCurrent = false }: { label: string; providerCount: number | null; isCurrent?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <span className={cn("flex items-center gap-2", isCurrent && "font-medium")}>
        {label}
        {isCurrent && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">Current</span>}
      </span>
      <span className="font-mono text-muted-foreground">{providerCount ?? "…"}</span>
    </li>
  );
}

function AvailabilityCard({ children }: { children: ReactNode }) {
  return <div className="space-y-3 rounded-lg border border-zinc-300 bg-card p-4 dark:border-zinc-700">{children}</div>;
}
