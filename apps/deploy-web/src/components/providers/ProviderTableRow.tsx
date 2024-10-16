"use client";
import React from "react";
import { Badge, CustomNoDivTooltip, CustomTooltip, TableCell, TableRow } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { WarningCircle } from "iconoir-react";
import { useRouter } from "next/navigation";

import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { getSplitText } from "@src/hooks/useShortText";
import { ClientProviderList } from "@src/types/provider";
import { createFilterUnique } from "@src/utils/array";
import { hasSomeParentTheClass } from "@src/utils/domUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { bytesToShrink } from "@src/utils/unitUtils";
import { UrlService } from "@src/utils/urlUtils";
import { FavoriteButton } from "../shared/FavoriteButton";
import { AuditorButton } from "./AuditorButton";
import { CapacityIcon } from "./CapacityIcon";
import { Uptime } from "./Uptime";

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
  const gpuModels = provider.gpuModels.map(x => x.model).filter(createFilterUnique());

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
              <span className="text-xs">{getSplitText(provider.name, 4, 13)}</span>
            </CustomTooltip>
          ) : (
            <span className="text-xs">{provider.name}</span>
          )}
        </TableCell>
      ) : (
        <TableCell>
          {provider.hostUri?.length > 20 ? (
            <CustomTooltip title={provider.hostUri}>
              <span className="text-xs">{getSplitText(provider.hostUri, 4, 13)}</span>
            </CustomTooltip>
          ) : (
            <span className="text-xs">{provider.hostUri}</span>
          )}
        </TableCell>
      )}
      <TableCell className="text-center">
        {provider.ipRegion && provider.ipCountry && (
          <CustomTooltip
            title={
              <>
                {provider.ipRegion}, {provider.ipCountry}
              </>
            }
          >
            <div className="text-xs">
              {provider.ipRegionCode}, {provider.ipCountryCode}
            </div>
          </CustomTooltip>
        )}
      </TableCell>
      <TableCell className="text-center font-bold">{provider.isOnline && <Uptime value={provider.uptime7d} />}</TableCell>
      <TableCell className="text-center">
        <CustomTooltip title={`You have ${provider.userActiveLeases} active lease${(provider.userActiveLeases || 0) > 1 ? "s" : ""} with this provider.`}>
          <div className="inline-flex items-center space-x-1">
            <span>{provider.leaseCount}</span>
            {(provider.userActiveLeases || 0) > 0 && (
              <span
                className={cn("text-xs text-muted-foreground", {
                  ["font-bold text-primary"]: (provider.userActiveLeases || 0) > 0
                })}
              >
                &nbsp;({provider.userActiveLeases})
              </span>
            )}
          </div>
        </CustomTooltip>
      </TableCell>
      <TableCell>
        {provider.isOnline && (
          <div className="flex items-center">
            <CapacityIcon value={(activeCPU + pendingCPU) / totalCPU} fontSize="small" />
            <span className="whitespace-nowrap text-xs">
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
              <span className="whitespace-nowrap text-xs">
                {Math.round(activeGPU + pendingGPU)}/{Math.round(totalGPU)}
              </span>
            </div>
            <div className="mt-1 inline-flex flex-nowrap items-center space-x-1 text-center">
              {gpuModels.slice(0, 2).map(gpu => (
                <Badge key={gpu} className="h-4 px-1 py-0 text-xs">
                  <small>{gpu}</small>
                </Badge>
              ))}

              {gpuModels.length > 2 && (
                <CustomNoDivTooltip
                  title={
                    <div className="space-x-1">
                      {gpuModels.map(gpu => (
                        <Badge key={gpu} className="px-1 py-0 text-xs">
                          {gpu}
                        </Badge>
                      ))}
                    </div>
                  }
                >
                  <div className="inline-flex">
                    <Badge className="h-4 px-1 py-0 text-xs">
                      <small>{`+${gpuModels.length - 2}`}</small>
                    </Badge>
                  </div>
                </CustomNoDivTooltip>
              )}
            </div>
          </div>
        )}
      </TableCell>

      <TableCell>
        {provider.isOnline && _activeMemory && _totalMemory && (
          <div className="flex items-center">
            <CapacityIcon
              value={
                (provider.activeStats.memory + provider.pendingStats.memory) /
                (provider.availableStats.memory + provider.pendingStats.memory + provider.activeStats.memory)
              }
              fontSize="small"
            />
            <span className="whitespace-nowrap text-xs">
              <Unit value={roundDecimal(_activeMemory.value, 0)} unit={_activeMemory.unit} />
              /
              <Unit value={roundDecimal(_totalMemory.value, 0)} unit={_totalMemory.unit} />
            </span>
          </div>
        )}
      </TableCell>
      <TableCell>
        {provider.isOnline && _activeStorage && _totalStorage && (
          <div className="flex items-center">
            <CapacityIcon
              value={
                (provider.activeStats.storage + provider.pendingStats.storage) /
                (provider.availableStats.storage + provider.pendingStats.storage + provider.activeStats.storage)
              }
              fontSize="small"
            />
            <span className="whitespace-nowrap text-xs">
              <Unit value={roundDecimal(_activeStorage.value, 0)} unit={_activeStorage.unit} />
              /
              <Unit value={roundDecimal(_totalStorage.value, 0)} unit={_totalStorage.unit} />
            </span>
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center">
          {provider.isAudited ? (
            <>
              <span className="text-xs">Yes</span>
              <AuditorButton provider={provider} />
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">No</span>
              <WarningCircle className="ml-2 text-xs text-warning" />
            </>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />
      </TableCell>
    </TableRow>
  );
};

const Unit: React.FunctionComponent<{ value: number; unit: string }> = ({ value, unit }) => {
  return (
    <span>
      {value}
      {value > 0 && <small className="text-muted-foreground">{unit}</small>}
    </span>
  );
};
