"use client";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import type { PieSvgProps, PieTooltipProps } from "@nivo/pie";
import { ResponsivePie } from "@nivo/pie";
import { BasicTooltip } from "@nivo/tooltip";
import { useTheme } from "next-themes";

import useTailwind from "@src/hooks/useTailwind";
import type { NetworkCapacityStats } from "@src/queries/useProvidersQuery";
import { roundDecimal } from "@src/utils/mathHelpers";
import { bytesToShrink } from "@src/utils/unitUtils";

const getPieChartEntryColor: PieSvgProps<NetworkCapacityDatum>["colors"] = datum => datum.data.color;
type NetworkCapacityDatum = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export interface Props {
  stats: NetworkCapacityStats["resources"];
  dependencies?: typeof DEPENDENCIES;
}

export const DEPENDENCIES = {
  ResponsivePie,
  TooltipLabel
};

const NetworkCapacity: React.FunctionComponent<Props> = ({ stats, dependencies: d = DEPENDENCIES }) => {
  const networkCapacity = useMemo(() => {
    return {
      activeCPU: stats.cpu.active / 1000,
      pendingCPU: stats.cpu.pending / 1000,
      totalCPU: stats.cpu.total / 1000,
      activeGPU: stats.gpu.active,
      pendingGPU: stats.gpu.pending,
      totalGPU: stats.gpu.total,
      activeMemory: stats.memory.active,
      pendingMemory: stats.memory.pending,
      totalMemory: stats.memory.total,
      activeStorage: stats.storage.ephemeral.active + stats.storage.persistent.active,
      pendingStorage: stats.storage.ephemeral.pending + stats.storage.persistent.pending,
      totalStorage: stats.storage.total.total,
      activeEphemeralStorage: stats.storage.ephemeral.active,
      pendingEphemeralStorage: stats.storage.ephemeral.pending,
      availableEphemeralStorage: stats.storage.ephemeral.available,
      activePersistentStorage: stats.storage.persistent.active,
      pendingPersistentStorage: stats.storage.persistent.pending,
      availablePersistentStorage: stats.storage.persistent.available
    };
  }, [stats]);
  const { activeCPU, totalCPU, activeGPU, totalGPU, activeMemory, totalMemory, activeStorage, totalStorage } = networkCapacity;

  const activeMemoryBytes = activeMemory;
  const availableMemoryBytes = totalMemory - activeMemory;
  const activeStorageBytes = activeStorage;
  const _activeMemory = bytesToShrink(activeMemoryBytes);
  const _totalMemory = bytesToShrink(totalMemory);
  const _availableMemory = bytesToShrink(availableMemoryBytes);
  const _activeStorage = bytesToShrink(activeStorageBytes);
  const _totalStorage = bytesToShrink(totalStorage);
  const cpuData = useData(activeCPU, totalCPU - activeCPU);
  const gpuData = useData(activeGPU, totalGPU - activeGPU);
  const memoryData = useData(activeMemoryBytes, availableMemoryBytes);
  const storageData = useStorageData(stats.storage);
  const pieTheme = usePieTheme();
  const intl = useIntl();

  return (
    <div className="flex flex-col items-start md:flex-row md:items-center">
      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">CPU</p>
        <p className="text-sm text-muted-foreground">
          {Math.round(activeCPU)}&nbsp;CPU&nbsp;/&nbsp;{Math.round(totalCPU)}&nbsp;CPU
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <d.ResponsivePie
            data={cpuData}
            margin={{ top: 15, right: 15, bottom: 15, left: 0 }}
            innerRadius={0.3}
            padAngle={2}
            cornerRadius={4}
            activeOuterRadiusOffset={8}
            colors={getPieChartEntryColor}
            borderWidth={0}
            borderColor={{
              from: "color",
              modifiers: [["darker", 0.2]]
            }}
            valueFormat={value =>
              `${intl.formatNumber(roundDecimal(value, 2), {
                notation: "compact",
                compactDisplay: "short",
                maximumFractionDigits: 2
              })} CPU`
            }
            enableArcLinkLabels={false}
            arcLabelsSkipAngle={30}
            theme={pieTheme}
            tooltip={d.TooltipLabel}
          />
        </div>
      </div>

      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">GPU</p>
        <p className="text-sm text-muted-foreground">
          {Math.round(activeGPU)}&nbsp;GPU&nbsp;/&nbsp;{Math.round(totalGPU)}&nbsp;GPU
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <d.ResponsivePie
            data={gpuData}
            margin={{ top: 15, right: 15, bottom: 15, left: 0 }}
            innerRadius={0.3}
            padAngle={2}
            cornerRadius={4}
            activeOuterRadiusOffset={8}
            colors={getPieChartEntryColor}
            borderWidth={0}
            borderColor={{
              from: "color",
              modifiers: [["darker", 0.2]]
            }}
            valueFormat={value =>
              `${intl.formatNumber(roundDecimal(value, 2), {
                notation: "compact",
                compactDisplay: "short"
              })} GPU`
            }
            enableArcLinkLabels={false}
            arcLabelsSkipAngle={30}
            theme={pieTheme}
            tooltip={d.TooltipLabel}
          />
        </div>
      </div>

      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">Memory</p>
        <p className="text-sm text-muted-foreground">
          {`${roundDecimal(_activeMemory.value, 2)} ${_activeMemory.unit}`}&nbsp;/&nbsp;{`${roundDecimal(_totalMemory.value, 2)} ${_totalMemory.unit}`}
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <d.ResponsivePie
            data={memoryData}
            margin={{ top: 15, right: 15, bottom: 15, left: 15 }}
            innerRadius={0.3}
            padAngle={2}
            cornerRadius={4}
            activeOuterRadiusOffset={8}
            colors={getPieChartEntryColor}
            borderWidth={0}
            borderColor={{
              from: "color",
              modifiers: [["darker", 0.2]]
            }}
            valueFormat={value =>
              value === activeMemoryBytes
                ? `${roundDecimal(_activeMemory.value, 2)} ${_activeMemory.unit}`
                : `${roundDecimal(_availableMemory.value, 2)} ${_availableMemory.unit}`
            }
            enableArcLinkLabels={false}
            arcLabelsSkipAngle={30}
            theme={pieTheme}
            tooltip={d.TooltipLabel}
          />
        </div>
      </div>

      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">Storage</p>
        <p className="text-sm text-muted-foreground">
          {`${roundDecimal(_activeStorage.value, 2)} ${_activeStorage.unit}`}&nbsp;/&nbsp;{`${roundDecimal(_totalStorage.value, 2)} ${_totalStorage.unit}`}
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <d.ResponsivePie
            data={storageData}
            margin={{ top: 15, right: 15, bottom: 15, left: 15 }}
            innerRadius={0.3}
            padAngle={2}
            cornerRadius={4}
            activeOuterRadiusOffset={8}
            colors={getPieChartEntryColor}
            borderWidth={0}
            borderColor={{
              from: "color",
              modifiers: [["darker", 0.2]]
            }}
            valueFormat={value => {
              const formatted = bytesToShrink(value);
              return `${roundDecimal(formatted.value, 2)} ${formatted.unit}`;
            }}
            enableArcLinkLabels={false}
            arcLabelsSkipAngle={30}
            theme={pieTheme}
            tooltip={d.TooltipLabel}
          />
        </div>
      </div>
    </div>
  );
};

