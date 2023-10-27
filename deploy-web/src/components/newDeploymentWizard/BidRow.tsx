import { Radio, Box, Chip, TableCell, CircularProgress, Typography } from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { useEffect } from "react";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { PricePerMonth } from "../shared/PricePerMonth";
import { PriceEstimateTooltip } from "../shared/PriceEstimateTooltip";
import { FavoriteButton } from "../shared/FavoriteButton";
import { AuditorButton } from "../providers/AuditorButton";
import { makeStyles } from "tss-react/mui";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { CustomTableRow } from "../shared/CustomTable";
import { CustomTooltip } from "../shared/CustomTooltip";
import { getSplitText } from "@src/hooks/useShortText";
import { BidDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { useProviderStatus } from "@src/queries/useProvidersQuery";
import { cx } from "@emotion/css";
import { Uptime } from "../providers/Uptime";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { hasSomeParentTheClass } from "@src/utils/domUtils";

const useStyles = makeStyles()(theme => ({
  root: {
    cursor: "pointer",
    transition: "background-color .2s ease",
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[300]
    }
  },
  selectedRow: {
    backgroundColor: `${theme.palette.mode === "dark" ? theme.palette.grey[700] : theme.palette.grey[400]} !important`
  },
  secondaryText: {
    fontSize: ".8rem"
  },
  chip: {
    height: ".9rem",
    fontSize: ".7rem",
    lineHeight: ".7rem"
  },
  priceTooltip: {
    display: "flex",
    alignItems: "center",
    color: theme.palette.grey[600]
  },
  pricePerMonth: {
    fontSize: "1.25rem"
  },
  bidState: {
    marginBottom: "4px"
  },
  providerOffline: {
    marginTop: "4px"
  },
  stateIcon: {
    marginRight: ".5rem"
  },
  stateActive: {
    color: theme.palette.secondary.main
  },
  stateInactive: {
    color: theme.palette.primary.main
  },
  flexCenter: {
    display: "flex",
    alignItems: "center"
  }
}));

type Props = {
  bid: BidDto;
  selectedBid: BidDto;
  handleBidSelected: (bid: BidDto) => void;
  disabled: boolean;
  provider: ApiProviderList;
  isSendingManifest: boolean;
};

export const BidRow: React.FunctionComponent<Props> = ({ bid, selectedBid, handleBidSelected, disabled, provider, isSendingManifest }) => {
  const { classes } = useStyles();
  const { favoriteProviders, updateFavoriteProviders } = useLocalNotes();
  const isFavorite = favoriteProviders.some(x => provider.owner === x);
  const isCurrentBid = selectedBid?.id === bid.id;
  const {
    data: providerStatus,
    isLoading: isLoadingStatus,
    refetch: fetchProviderStatus,
    error
  } = useProviderStatus(provider?.hostUri, {
    enabled: false,
    retry: false
  });

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
    <CustomTableRow
      key={bid.id}
      className={cx({ [classes.root]: bid.state === "open", [classes.selectedRow]: isCurrentBid }, "bid-list-row")}
      onClick={onRowClick}
    >
      <TableCell align="center">
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PricePerMonth denom={bid.price.denom} perBlockValue={udenomToDenom(bid.price.amount, 10)} className={classes.pricePerMonth} />
          <PriceEstimateTooltip denom={bid.price.denom} value={bid.price.amount} />
        </Box>
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

      <TableCell align="center">
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
      </TableCell>

      <TableCell align="center">
        <FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />
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
        {isLoadingStatus && (
          <Box sx={{ height: "42px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress size="1.5rem" color="secondary" />
          </Box>
        )}
        {!isLoadingStatus && error && !isSendingManifest && (
          <div className={cx(classes.flexCenter, classes.providerOffline)}>
            <CloudOffIcon className={cx(classes.stateIcon, classes.stateInactive)} fontSize="small" />
            <strong>OFFLINE</strong>
          </div>
        )}

        {!isLoadingStatus && !error && !isSendingManifest && (
          <>
            {bid.state !== "open" || disabled ? (
              <Box>
                <Chip label={bid.state} size="small" color={bid.state === "active" ? "success" : "error"} classes={{ root: classes.chip }} />
              </Box>
            ) : (
              <Radio
                checked={isCurrentBid}
                onChange={() => handleBidSelected(bid)}
                value={bid.id}
                name="radio-button-demo"
                disabled={bid.state !== "open" || disabled}
                size="medium"
                color="success"
              />
            )}
          </>
        )}

        {isSendingManifest && isCurrentBid && <Chip label="Deploying! 🚀" size="small" color="success" />}
      </TableCell>
    </CustomTableRow>
  );
};
