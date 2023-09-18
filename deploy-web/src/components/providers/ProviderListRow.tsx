import { makeStyles } from "tss-react/mui";
import { Box, Chip, TableCell, Typography, useTheme } from "@mui/material";
import { ClientProviderList } from "@src/types/provider";
import { CustomTableRow } from "../shared/CustomTable";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { FavoriteButton } from "../shared/FavoriteButton";
import { AuditorButton } from "./AuditorButton";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { CapacityIcon } from "./CapacityIcon";
import { CustomTooltip } from "../shared/CustomTooltip";
import { getSplitText } from "@src/hooks/useShortText";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { Uptime } from "./Uptime";
import React from "react";
import { hasSomeParentTheClass } from "@src/utils/domUtils";
import { cx } from "@emotion/css";
import CheckIcon from "@mui/icons-material/Check";
import NotInterestedIcon from "@mui/icons-material/NotInterested";

const useStyles = makeStyles()(theme => ({
  root: {
    cursor: "pointer",
    transition: "background-color .2s ease",
    "& td": {
      fontSize: ".8rem"
    },
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[300]
    }
  }
}));

type Props = {
  provider: ClientProviderList;
};

export const ProviderListRow: React.FunctionComponent<Props> = ({ provider }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { favoriteProviders, updateFavoriteProviders } = useLocalNotes();
  const isFavorite = favoriteProviders.some(x => provider.owner === x);
  const activeCPU = provider.isOnline ? provider.activeStats.cpu / 1000 : 0;
  const pendingCPU = provider.isOnline ? provider.pendingStats.cpu / 1000 : 0;
  const totalCPU = provider.isOnline ? (provider.availableStats.cpu + provider.pendingStats.cpu + provider.activeStats.cpu) / 1000 : 0;
  const activeGPU = provider.isOnline && provider.activeStats.gpu;
  const pendingGPU = provider.isOnline && provider.pendingStats.gpu;
  const totalGPU = provider.isOnline && provider.availableStats.gpu + provider.pendingStats.gpu + provider.activeStats.gpu;
  const _activeMemory = provider.isOnline ? bytesToShrink(provider.activeStats.memory + provider.pendingStats.memory) : null;
  const _totalMemory = provider.isOnline ? bytesToShrink(provider.availableStats.memory + provider.pendingStats.memory + provider.activeStats.memory) : null;
  const _activeStorage = provider.isOnline ? bytesToShrink(provider.activeStats.storage + provider.pendingStats.storage) : null;
  const _totalStorage = provider.isOnline
    ? bytesToShrink(provider.availableStats.storage + provider.pendingStats.storage + provider.activeStats.storage)
    : null;
  const gpuModels = provider.hardwareGpuModels.map(gpu => gpu.substring(gpu.lastIndexOf(" ") + 1, gpu.length));

  const onStarClick = event => {
    event.preventDefault();
    event.stopPropagation();

    const newFavorites = isFavorite ? favoriteProviders.filter(x => x !== provider.owner) : favoriteProviders.concat([provider.owner]);

    updateFavoriteProviders(newFavorites);
  };

  const onRowClick = (event: React.MouseEvent) => {
    if (hasSomeParentTheClass(event.target as HTMLElement, "provider-list-row")) {
      router.push(UrlService.providerDetail(provider.owner));
    }
  };

  return (
    <CustomTableRow className={cx(classes.root, "provider-list-row")} onClick={onRowClick}>
      {provider.isOnline ? (
        <TableCell>
          {provider.name?.length > 20 ? (
            <CustomTooltip title={provider.name}>
              <div>{getSplitText(provider.name, 4, 13)}</div>
            </CustomTooltip>
          ) : (
            provider.name
          )}
        </TableCell>
      ) : (
        <TableCell>
          {provider.hostUri?.length > 20 ? (
            <CustomTooltip title={provider.hostUri}>
              <div>{getSplitText(provider.hostUri, 4, 13)}</div>
            </CustomTooltip>
          ) : (
            provider.hostUri
          )}
        </TableCell>
      )}
      <TableCell>
        {provider.ipRegion && provider.ipCountry && (
          <CustomTooltip
            title={
              <>
                {provider.ipRegion}, {provider.ipCountry}
              </>
            }
          >
            <div>
              {provider.ipRegionCode}, {provider.ipCountryCode}
            </div>
          </CustomTooltip>
        )}
      </TableCell>
      <TableCell align="center">{provider.isOnline && <Uptime value={provider.uptime7d} />}</TableCell>
      <TableCell align="left">
        <CustomTooltip title={`You have ${provider.userActiveLeases} active lease${provider.userActiveLeases > 1 ? "s" : ""} with this provider.`}>
          <Box>
            {provider.leaseCount}
            {provider.userActiveLeases > 0 && (
              <Typography
                variant="caption"
                sx={{ color: provider.userActiveLeases > 0 ? theme.palette.secondary.main : "", fontWeight: provider.userActiveLeases > 0 ? "bold" : "" }}
              >
                &nbsp;({provider.userActiveLeases})
              </Typography>
            )}
          </Box>
        </CustomTooltip>
      </TableCell>
      <TableCell align="left">
        {provider.isOnline && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <CapacityIcon value={(activeCPU + pendingCPU) / totalCPU} fontSize="small" />
            <Typography fontSize=".7rem" variant="caption" color="textSecondary">
              {Math.round(activeCPU + pendingCPU)}/{Math.round(totalCPU)}
            </Typography>
          </Box>
        )}
      </TableCell>

      <TableCell align="left">
        {provider.isOnline && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CapacityIcon value={(activeGPU + pendingGPU) / totalGPU} fontSize="small" />
              <Typography variant="caption" color="textSecondary">
                {Math.round(activeGPU + pendingGPU)}/{Math.round(totalGPU)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "center", marginTop: ".2rem" }}>
              {gpuModels.map((gpu, i) => (
                <Chip
                  key={gpu}
                  label={gpu}
                  sx={{ marginRight: i < gpuModels.length ? ".2rem" : 0, height: "16px", fontSize: ".7rem", fontWeight: "bold" }}
                  color="secondary"
                  size="small"
                />
              ))}
            </Box>
          </>
        )}
      </TableCell>

      <TableCell align="left">
        {provider.isOnline && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <CapacityIcon
              value={
                (provider.activeStats.memory + provider.pendingStats.memory) /
                (provider.availableStats.memory + provider.pendingStats.memory + provider.activeStats.memory)
              }
              fontSize="small"
            />
            <Typography variant="caption" color="textSecondary">
              <Unit value={roundDecimal(_activeMemory.value, 0)} unit={_activeMemory.unit} />
              &nbsp;/&nbsp;
              <Unit value={roundDecimal(_totalMemory.value, 0)} unit={_totalMemory.unit} />
            </Typography>
          </Box>
        )}
      </TableCell>
      <TableCell align="left">
        {provider.isOnline && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <CapacityIcon
              value={
                (provider.activeStats.storage + provider.pendingStats.storage) /
                (provider.availableStats.storage + provider.pendingStats.storage + provider.activeStats.storage)
              }
            />
            <Typography variant="caption" color="textSecondary">
              <Unit value={roundDecimal(_activeStorage.value, 0)} unit={_activeStorage.unit} />
              &nbsp;/&nbsp;
              <Unit value={roundDecimal(_totalStorage.value, 0)} unit={_totalStorage.unit} />
            </Typography>
          </Box>
        )}
      </TableCell>
      <TableCell align="center">
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {provider.isAudited ? (
            <>
              <CheckIcon color="success" fontSize="small" />
              <AuditorButton provider={provider} />
            </>
          ) : (
            <>
              <NotInterestedIcon color="warning" fontSize="small" />
              <Typography variant="caption" color="textSecondary" sx={{ marginLeft: ".5rem" }}>
                No
              </Typography>
            </>
          )}
        </Box>
      </TableCell>
      <TableCell align="center">
        <FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />
        <Box display="flex" alignItems="center"></Box>
      </TableCell>
    </CustomTableRow>
  );
};

const Unit: React.FunctionComponent<{ value: number; unit: string }> = ({ value, unit }) => {
  return (
    <Typography variant="caption" color="textSecondary">
      {value}
      <Box component="small" sx={{ fontSize: ".6rem" }}>
        {unit}
      </Box>
    </Typography>
  );
};
