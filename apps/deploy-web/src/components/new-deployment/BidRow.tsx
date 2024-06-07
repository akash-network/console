"use client";
import { useEffect } from "react";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { PricePerMonth } from "../shared/PricePerMonth";
import { PriceEstimateTooltip } from "../shared/PriceEstimateTooltip";
import { FavoriteButton } from "../shared/FavoriteButton";
import { AuditorButton } from "../providers/AuditorButton";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { getSplitText } from "@src/hooks/useShortText";
import { BidDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { useProviderStatus } from "@src/queries/useProvidersQuery";
import { Uptime } from "../providers/Uptime";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { hasSomeParentTheClass } from "@src/utils/domUtils";
import { getGpusFromAttributes } from "@src/utils/deploymentUtils";
import { TableCell, TableRow } from "../ui/table";
import { cn } from "@src/utils/styleUtils";
import { CustomTooltip } from "../shared/CustomTooltip";
import { Badge } from "../ui/badge";
import { WarningTriangle, CloudXmark } from "iconoir-react";
import Spinner from "../shared/Spinner";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

type Props = {
  bid: BidDto;
  selectedBid: BidDto;
  handleBidSelected: (bid: BidDto) => void;
  disabled: boolean;
  provider: ApiProviderList;
  isSendingManifest: boolean;
};

export const BidRow: React.FunctionComponent<Props> = ({ bid, selectedBid, handleBidSelected, disabled, provider, isSendingManifest }) => {
  const { favoriteProviders, updateFavoriteProviders } = useLocalNotes();
  const isFavorite = favoriteProviders.some(x => provider.owner === x);
  const isCurrentBid = selectedBid?.id === bid.id;
  const {
    isLoading: isLoadingStatus,
    refetch: fetchProviderStatus,
    error
  } = useProviderStatus(provider?.hostUri, {
    enabled: false,
    retry: false
  });
  const gpuModels = bid.resourcesOffer.flatMap(x => getGpusFromAttributes(x.resources.gpu.attributes));

  useEffect(() => {
    if (provider) {
      fetchProviderStatus();
    }
  }, [provider, fetchProviderStatus]);

  const onStarClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const newFavorites = isFavorite ? favoriteProviders.filter(x => x !== provider.owner) : favoriteProviders.concat([provider.owner]);

    updateFavoriteProviders(newFavorites);
  };

  const onRowClick = (event: React.MouseEvent) => {
    if (bid.state === "open" && !disabled && !isSendingManifest && hasSomeParentTheClass(event.target as HTMLElement, "bid-list-row")) {
      handleBidSelected(bid);
    }
  };

  return (
    <TableRow
      key={bid.id}
      className={cn("bid-list-row [&>td]:px-2 [&>td]:py-1", {
        ["cursor-pointer hover:bg-muted-foreground/10"]: bid.state === "open",
        [`border bg-green-100 dark:bg-green-900`]: isCurrentBid
      })}
      onClick={onRowClick}
    >
      <TableCell align="center">
        <div className="flex items-center justify-center whitespace-nowrap">
          <PricePerMonth denom={bid.price.denom} perBlockValue={udenomToDenom(bid.price.amount, 10)} className="text-xl" />
          <PriceEstimateTooltip denom={bid.price.denom} value={bid.price.amount} />
        </div>
      </TableCell>

      <TableCell align="center">
        {provider.ipRegion && provider.ipCountry ? (
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
        ) : (
          <div>-</div>
        )}
      </TableCell>

      <TableCell align="center" className="font-bold">
        {provider.uptime7d ? <Uptime value={provider.uptime7d} /> : <div>-</div>}
      </TableCell>

      <TableCell align="left">
        <div className="flex items-center">
          <FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />
          <div className="ml-2">
            {provider.name ? (
              <Link href={UrlService.providerDetail(provider.owner)} onClick={e => e.stopPropagation()}>
                {provider.name?.length > 20 ? (
                  <CustomTooltip title={provider.name}>
                    <span>{getSplitText(provider.name, 4, 13)}</span>
                  </CustomTooltip>
                ) : (
                  provider.name
                )}
              </Link>
            ) : (
              <div>
                <CustomTooltip title={provider.hostUri}>
                  <div>{getSplitText(provider.hostUri, 4, 13)}</div>
                </CustomTooltip>
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {gpuModels.length > 0 && (
        <TableCell align="center">
          <div className="space-x">
            {gpuModels.map(gpu => (
              <Badge key={`${gpu.vendor}-${gpu.model}`} className={cn("px-1 py-0 text-xs")} variant="default">
                {gpu.vendor}-{gpu.model}
              </Badge>
            ))}
          </div>
        </TableCell>
      )}

      <TableCell align="center">
        {provider.isAudited ? (
          <div className="flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Yes</span>
            <div className="ml-1">
              <AuditorButton provider={provider} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="text-sm text-muted-foreground">No</span>

            <CustomTooltip title={<>This provider is not audited, which may result in a lesser quality experience.</>}>
              <WarningTriangle className="ml-2 text-sm text-orange-600" />
            </CustomTooltip>
          </div>
        )}
      </TableCell>

      <TableCell align="center">
        <div className="flex h-[38px] items-center justify-center">
          {isLoadingStatus && (
            <div className="flex items-center justify-center">
              <Spinner size="small" />
            </div>
          )}
          {!isLoadingStatus && !!error && !isSendingManifest && (
            <div className="mt-2 flex items-center space-x-2">
              <CloudXmark className="text-xs text-primary" />
              <span className="text-sm text-muted-foreground">OFFLINE</span>
            </div>
          )}

          {!isLoadingStatus && !error && !isSendingManifest && (
            <>
              {bid.state !== "open" || disabled ? (
                <div className="flex items-center justify-center">
                  <Badge color={bid.state === "active" ? "success" : "error"} className="h-4 text-xs">
                    {bid.state}
                  </Badge>
                </div>
              ) : (
                <RadioGroup>
                  <RadioGroupItem
                    value={bid.id}
                    id={bid.id}
                    checked={isCurrentBid}
                    onChange={() => handleBidSelected(bid)}
                    disabled={bid.state !== "open" || disabled}
                  />
                </RadioGroup>
              )}
            </>
          )}

          {isSendingManifest && isCurrentBid && (
            <div className="flex items-center justify-center whitespace-nowrap">
              <Badge variant="success">Deploying! 🚀</Badge>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};
