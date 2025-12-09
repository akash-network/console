"use client";
import { useEffect } from "react";
import { Badge, CustomTooltip, RadioGroup, RadioGroupItem, Spinner, TableCell, TableRow } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CloudXmark, WarningTriangle } from "iconoir-react";

import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useProviderStatus } from "@src/queries/useProvidersQuery";
import type { BidDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { getGpusFromAttributes } from "@src/utils/deploymentUtils";
import { hasSomeParentTheClass } from "@src/utils/domUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { AuditorButton } from "../../providers/AuditorButton";
import { Uptime } from "../../providers/Uptime";
import { CopyTextToClipboardButton } from "../../shared/CopyTextToClipboardButton";
import { FavoriteButton } from "../../shared/FavoriteButton";
import { PriceEstimateTooltip } from "../../shared/PriceEstimateTooltip";
import { PricePerTimeUnit } from "../../shared/PricePerTimeUnit";
import { ProviderName } from "../../shared/ProviderName";

type Props = {
  bid: BidDto;
  selectedBid?: BidDto | null;
  handleBidSelected: (bid: BidDto) => void;
  disabled: boolean;
  provider?: ApiProviderList;
  isSendingManifest: boolean;
  components?: typeof COMPONENTS;
};

export const COMPONENTS = {
  Badge,
  CustomTooltip,
  RadioGroup,
  RadioGroupItem,
  Spinner,
  TableCell,
  TableRow,
  PricePerTimeUnit,
  PriceEstimateTooltip,
  FavoriteButton,
  ProviderName,
  CopyTextToClipboardButton,
  CloudXmark,
  Uptime,
  AuditorButton
};

export const BidRow: React.FunctionComponent<Props> = ({
  bid,
  selectedBid,
  handleBidSelected,
  disabled,
  provider,
  isSendingManifest,
  components: c = COMPONENTS
}) => {
  const { analyticsService } = useServices();
  const { favoriteProviders, updateFavoriteProviders } = useLocalNotes();
  const isFavorite = provider ? favoriteProviders.some(x => provider.owner === x) : false;
  const isCurrentBid = selectedBid?.id === bid.id;
  const {
    isLoading: isLoadingStatus,
    refetch: fetchProviderStatus,
    error
  } = useProviderStatus(provider, {
    enabled: false,
    retry: false
  });
  const gpuModels = bid.resourcesOffer.flatMap(x => getGpusFromAttributes(x.resources.gpu.attributes));

  useEffect(() => {
    if (provider) {
      fetchProviderStatus();
    }
  }, [provider, fetchProviderStatus]);

  const onStarClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!provider) return;

    const newFavorites = isFavorite ? favoriteProviders.filter(x => x !== provider.owner) : favoriteProviders.concat([provider.owner]);

    updateFavoriteProviders(newFavorites);
  };

  const onRowClick = (event: React.MouseEvent) => {
    analyticsService.track("bid_selected", "Amplitude");
    if (bid.state === "open" && !disabled && !isSendingManifest && hasSomeParentTheClass(event.target as HTMLElement, "bid-list-row")) {
      handleBidSelected(bid);
    }
  };

  return (
    <c.TableRow
      key={bid.id}
      className={cn("bid-list-row [&>td]:px-2 [&>td]:py-1", {
        ["cursor-pointer hover:bg-muted-foreground/10"]: bid.state === "open",
        [`border bg-green-100 dark:bg-green-900`]: isCurrentBid
      })}
      onClick={onRowClick}
    >
      <c.TableCell align="center">
        <div className="flex items-center justify-center whitespace-nowrap">
          <c.PricePerTimeUnit
            denom={bid.price.denom}
            perBlockValue={udenomToDenom(bid.price.amount, 10)}
            className="text-xl"
            showAsHourly={gpuModels.length > 0}
          />
          <c.PriceEstimateTooltip denom={bid.price.denom} value={bid.price.amount} showAsHourly={gpuModels.length > 0} />
        </div>
      </c.TableCell>

      <c.TableCell align="center">
        {provider?.ipRegion && provider?.ipCountry ? (
          <c.CustomTooltip
            title={
              <>
                {provider.ipRegion}, {provider.ipCountry}
              </>
            }
          >
            <div>
              {provider.ipRegionCode}, {provider.ipCountryCode}
            </div>
          </c.CustomTooltip>
        ) : (
          <div>-</div>
        )}
      </c.TableCell>

      <c.TableCell align="center" className="font-bold">
        {provider?.uptime7d ? <c.Uptime value={provider.uptime7d} /> : <div>-</div>}
      </c.TableCell>

      <c.TableCell align="left">
        <div className="flex items-center">
          <c.FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />
          <div className="ml-2">{provider ? <c.ProviderName provider={provider} /> : <div>-</div>}</div>
          <div className="pl-2">
            <c.CopyTextToClipboardButton value={provider?.name ?? provider?.hostUri ?? "-"} />
          </div>
        </div>
      </c.TableCell>

      {gpuModels.length > 0 && (
        <c.TableCell align="center">
          <div className="space-x">
            {gpuModels.map(gpu => (
              <c.Badge key={`${gpu.vendor}-${gpu.model}`} className={cn("px-1 py-0 text-xs")} variant="default">
                {gpu.vendor}-{gpu.model}
              </c.Badge>
            ))}
          </div>
        </c.TableCell>
      )}

      <c.TableCell align="center">
        {provider?.isAudited ? (
          <div className="flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Yes</span>
            <div className="ml-1">
              <c.AuditorButton provider={provider} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="text-sm text-muted-foreground">No</span>

            <c.CustomTooltip title={<>This provider is not audited, which may result in a lesser quality experience.</>}>
              <WarningTriangle className="ml-2 text-sm text-orange-600" />
            </c.CustomTooltip>
          </div>
        )}
      </c.TableCell>

      <c.TableCell align="center">
        <div className="flex h-[38px] items-center justify-center">
          {isLoadingStatus && (
            <div className="flex items-center justify-center">
              <c.Spinner size="small" />
            </div>
          )}
          {!isLoadingStatus && !!error && !isSendingManifest && (
            <div className="mt-2 flex items-center space-x-2">
              <c.CloudXmark className="text-xs text-primary" />
              <span className="text-sm text-muted-foreground">OFFLINE</span>
            </div>
          )}

          {!isLoadingStatus && !error && !isSendingManifest && (
            <>
              {bid.state !== "open" || disabled ? (
                <div className="flex items-center justify-center">
                  <c.Badge color={bid.state === "active" ? "success" : "error"} className="h-4 text-xs">
                    {bid.state}
                  </c.Badge>
                </div>
              ) : (
                <c.RadioGroup>
                  <c.RadioGroupItem
                    value={bid.id}
                    id={bid.id}
                    checked={isCurrentBid}
                    onChange={() => handleBidSelected(bid)}
                    disabled={bid.state !== "open" || disabled}
                    aria-label={provider?.name ?? provider?.hostUri ?? "Unknown Provider"}
                  />
                </c.RadioGroup>
              )}
            </>
          )}

          {isSendingManifest && isCurrentBid && (
            <div className="flex items-center justify-center whitespace-nowrap">
              <c.Badge variant="success">Deploying! 🚀</c.Badge>
            </div>
          )}
        </div>
      </c.TableCell>
    </c.TableRow>
  );
};
