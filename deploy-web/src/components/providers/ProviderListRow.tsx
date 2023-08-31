import { makeStyles } from "tss-react/mui";
import { Box, TableCell, Typography, useTheme } from "@mui/material";
import { MergedProvider } from "@src/types/provider";
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
import { FormattedNumber } from "react-intl";
import { Uptime } from "./Uptime";
import { useSelectedNetwork } from "@src/utils/networks";

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
  provider: MergedProvider;
};

export const ProviderListRow: React.FunctionComponent<Props> = ({ provider }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { favoriteProviders, updateFavoriteProviders } = useLocalNotes();
  const isFavorite = favoriteProviders.some(x => provider.owner === x);
  const activeCPU = provider.isActive ? provider.activeStats.cpu / 1000 : 0;
  const pendingCPU = provider.isActive ? provider.pendingStats.cpu / 1000 : 0;
  const totalCPU = provider.isActive ? (provider.availableStats.cpu + provider.pendingStats.cpu + provider.activeStats.cpu) / 1000 : 0;
  const activeGPU = provider.isActive && provider.activeStats.gpu;
  const pendingGPU = provider.isActive && provider.pendingStats.gpu;
  const totalGPU = provider.isActive && provider.availableStats.gpu + provider.pendingStats.gpu + provider.activeStats.gpu;
  const _activeMemory = provider.isActive ? bytesToShrink(provider.activeStats.memory + provider.pendingStats.memory) : null;
  const _totalMemory = provider.isActive ? bytesToShrink(provider.availableStats.memory + provider.pendingStats.memory + provider.activeStats.memory) : null;
  const _activeStorage = provider.isActive ? bytesToShrink(provider.activeStats.storage + provider.pendingStats.storage) : null;
  const _totalStorage = provider.isActive
    ? bytesToShrink(provider.availableStats.storage + provider.pendingStats.storage + provider.activeStats.storage)
    : null;

  const onStarClick = event => {
    event.preventDefault();
    event.stopPropagation();

    const newFavorites = isFavorite ? favoriteProviders.filter(x => x !== provider.owner) : favoriteProviders.concat([provider.owner]);

    updateFavoriteProviders(newFavorites);
  };

  const onRowClick = () => {
    router.push(UrlService.providerDetail(provider.owner));
  };

  return (
    <CustomTableRow className={classes.root} onClick={onRowClick}>
      {provider.isActive ? (
        <TableCell>
          {provider.name?.length > 25 ? (
            <CustomTooltip title={provider.name}>
              <div>{getSplitText(provider.name, 10, 10)}</div>
            </CustomTooltip>
          ) : (
            provider.name
          )}
        </TableCell>
      ) : (
        <TableCell>
          {provider.host_uri?.length > 25 ? (
            <CustomTooltip title={provider.host_uri}>
              <div>{getSplitText(provider.host_uri, 10, 10)}</div>
            </CustomTooltip>
          ) : (
            provider.host_uri
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
      <TableCell align="center">{provider.isActive && <Uptime value={provider.uptime7d} />}</TableCell>
      <TableCell align="center">{provider.leaseCount}</TableCell>
      <TableCell
        align="center"
        sx={{ color: provider.userActiveLeases > 0 ? theme.palette.secondary.main : "", fontWeight: provider.userActiveLeases > 0 ? "bold" : "" }}
      >
        {provider.userActiveLeases}
      </TableCell>
      <TableCell align="center">
        {provider.isActive && (
          <CustomTooltip
            title={
              <Typography fontSize=".7rem" variant="caption">
                {Math.round(activeCPU + pendingCPU)}&nbsp;/&nbsp;{Math.round(totalCPU)}&nbsp;CPU
              </Typography>
            }
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <CapacityIcon value={(activeCPU + pendingCPU) / totalCPU} />
              <Typography variant="caption" color="textSecondary">
                <FormattedNumber style="percent" maximumFractionDigits={2} value={roundDecimal((activeCPU + pendingCPU) / totalCPU, 2)} />
              </Typography>
            </Box>
          </CustomTooltip>
        )}
      </TableCell>

      <TableCell align="center">
        {provider.isActive && (
          <CustomTooltip
            title={
              <Typography fontSize=".7rem" variant="caption">
                {Math.round(activeGPU + pendingGPU)}&nbsp;/&nbsp;{Math.round(totalGPU)}&nbsp;GPU
              </Typography>
            }
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <CapacityIcon value={(activeGPU + pendingGPU) / totalGPU} />
              {totalGPU > 0 && (
                <Typography variant="caption" color="textSecondary">
                  <FormattedNumber style="percent" maximumFractionDigits={2} value={roundDecimal((activeGPU + pendingGPU) / totalGPU, 2)} />
                </Typography>
              )}
            </Box>
          </CustomTooltip>
        )}
      </TableCell>

      <TableCell align="center">
        {provider.isActive && (
          <CustomTooltip
            title={
              <Typography fontSize=".7rem" variant="caption">
                {`${roundDecimal(_activeMemory.value, 2)} ${_activeMemory.unit}`}&nbsp;/&nbsp;{`${roundDecimal(_totalMemory.value, 2)} ${_totalMemory.unit}`}
              </Typography>
            }
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <CapacityIcon
                value={
                  (provider.activeStats.memory + provider.pendingStats.memory) /
                  (provider.availableStats.memory + provider.pendingStats.memory + provider.activeStats.memory)
                }
              />
              <Typography variant="caption" color="textSecondary">
                <FormattedNumber
                  style="percent"
                  maximumFractionDigits={2}
                  value={roundDecimal(
                    (provider.activeStats.memory + provider.pendingStats.memory) /
                      (provider.availableStats.memory + provider.pendingStats.memory + provider.activeStats.memory),
                    2
                  )}
                />
              </Typography>
            </Box>
          </CustomTooltip>
        )}
      </TableCell>
      <TableCell align="center">
        {provider.isActive && (
          <CustomTooltip
            title={
              <Typography fontSize=".7rem" variant="caption">
                {`${roundDecimal(_activeStorage.value, 2)} ${_activeStorage.unit}`}&nbsp;/&nbsp;
                {`${roundDecimal(_totalStorage.value, 2)} ${_activeStorage.unit}`}
              </Typography>
            }
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <CapacityIcon
                value={
                  (provider.activeStats.storage + provider.pendingStats.storage) /
                  (provider.availableStats.storage + provider.pendingStats.storage + provider.activeStats.storage)
                }
              />
              <Typography variant="caption" color="textSecondary">
                <FormattedNumber
                  style="percent"
                  maximumFractionDigits={2}
                  value={roundDecimal(
                    (provider.activeStats.storage + provider.pendingStats.storage) /
                      (provider.availableStats.storage + provider.pendingStats.storage + provider.activeStats.storage),
                    2
                  )}
                />
              </Typography>
            </Box>
          </CustomTooltip>
        )}
      </TableCell>
      <TableCell align="center">
        {provider.isAudited ? (
          <Box>
            <Typography variant="caption">Yes</Typography>
            <AuditorButton provider={provider} />
          </Box>
        ) : (
          <Typography variant="caption">No</Typography>
        )}
      </TableCell>
      <TableCell align="center">
        <FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />
        <Box display="flex" alignItems="center"></Box>
      </TableCell>
    </CustomTableRow>
  );
};