const useData = (active: number, available: number): NetworkCapacityDatum[] => {
  const { resolvedTheme } = useTheme();
  const tw = useTailwind();

  return [
    {
      id: "active",
      label: "Active",
      value: active,
      color: tw.theme.colors["primary"].DEFAULT
    },
    {
      id: "available",
      label: "Available",
      value: available,
      color: resolvedTheme === "dark" ? tw.theme.colors.neutral[500] : tw.theme.colors.neutral[500]
    }
  ];
};

function useStorageData(storageStats: NetworkCapacityStats["resources"]["storage"]): NetworkCapacityDatum[] {
  const { resolvedTheme } = useTheme();
  const tw = useTailwind();

  return [
    {
      id: "active-ephemeral",
      label: "Active ephemeral",
      color: tw.theme.colors["primary"].DEFAULT,
      value: storageStats.ephemeral.active
    },
    {
      id: "active-persistent",
      label: "Active persistent",
      color: tw.theme.colors["primary"].visited,
      value: storageStats.persistent.active
    },
    {
      id: "available-ephemeral",
      label: "Available ephemeral",
      color: resolvedTheme === "dark" ? tw.theme.colors.neutral[400] : tw.theme.colors.neutral[500],
      value: storageStats.ephemeral.available + storageStats.ephemeral.pending
    },
    {
      id: "available-persistent",
      label: "Available persistent",
      color: resolvedTheme === "dark" ? tw.theme.colors.neutral[600] : tw.theme.colors.neutral[300],
      value: storageStats.persistent.available + storageStats.persistent.pending
    }
  ];
}

const usePieTheme = () => {
  const { resolvedTheme } = useTheme();
  const tw = useTailwind();
  return {
    text: {
      fill: resolvedTheme === "dark" ? tw.theme.colors.black : tw.theme.colors.white,
      fontSize: 12
    },
    tooltip: {
      basic: {
        color: resolvedTheme === "dark" ? tw.theme.colors.white : tw.theme.colors.current
      },
      container: {
        backgroundColor: resolvedTheme === "dark" ? tw.theme.colors.neutral[700] : tw.theme.colors.white
      }
    }
  };
};

function TooltipLabel<R>({ datum }: PieTooltipProps<R>) {
  return <BasicTooltip id={datum.label} value={datum.formattedValue} enableChip={true} color={datum.color} />;
}

export default NetworkCapacity;
