import type { FC } from "react";
import { Skeleton } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Cpu, Zap } from "lucide-react";

import { formatBytes, formatGpuModel } from "@src/components/providers/providerSummary/providerSummary";
import type { ProviderGpuDriver } from "@src/types/provider";
import { ProfileCard } from "./ProfileCard";
import type { GpuModelAvailability } from "./useProviderProfileModel";

type Props = {
  models: GpuModelAvailability[] | null;
  isLoading: boolean;
  isProviderOffline: boolean;
  drivers: ProviderGpuDriver[];
  freeVcpuCount: number;
  freeMemoryBytes: number;
};

export const GpuInventoryCard: FC<Props> = ({ models, isLoading, isProviderOffline, drivers, freeVcpuCount, freeMemoryBytes }) => {
  const total = models?.reduce((sum, model) => sum + model.total, 0) ?? 0;
  const free = models?.reduce((sum, model) => sum + model.free, 0) ?? 0;

  return (
    <ProfileCard
      title="GPU inventory"
      aside={models && models.length > 0 && <span className="font-mono text-[11px] text-muted-foreground">{`${free} of ${total} free now`}</span>}
    >
      {isLoading && (
        <div className="flex flex-col gap-2 p-3.5" aria-label="Loading the GPU inventory">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {!isLoading && !models && <p className="px-3.5 py-4 text-[12.5px] text-muted-foreground">The GPU inventory can&apos;t be loaded right now.</p>}

      {!isLoading && models?.length === 0 && isProviderOffline && (
        <p className="px-3.5 py-4 text-[12.5px] text-muted-foreground">No inventory is reported while the provider is offline.</p>
      )}

      {!isLoading && models?.length === 0 && !isProviderOffline && (
        <div className="flex items-start gap-2.5 px-3.5 pb-4 pt-3.5">
          <Cpu className="mt-px h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-[12.5px] leading-[1.55] text-muted-foreground">
            No GPUs. This is a CPU and memory provider, with {freeVcpuCount} vCPU and {formatBytes(freeMemoryBytes)} of RAM free right now.
          </p>
        </div>
      )}

      {!isLoading && models && models.length > 0 && (
        <>
          <table className="w-full border-collapse" aria-label="GPU models">
            <thead>
              <tr className="bg-muted">
                <HeaderCell>Model</HeaderCell>
                <HeaderCell>VRAM</HeaderCell>
                <HeaderCell className="hidden sm:table-cell">Interface</HeaderCell>
                <HeaderCell>Availability</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {models.map(model => (
                <tr key={`${model.vendor}-${model.model}-${model.ram}-${model.interface}`} className="border-t">
                  <td className="px-3.5 py-[11px]">
                    <span className="inline-flex items-center gap-[7px]">
                      <Zap className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="whitespace-nowrap text-[13px] font-semibold text-foreground">{formatGpuModel(model.model)}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-[11px] font-mono text-xs">{formatGpuMemory(model.ram)}</td>
                  <td className="hidden px-3.5 py-[11px] font-mono text-xs text-muted-foreground sm:table-cell">{model.interface}</td>
                  <td className="px-3.5 py-[11px]">
                    <Availability free={model.free} total={model.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-2 border-t px-3.5 py-2.5">
            <span className="text-[11px] text-muted-foreground">Drivers seen on Console leases</span>
            {drivers.length === 0 && <span className="font-mono text-[11px] text-muted-foreground">None read yet</span>}
            {drivers.map(driver => (
              <span
                key={driver.driverVersion}
                title={`Last seen ${driver.lastSeenDate}`}
                className="rounded-full border bg-muted px-2 py-0.5 font-mono text-[10.5px] text-foreground"
              >
                {driver.cudaVersion ? `${driver.driverVersion} · CUDA ${driver.cudaVersion}` : driver.driverVersion}
              </span>
            ))}
          </div>
        </>
      )}
    </ProfileCard>
  );
};

const HeaderCell: FC<{ className?: string; children: string }> = ({ className, children }) => (
  <th
    scope="col"
    className={cn("whitespace-nowrap px-3.5 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground", className)}
  >
    {children}
  </th>
);

const Availability: FC<{ free: number; total: number }> = ({ free, total }) => (
  <span className="flex items-center gap-2">
    <span className="hidden h-[5px] w-full max-w-[110px] overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
      <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${total > 0 ? (free / total) * 100 : 0}%` }} />
    </span>
    <span className={cn("whitespace-nowrap font-mono text-[11.5px]", free === 0 ? "text-amber-700 dark:text-amber-500" : "text-foreground")}>
      {free === 0 ? "None free" : `${free} of ${total} free`}
    </span>
  </span>
);

function formatGpuMemory(ram: string): string {
  const match = /^(\d+(?:\.\d+)?)\s*([KMGT])i?B?$/i.exec(ram.trim());
  return match ? `${match[1]} ${match[2].toUpperCase()}B` : ram;
}
