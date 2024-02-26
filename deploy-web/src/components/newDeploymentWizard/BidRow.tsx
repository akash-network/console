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
import { useTheme } from "next-themes";
import { CustomTooltip } from "../shared/CustomTooltip";
import { Badge } from "../ui/badge";
import { WarningTriangle, CloudXmark } from "iconoir-react";
import Spinner from "../shared/Spinner";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

// const useStyles = makeStyles()(theme => ({
//   root: {
//     cursor: "pointer",
//     transition: "background-color .2s ease",
//     "&:hover": {
//       backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[300]
//     }
//   },
//   selectedRow: {
//     backgroundColor: `${theme.palette.mode === "dark" ? darken(theme.palette.success.main, 0.8) : lighten(theme.palette.success.main, 0.8)} !important`,
//     border: "1px solid"
//   },
//   secondaryText: {
//     fontSize: ".8rem"
//   },
//   chip: {
//     height: "1rem",
//     fontSize: ".75rem",
//     lineHeight: ".75rem"
//   },
//   priceTooltip: {
//     display: "flex",
//     alignItems: "center",
//     color: theme.palette.grey[600]
//   },
//   pricePerMonth: {
//     fontSize: "1.25rem"
//   },
//   bidState: {
//     marginBottom: "4px"
//   },
//   providerOffline: {
//     marginTop: "4px",
//     fontSize: ".85rem"
//   },
//   stateIcon: {
//     marginRight: ".5rem"
//   },
//   stateActive: {
//     color: theme.palette.secondary.main
//   },
//   stateInactive: {
//     color: theme.palette.primary.contrastText
//   },
//   flexCenter: {
//     display: "flex",
//     alignItems: "center"
//   },
//   gpuChip: {
//     height: "16px",
//     fontSize: ".65rem",
//     fontWeight: "bold"
//   },
//   gpuChipLabel: {
//     padding: "0 4px"
//   }
// }));

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
  const { theme } = useTheme();
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

  //   root: {
  //     cursor: "pointer",
  //     transition: "background-color .2s ease",
  //     "&:hover": {
  //       backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[300]
  //     }
  //   },
  //   selectedRow: {
  //     backgroundColor: `${theme.palette.mode === "dark" ? darken(theme.palette.success.main, 0.8) : lighten(theme.palette.success.main, 0.8)} !important`,
  //     border: "1px solid"
  //   },

  return (
    <TableRow key={bid.id} className={cn({ ["hover: cursor-pointer"]: bid.state === "open", ["border-b"]: isCurrentBid }, "bid-list-row")} onClick={onRowClick}>
      <TableCell align="center">
        <div className="flex items-center justify-center">
          <PricePerMonth denom={bid.price.denom} perBlockValue={udenomToDenom(bid.price.amount, 10)} className="text-2xl" />
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

      <TableCell align="center">{provider.uptime7d ? <Uptime value={provider.uptime7d} /> : <div>-</div>}</TableCell>

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
          {gpuModels.map((gpu, i) => (
            //   gpuChip: {
            //     height: "16px",
            //     fontSize: ".65rem",
            //     fontWeight: "bold"
            //   },
            //   gpuChipLabel: {
            //     padding: "0 4px"
            //   }
            <Badge
              key={`${gpu.vendor}-${gpu.model}`}
              className={cn("h-[16px] px-1 py-0 text-xs font-bold", { ["mr-1"]: i < gpuModels.length })}
              // className={classes.gpuChip}
              // classes={{ label: classes.gpuChipLabel }}
              // sx={{ marginRight: i < gpuModels.length ? ".2rem" : 0 }}
              variant="default"
            >
              `${gpu.vendor}-${gpu.model}`
            </Badge>
          ))}
        </TableCell>
      )}

      <TableCell align="center">
        {provider.isAudited ? (
          <div>
            <span className="text-sm text-muted-foreground">Yes</span>
            <AuditorButton provider={provider} />
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
          {!isLoadingStatus && error && !isSendingManifest && (
            //   providerOffline: {
            //     marginTop: "4px",
            //     fontSize: ".85rem"
            //   },
            <div className="mt-2 flex items-center">
              <CloudXmark
                className="mr-2 text-primary"
                // className={cx(classes.stateIcon, classes.stateInactive)} sx={{ fontSize: "1rem" }}
              />
              <span className="text-sm text-muted-foreground">OFFLINE</span>
            </div>
          )}

          {!isLoadingStatus && !error && !isSendingManifest && (
            <>
              {bid.state !== "open" || disabled ? (
                <div className="flex items-center justify-center">
                  {/* //   chip: {
//     height: "1rem",
//     fontSize: ".75rem",
//     lineHeight: ".75rem"
//   }, */}
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
                // <Radio
                //   checked={isCurrentBid}
                //   onChange={() => handleBidSelected(bid)}
                //   value={bid.id}
                //   name="radio-button-demo"
                //   disabled={bid.state !== "open" || disabled}
                //   size="small"
                //   color="success"
                // />
              )}
            </>
          )}

          {isSendingManifest && isCurrentBid && (
            <div className="flex items-center justify-center">
              <Badge variant="success">Deploying! 🚀</Badge>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};
