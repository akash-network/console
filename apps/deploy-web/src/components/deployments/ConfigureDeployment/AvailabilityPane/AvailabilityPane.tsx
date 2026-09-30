import type { FC, ReactNode } from "react";
import { useId } from "react";
import { Button, CustomTooltip } from "@akashnetwork/ui/components";
import { GpuIcon, InfoIcon, LoaderCircleIcon, MessageSquareIcon, PanelsTopLeftIcon } from "lucide-react";

import { useNetworkProviderCount } from "@src/queries/useNetworkProviderCount";
import { useScreenedProviders } from "@src/queries/useScreenedProviders";
import type { PlacementType } from "@src/types";
import type { GpuAvailabilityRow } from "./gpuAvailability/gpuAvailability";
import { listGpuAvailabilityRows } from "./gpuAvailability/gpuAvailability";
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
  onRequestCompute: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const AvailabilityPane: FC<Props> = ({
  sdl,
  placement,
  placementCount,
  isReady,
  isSubmitting,
  onChooseProvider,
  onRequestCompute,
  dependencies: d = DEPENDENCIES
}) => {
  const headingId = useId();
  const screened = d.useScreenedProviders({ sdl, placementName: placement.name, region: placement.region });
  const network = d.useNetworkProviderCount();
  const gpuAvailability = d.useGpuAvailability(placement);
  const scope = placementCount > 1 ? "this placement" : "your deployment";

  return (
    <section aria-labelledby={headingId} className="flex h-full min-h-0 flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-zinc-300 px-4 dark:border-zinc-700">
        <h2 id={headingId} className="font-mono text-sm font-medium uppercase text-muted-foreground">
          Providers
        </h2>
        <span className="text-xs text-muted-foreground">Live view · nothing to select here</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-[720px] space-y-4">
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
              networkCount={network.count}
              CustomTooltip={d.CustomTooltip}
            />
          )}
        </div>
      </div>
      <footer className="shrink-0 border-t border-zinc-300 p-4 dark:border-zinc-700">
        <div className="mx-auto max-w-[720px] space-y-3">
          {!isReady && <p className="text-sm text-muted-foreground">Add a container image and hardware to every service on the left to deploy.</p>}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3">
            <FooterAction
              variant="outline"
              icon={<MessageSquareIcon className="h-5 w-5" />}
              title="Request compute"
              subtitle="Don't see what you need?"
              onClick={onRequestCompute}
            />
            <FooterAction
              variant="default"
              icon={<PanelsTopLeftIcon className="h-5 w-5" />}
              title="Choose a provider"
              subtitle="Compare live bids yourself"
              disabled={isSubmitting}
              onClick={onChooseProvider}
            />
          </div>
        </div>
      </footer>
    </section>
  );
};

type FooterActionProps = {
  variant: "default" | "outline";
  icon: ReactNode;
  title: string;
  subtitle: string;
  disabled?: boolean;
  onClick: () => void;
};

function FooterAction({ variant, icon, title, subtitle, disabled, onClick }: FooterActionProps) {
  const subtitleId = useId();

  return (
    <Button
      type="button"
      variant={variant}
      data-variant={variant}
      aria-label={title}
      aria-describedby={subtitleId}
      disabled={disabled}
      onClick={onClick}
      className="group h-auto justify-start gap-3 whitespace-normal rounded-lg p-3 text-left"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground group-data-[variant=default]:bg-primary-foreground/15 group-data-[variant=default]:text-primary-foreground"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-semibold">{title}</span>
        <span id={subtitleId} className="text-xs font-normal opacity-80">
          {subtitle}
        </span>
      </span>
    </Button>
  );
}

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
          <span className="font-mono text-4xl font-semibold">{eligibleCount}</span>
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
        <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${eligibleShare * 100}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-primary" aria-hidden="true" />
              eligible
            </span>
            <span>
              {networkCount} {networkCount === 1 ? "provider" : "providers"} on the network
            </span>
          </div>
        </div>
      )}
    </AvailabilityCard>
  );
}

type GpuAvailabilityCardProps = {
  gpuAvailability: GpuAvailability;
  requestedCount: number | null;
  networkCount: number | null;
  CustomTooltip: typeof DEPENDENCIES.CustomTooltip;
};

function GpuAvailabilityCard({ gpuAvailability, requestedCount, networkCount, CustomTooltip }: GpuAvailabilityCardProps) {
  const listId = useId();
  const { requestedLabel, alternatives, noGpuCount, isChecking, noOtherModelFits } = gpuAvailability;
  const rows = listGpuAvailabilityRows({ requestedLabel, alternatives, noGpuCount, requestedCount, networkCount });

  return (
    <AvailabilityCard>
      <div className="flex items-center gap-2">
        <GpuIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold">GPU availability</h3>
        <span className="ml-auto flex">
          <CustomTooltip title="Each number is how many providers could host this configuration if you switched to that model and kept everything else the same.">
            <InfoIcon className="h-3.5 w-3.5 cursor-help text-muted-foreground" aria-label="How these counts work" />
          </CustomTooltip>
        </span>
      </div>
      <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p id={listId} className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          If you switch model
        </p>
        <ul aria-labelledby={listId} className="space-y-1">
          {rows.map(row => (
            <GpuRow key={row.key} row={row} />
          ))}
        </ul>
        {isChecking && alternatives.length === 0 && (
          <p role="status" className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <LoaderCircleIcon className="h-3 w-3 animate-spin" aria-hidden="true" />
            Checking other models…
          </p>
        )}
        {noOtherModelFits && <p className="px-2 text-xs text-muted-foreground">No other GPU model fits this configuration.</p>}
      </div>
    </AvailabilityCard>
  );
}

function GpuRow({ row }: { row: GpuAvailabilityRow }) {
  return (
    <li
      aria-current={row.isCurrent || undefined}
      className="group grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-md border border-transparent px-2 py-1.5 font-mono text-xs aria-[current=true]:border-zinc-300 aria-[current=true]:bg-muted aria-[current=true]:font-semibold dark:aria-[current=true]:border-zinc-700"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{row.label}</span>
        {row.isCurrent && <span className="shrink-0 rounded bg-foreground px-1.5 py-0.5 text-[10px] uppercase text-background">Current</span>}
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-muted group-aria-[current=true]:bg-background" aria-hidden="true">
        <span className="block h-full rounded-full bg-muted-foreground/40 group-aria-[current=true]:bg-foreground" style={{ width: `${row.share * 100}%` }} />
      </span>
      <span className="text-right">{row.providerCount ?? "…"}</span>
    </li>
  );
}

function AvailabilityCard({ children }: { children: ReactNode }) {
  return <div className="space-y-3 rounded-lg border border-zinc-300 bg-card p-4 dark:border-zinc-700">{children}</div>;
}
