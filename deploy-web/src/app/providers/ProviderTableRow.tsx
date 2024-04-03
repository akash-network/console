"use client";
import { ClientProviderList } from "@src/types/provider";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { FavoriteButton } from "../../components/shared/FavoriteButton";
import { AuditorButton } from "../../components/providers/AuditorButton";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { CapacityIcon } from "./CapacityIcon";
import { CustomTooltip } from "../../components/shared/CustomTooltip";
import { getSplitText } from "@src/hooks/useShortText";
import { useRouter } from "next/navigation";
import { UrlService } from "@src/utils/urlUtils";
import { Uptime } from "../../components/providers/Uptime";
import React from "react";
import { hasSomeParentTheClass } from "@src/utils/domUtils";
import { TableCell, TableRow } from "@src/components/ui/table";
import { cn } from "@src/utils/styleUtils";
import { Badge } from "@src/components/ui/badge";
import { WarningCircle } from "iconoir-react";

// const useStyles = makeStyles()(theme => ({
//   root: {
//     cursor: "pointer",
//     transition: "background-color .2s ease",
//     "& td": {
//       fontSize: ".8rem"
//     },
//     "&:hover": {
//       backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[300]
//     }
//   },
//   gpuChip: {
//     height: "16px",
//     fontSize: ".6rem",
//     fontWeight: "bold"
//   },
//   gpuChipLabel: {
//     padding: "0 4px"
//   }
// }));

type Props = {
  provider: ClientProviderList;
};

export const ProviderListRow: React.FunctionComponent<Props> = ({ provider }) => {
  const router = useRouter();
  const { favoriteProviders, updateFavoriteProviders } = useLocalNotes();
  const isFavorite = favoriteProviders.some(x => provider.owner === x);
  const activeCPU = provider.isOnline ? provider.activeStats.cpu / 1000 : 0;
  const pendingCPU = provider.isOnline ? provider.pendingStats.cpu / 1000 : 0;
  const totalCPU = provider.isOnline ? (provider.availableStats.cpu + provider.pendingStats.cpu + provider.activeStats.cpu) / 1000 : 0;
  const activeGPU = provider.isOnline ? provider.activeStats.gpu : 0;
  const pendingGPU = provider.isOnline ? provider.pendingStats.gpu : 0;
  const totalGPU = provider.isOnline ? provider.availableStats.gpu + provider.pendingStats.gpu + provider.activeStats.gpu : 0;
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
    <TableRow className="provider-list-row cursor-pointer hover:bg-muted-foreground/10 [&>td]:px-2 [&>td]:py-1" onClick={onRowClick}>
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
        <CustomTooltip title={`You have ${provider.userActiveLeases} active lease${(provider.userActiveLeases || 0) > 1 ? "s" : ""} with this provider.`}>
          <div>
            {provider.leaseCount}
            {(provider.userActiveLeases || 0) > 0 && (
              <p
                className={cn("text-sm text-muted-foreground", {
                  ["font-bold"]: (provider.userActiveLeases || 0) > 0,
                  ["text-primary"]: (provider.userActiveLeases || 0) > 0
                })}
                // sx={{ color: provider.userActiveLeases > 0 ? theme.palette.secondary.main : "", fontWeight: provider.userActiveLeases > 0 ? "bold" : "" }}
              >
                &nbsp;({provider.userActiveLeases})
              </p>
            )}
          </div>
        </CustomTooltip>
      </TableCell>
      <TableCell align="left">
        {provider.isOnline && (
          <div className="flex items-center">
            <CapacityIcon value={(activeCPU + pendingCPU) / totalCPU} fontSize="small" />
            <span className="text-xs text-primary">
              {Math.round(activeCPU + pendingCPU)}/{Math.round(totalCPU)}
            </span>
          </div>
        )}
      </TableCell>

      <TableCell align="left">
        {provider.isOnline && (
          <div className="flex items-center">
            <div className="flex w-[65px] items-center">
              <CapacityIcon value={(activeGPU + pendingGPU) / totalGPU} fontSize="small" />
              <span className="text-xs text-primary">
                {Math.round(activeGPU + pendingGPU)}/{Math.round(totalGPU)}
              </span>
            </div>
            <div className="mt-1 text-center">
              {gpuModels.slice(0, 2).map((gpu, i) => (
                <Badge
                  key={gpu}
                  // className={classes.gpuChip}
                  // classes={{ label: classes.gpuChipLabel }}
                  className={cn({ ["mr-1"]: i < gpuModels.length })}
                >
                  {gpu}
                </Badge>
              ))}

              {gpuModels.length > 2 && (
                <CustomTooltip
                  title={
                    <div>
                      {gpuModels.map((gpu, i) => (
                        <Badge
                          key={gpu}
                          // className={classes.gpuChip}
                          // classes={{ label: classes.gpuChipLabel }}
                          className={cn({ ["mr-1"]: i < gpuModels.length })}
                        >
                          {gpu}
                        </Badge>
                      ))}
                    </div>
                  }
                >
                  <Badge>{`+${gpuModels.length - 2}`}</Badge>
                </CustomTooltip>
              )}
            </div>
          </div>
        )}
      </TableCell>

      <TableCell align="left">
        {provider.isOnline && _activeMemory && _totalMemory && (
          <div className="flex items-center">
            <CapacityIcon
              value={
                (provider.activeStats.memory + provider.pendingStats.memory) /
                (provider.availableStats.memory + provider.pendingStats.memory + provider.activeStats.memory)
              }
              fontSize="small"
            />
            <span className="text-sm text-primary">
              <Unit value={roundDecimal(_activeMemory.value, 0)} unit={_activeMemory.unit} />
              /
              <Unit value={roundDecimal(_totalMemory.value, 0)} unit={_totalMemory.unit} />
            </span>
          </div>
        )}
      </TableCell>
      <TableCell align="left">
        {provider.isOnline && _activeStorage && _totalStorage && (
          <div className="flex items-center">
            <CapacityIcon
              value={
                (provider.activeStats.storage + provider.pendingStats.storage) /
                (provider.availableStats.storage + provider.pendingStats.storage + provider.activeStats.storage)
              }
              fontSize="small"
            />
            <span className="text-sm text-primary">
              <Unit value={roundDecimal(_activeStorage.value, 0)} unit={_activeStorage.unit} />
              /
              <Unit value={roundDecimal(_totalStorage.value, 0)} unit={_totalStorage.unit} />
            </span>
          </div>
        )}
      </TableCell>
      <TableCell align="center">
        <div className="flex items-center">
          {provider.isAudited ? (
            <>
              <span className="text-sm text-primary">Yes</span>
              <AuditorButton provider={provider} />
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">No</span>
              <WarningCircle className="ml-2 text-sm text-warning" />
            </>
          )}
        </div>
      </TableCell>
      <TableCell align="center">
        <FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />
      </TableCell>
    </TableRow>
  );
};

const Unit: React.FunctionComponent<{ value: number; unit: string }> = ({ value, unit }) => {
  return (
    <p className="text-sm text-muted-foreground">
      {value}
      {value > 0 && (
        <small
          className="text-xs"
          // sx={{ fontSize: ".5rem" }}
        >
          {unit}
        </small>
      )}
    </p>
  );
};
