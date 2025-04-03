"use client";
import { useIntl } from "react-intl";
import type { PieSvgProps, PieTooltipProps } from "@nivo/pie";
import { ResponsivePie } from "@nivo/pie";
import { BasicTooltip } from "@nivo/tooltip";
import { useTheme } from "next-themes";

import useTailwind from "@src/hooks/useTailwind";
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
  activeCPU: number;
  pendingCPU: number;
  totalCPU: number;
  activeGPU: number;
  pendingGPU: number;
  totalGPU: number;
  activeMemory: number;
  pendingMemory: number;
  totalMemory: number;
  activeStorage: number;
  pendingStorage: number;
  totalStorage: number;
  activeEphemeralStorage: number;
  pendingEphemeralStorage: number;
  availableEphemeralStorage: number;
  activePersistentStorage: number;
  pendingPersistentStorage: number;
  availablePersistentStorage: number;
}

const NetworkCapacity: React.FunctionComponent<Props> = props => {
  const {
    activeCPU,
    pendingCPU,
    totalCPU,
    activeGPU,
    pendingGPU,
    totalGPU,
    activeMemory,
    pendingMemory,
    totalMemory,
    activeStorage,
    pendingStorage,
    totalStorage
  } = props;
  const activeMemoryBytes = activeMemory + pendingMemory;
  const availableMemoryBytes = totalMemory - (activeMemory + pendingMemory);
  const activeStorageBytes = activeStorage + pendingStorage;
  const _activeMemory = bytesToShrink(activeMemoryBytes);
  const _totalMemory = bytesToShrink(totalMemory);
  const _availableMemory = bytesToShrink(availableMemoryBytes);
  const _activeStorage = bytesToShrink(activeStorageBytes);
  const _totalStorage = bytesToShrink(totalStorage);
  const cpuData = useData(activeCPU + pendingCPU, totalCPU - activeCPU - pendingCPU);
  const gpuData = useData(activeGPU + pendingGPU, totalGPU - activeGPU - pendingGPU);
  const memoryData = useData(activeMemoryBytes, availableMemoryBytes);
  const storageData = useStorageData(props);
  const pieTheme = usePieTheme();
  const intl = useIntl();

  return (
    <div className="flex flex-col items-start md:flex-row md:items-center">
      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">CPU</p>
        <p className="text-sm text-muted-foreground">
          {Math.round(activeCPU + pendingCPU)}&nbsp;CPU&nbsp;/&nbsp;{Math.round(totalCPU)}&nbsp;CPU
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <ResponsivePie
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
            tooltip={TooltipLabel}
          />
        </div>
      </div>

      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">GPU</p>
        <p className="text-sm text-muted-foreground">
          {Math.round(activeGPU + pendingGPU)}&nbsp;GPU&nbsp;/&nbsp;{Math.round(totalGPU)}&nbsp;GPU
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <ResponsivePie
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
            tooltip={TooltipLabel}
          />
        </div>
      </div>

      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">Memory</p>
        <p className="text-sm text-muted-foreground">
          {`${roundDecimal(_activeMemory.value, 2)} ${_activeMemory.unit}`}&nbsp;/&nbsp;{`${roundDecimal(_totalMemory.value, 2)} ${_totalMemory.unit}`}
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <ResponsivePie
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
            tooltip={TooltipLabel}
          />
        </div>
      </div>

      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">Storage</p>
        <p className="text-sm text-muted-foreground">
          {`${roundDecimal(_activeStorage.value, 2)} ${_activeStorage.unit}`}&nbsp;/&nbsp;{`${roundDecimal(_totalStorage.value, 2)} ${_totalStorage.unit}`}
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <ResponsivePie
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
            tooltip={TooltipLabel}
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
      color: resolvedTheme === "dark" ? tw.theme.colors.neutral[800] : tw.theme.colors.neutral[500]
    }
  ];
};

function useStorageData(props: Props): NetworkCapacityDatum[] {
  const { resolvedTheme } = useTheme();
  const tw = useTailwind();

  return [
    {
      id: "active-ephemeral",
      label: "Active emphemeral",
      color: tw.theme.colors["primary"].DEFAULT,
      value: props.activeEphemeralStorage + props.pendingEphemeralStorage
    },
    {
      id: "active-persistent",
      label: "Active persistent",
      color: tw.theme.colors["primary"].visited,
      value: props.activePersistentStorage + props.pendingPersistentStorage
    },
    {
      id: "available-emphemeral",
      label: "Available emphemeral",
      color: resolvedTheme === "dark" ? tw.theme.colors.neutral[800] : tw.theme.colors.neutral[500],
      value: props.availableEphemeralStorage
    },
    {
      id: "available-persistent",
      label: "Available persistent",
      color: resolvedTheme === "dark" ? tw.theme.colors.neutral[600] : tw.theme.colors.neutral[300],
      value: props.availablePersistentStorage
    }
  ];
}

const usePieTheme = () => {
  const { resolvedTheme } = useTheme();
  const tw = useTailwind();
  return {
    text: {
      fill: "#fff",
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

const TooltipLabel = <R,>({ datum }: PieTooltipProps<R>) => (
  <BasicTooltip id={datum.label} value={datum.formattedValue} enableChip={true} color={datum.color} />
);

export default NetworkCapacity;
