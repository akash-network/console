import { ResponsivePie } from "@nivo/pie";
import { Box, Typography, useTheme } from "@mui/material";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { useRouter } from "next/router";
import { useSelectedNetwork } from "@src/utils/networks";
import { mainnetId, testnetId } from "@src/utils/constants";

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
  const theme = useTheme();
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
  const selectedNetwork = useSelectedNetwork();
  const flexBasis = selectedNetwork.id === mainnetId ? "33.3333%" : "25%";

  const _getColor = bar => getColor(bar.id);

  const colors = {
    active: theme.palette.secondary.main,
    available: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[500]
  };

  const getColor = (id: string) => {
    return colors[id];
  };

  return (
    <Box sx={{ display: "flex", alignItems: { xs: "start", sm: "start", md: "center" }, flexDirection: { xs: "column", sm: "column", md: "row" } }}>
      <Box sx={{ flexBasis: flexBasis }}>
        <Typography variant="body1" sx={{ lineHeight: "1rem" }}>
          CPU
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {Math.round(activeCPU + pendingCPU)}&nbsp;CPU&nbsp;/&nbsp;{Math.round(totalCPU)}&nbsp;CPU
        </Typography>
        <Box sx={{ height: "200px", width: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        </Box>
      </Box>

      {selectedNetwork.id === testnetId && (
        <Box sx={{ flexBasis: flexBasis }}>
          <Typography variant="body1" sx={{ lineHeight: "1rem" }}>
            GPU
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {Math.round(activeGPU + pendingGPU)}&nbsp;GPU&nbsp;/&nbsp;{Math.round(totalGPU)}&nbsp;GPU
          </Typography>
          <Box sx={{ height: "200px", width: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
          </Box>
        </Box>
      )}

      <Box sx={{ flexBasis: flexBasis }}>
        <Typography variant="body1" sx={{ lineHeight: "1rem" }}>
          Memory
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {`${roundDecimal(_activeMemory.value, 2)} ${_activeMemory.unit}`}&nbsp;/&nbsp;{`${roundDecimal(_totalMemory.value, 2)} ${_totalMemory.unit}`}
        </Typography>
        <Box sx={{ height: "200px", width: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        </Box>
      </Box>

      <Box sx={{ flexBasis: flexBasis }}>
        <Typography variant="body1" sx={{ lineHeight: "1rem" }}>
          Storage
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {`${roundDecimal(_activeStorage.value, 2)} ${_activeStorage.unit}`}&nbsp;/&nbsp;{`${roundDecimal(_totalStorage.value, 2)} ${_activeStorage.unit}`}
        </Typography>
        <Box sx={{ height: "200px", width: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        </Box>
      </Box>
    </Box>
  );
};

const useData = (active: number, available: number) => {
  const theme = useTheme();

  return [
    {
      id: "active",
      label: "Active",
      value: active,
      color: theme.palette.secondary.main
    },
    {
      id: "available",
      label: "Available",
      value: available,
      color: theme.palette.success.main
    }
    // {
    //   id: "rewards",
    //   label: "Rewards",
    //   value: balances.rewards,
    //   color: colors.rewards
    // },
    // {
    //   id: "delegations",
    //   label: "Staked",
    //   value: balances.delegations,
    //   color: colors.delegations
    // },
    // {
    //   id: "redelegations",
    //   label: "Redelegations",
    //   value: balances.redelegations,
    //   color: colors.redelegations
    // },
    // {
    //   id: "unbondings",
    //   label: "Unbondings",
    //   value: balances.unbondings,
    //   color: colors.unbondings
    // }
  ];
};

const usePieTheme = () => {
  const theme = useTheme();
  return {
    background: theme.palette.mode === "dark" ? theme.palette.background.default : theme.palette.background.default,
    textColor: "#fff",
    fontSize: 12,
    tooltip: {
      basic: {
        color: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main
      },
      container: {
        backgroundColor: theme.palette.mode === "dark" ? theme.palette.primary.main : theme.palette.primary.contrastText
      }
    }
  };
};

export default NetworkCapacity;
