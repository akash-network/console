"use client";
import { ResponsivePie } from "@nivo/pie";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import useTailwind from "@src/hooks/useTailwind";

type Props = {
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
};

const NetworkCapacity: React.FunctionComponent<Props> = ({
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
}) => {
  const { theme } = useTheme();
  const tw = useTailwind();
  const router = useRouter();
  const activeMemoryBytes = activeMemory + pendingMemory;
  const availableMemoryBytes = totalMemory - (activeMemory + pendingMemory);
  const activeStorageBytes = activeStorage + pendingStorage;
  const availableStorageBytes = totalStorage - (activeStorage + pendingStorage);
  const _activeMemory = bytesToShrink(activeMemoryBytes);
  const _totalMemory = bytesToShrink(totalMemory);
  const _availableMemory = bytesToShrink(availableMemoryBytes);
  const _activeStorage = bytesToShrink(activeStorageBytes);
  const _availableStorage = bytesToShrink(availableStorageBytes);
  const _totalStorage = bytesToShrink(totalStorage);
  const cpuData = useData(activeCPU + pendingCPU, totalCPU - activeCPU - pendingCPU);
  const gpuData = useData(activeGPU + pendingGPU, totalGPU - activeGPU - pendingGPU);
  const memoryData = useData(activeMemoryBytes, availableMemoryBytes);
  const storageData = useData(activeStorageBytes, availableStorageBytes);
  const pieTheme = usePieTheme();
  const flexBasis = "25%";

  const _getColor = bar => getColor(bar.id);

  const colors = {
    active: tw.theme.colors["primary"].DEFAULT,
    available: theme === "dark" ? tw.theme.colors.gray[800] : tw.theme.colors.gray[500]
  };

  const getColor = (id: string) => {
    return colors[id];
  };

  return (
    <div className="flex flex-col items-start md:flex-row md:items-center">
      <div className="basis-1/4">
        <p className="leading-4">CPU</p>
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
            colors={_getColor}
            borderWidth={0}
            borderColor={{
              from: "color",
              modifiers: [["darker", 0.2]]
            }}
            valueFormat={value => `${roundDecimal(value, 2)} CPU`}
            enableArcLinkLabels={false}
            arcLabelsSkipAngle={10}
            theme={pieTheme}
          />
        </div>
      </div>

      <div className="basis-1/4">
        <p className="leading-4">GPU</p>
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
            colors={_getColor}
            borderWidth={0}
            borderColor={{
              from: "color",
              modifiers: [["darker", 0.2]]
            }}
            valueFormat={value => `${roundDecimal(value, 2)} GPU`}
            enableArcLinkLabels={false}
            arcLabelsSkipAngle={10}
            theme={pieTheme}
          />
        </div>
      </div>

      <div className="basis-1/4">
        <p className="leading-4">Memory</p>
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
            colors={_getColor}
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
            arcLabelsSkipAngle={10}
            theme={pieTheme}
          />
        </div>
      </div>

      <div className="basis-1/4">
        <p className="leading-4">Storage</p>
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
            colors={_getColor}
            borderWidth={0}
            borderColor={{
              from: "color",
              modifiers: [["darker", 0.2]]
            }}
            valueFormat={value =>
              value === activeStorageBytes
                ? `${roundDecimal(_activeStorage.value, 2)} ${_activeStorage.unit}`
                : `${roundDecimal(_availableStorage.value, 2)} ${_availableStorage.unit}`
            }
            enableArcLinkLabels={false}
            arcLabelsSkipAngle={10}
            theme={pieTheme}
          />
        </div>
      </div>
    </div>
  );
};

const useData = (active: number, available: number) => {
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
      // TODO
      // color: tw.theme.colors["success"].DEFAULT
      color: tw.theme.colors.green[600]
    }
  ];
};

const usePieTheme = () => {
  const { theme } = useTheme();
  const tw = useTailwind();
  return {
    background: theme === "dark" ? tw.theme.colors["background"] : tw.theme.colors["background"],
    // background: theme === "dark" ? theme.palette.background.default : theme.palette.background.default,
    textColor: "#fff",
    fontSize: 12,
    tooltip: {
      basic: {
        color: theme === "dark" ? tw.theme.colors.white : tw.theme.colors.current
        // color: theme === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main
      },
      container: {
        backgroundColor: theme === "dark" ? tw.theme.colors.current : tw.theme.colors.white
        // backgroundColor: theme === "dark" ? theme.palette.primary.main : theme.palette.primary.contrastText
      }
    }
  };
};

export default NetworkCapacity;
