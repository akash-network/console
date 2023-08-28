import React, { useState, useEffect } from "react";
import {
  Button,
  CircularProgress,
  Box,
  Typography,
  Menu,
  MenuItem,
  IconButton,
  TextField,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  Alert
} from "@mui/material";
import { BidGroup } from "./BidGroup";
import { useCertificate } from "../../context/CertificateProvider";
import { useAkashProviders } from "../../context/AkashProvider";
import { useSnackbar } from "notistack";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForward";
import InfoIcon from "@mui/icons-material/Info";
import { useLocalNotes } from "../../context/LocalNoteProvider";
import { makeStyles } from "tss-react/mui";
import { useRouter } from "next/router";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { useBidList } from "@src/queries/useBidQuery";
import { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import { sendManifestToProvider } from "@src/utils/deploymentUtils";
import { ManifestErrorSnackbar } from "../shared/ManifestErrorSnackbar";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { getDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { Snackbar } from "../shared/Snackbar";
import { deploymentData } from "@src/utils/deploymentData";
import { UrlService } from "@src/utils/urlUtils";
import { NextSeo } from "next-seo";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import ViewPanel from "../shared/ViewPanel";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { isProd, treasuryAddress } from "@src/utils/constants";
import { uaktToAKT } from "@src/utils/priceUtils";
import { PriceValue } from "../shared/PriceValue";
import { CustomTooltip } from "../shared/CustomTooltip";
import { BidDto } from "@src/types/deployment";
import { BidCountdownTimer } from "./BidCountdownTimer";

const yaml = require("js-yaml");

const useStyles = makeStyles()(theme => ({
  tooltip: {
    fontSize: "1rem",
    padding: ".5rem"
  },
  tooltipIcon: {
    fontSize: "1.5rem",
    color: theme.palette.text.secondary
  },
  marginLeft: {
    marginLeft: "1rem"
  },
  nowrap: {
    whiteSpace: "nowrap"
  }
}));

type Props = {
  dseq: string;
};

// Refresh bids every 7 seconds;
const REFRESH_BIDS_INTERVAL = 7000;
// Request every 7 seconds to a max of 5.5 minutes before deployments closes
const MAX_NUM_OF_BID_REQUESTS = Math.floor((5.5 * 60 * 1000) / REFRESH_BIDS_INTERVAL);
// Show a warning after 1 minute
const WARNING_NUM_OF_BID_REQUESTS = Math.round((60 * 1000) / REFRESH_BIDS_INTERVAL);

export const CreateLease: React.FunctionComponent<Props> = ({ dseq }) => {
  const [isSendingManifest, setIsSendingManifest] = useState(false);
  const [isFilteringFavorites, setIsFilteringFavorites] = useState(false);
  const [isFilteringAudited, setIsFilteringAudited] = useState(false);
  const [isCreatingLeases, setIsCreatingLeases] = useState(false);
  const [selectedBids, setSelectedBids] = useState<{ [gseq: string]: BidDto }>({});
  const [filteredBids, setFilteredBids] = useState<Array<string>>([]);
  const [search, setSearch] = useState("");
  const { address, signAndBroadcastTx } = useKeplr();
  const { localCert } = useCertificate();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState(null);
  const { classes } = useStyles();
  const [numberOfRequests, setNumberOfRequests] = useState(0);
  const { providers } = useAkashProviders();
  const warningRequestsReached = numberOfRequests > WARNING_NUM_OF_BID_REQUESTS;
  const maxRequestsReached = numberOfRequests > MAX_NUM_OF_BID_REQUESTS;
  const { favoriteProviders } = useLocalNotes();
  const { data: bids, isLoading: isLoadingBids } = useBidList(address, dseq, {
    initialData: [],
    refetchInterval: REFRESH_BIDS_INTERVAL,
    onSuccess: () => {
      setNumberOfRequests(prev => ++prev);
    },
    enabled: !maxRequestsReached && !isSendingManifest
  });
  const { data: deploymentDetail, refetch: getDeploymentDetail } = useDeploymentDetail(address, dseq, { refetchOnMount: false, enabled: false });
  const groupedBids = bids
    .sort((a, b) => parseFloat(a.price.amount) - parseFloat(b.price.amount))
    .reduce((a, b) => {
      a[b.gseq] = [...(a[b.gseq] || []), b];
      return a as { [key: number]: BidDto };
    }, {} as any);
  const dseqList = Object.keys(groupedBids).map(g => parseInt(g));
  const allClosed = bids.length > 0 && bids.every(bid => bid.state === "closed");

  useEffect(() => {
    getDeploymentDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter bids by search
  useEffect(() => {
    let fBids = [];
    if ((search || isFilteringFavorites || isFilteringAudited) && providers) {
      bids?.forEach(bid => {
        let isAdded = false;

        // Filter for search
        if (search) {
          const provider = providers.find(p => p.owner === bid.provider);
          // Filter by attribute value
          provider?.attributes.forEach(att => {
            if (att.value?.toLowerCase().includes(search.toLowerCase())) {
              fBids.push(bid.id);
              isAdded = true;
            }
          });

          if (!isAdded && provider.host_uri.includes(search)) {
            fBids.push(bid.id);
          }
        }

        // Filter for favorites
        if (!isAdded && !search && isFilteringFavorites) {
          const provider = favoriteProviders.find(p => p === bid.provider);

          if (provider) {
            fBids.push(bid.id);
            isAdded = true;
          }
        }

        // Filter for audited
        if (!isAdded && !search && isFilteringAudited) {
          const provider = providers.filter(x => x.isAudited).find(p => p.owner === bid.provider);

          if (provider) {
            fBids.push(bid.id);
          }
        }
      });
    } else {
      fBids = bids?.map(b => b.id) || [];
    }

    setFilteredBids(fBids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, bids, providers, isFilteringFavorites, isFilteringAudited]);

  const handleBidSelected = bid => {
    setSelectedBids({ ...selectedBids, [bid.gseq]: bid });
  };

  async function sendManifest(providerInfo, manifest) {
    try {
      const response = await sendManifestToProvider(providerInfo, manifest, dseq, localCert);

      return response;
    } catch (err) {
      enqueueSnackbar(<ManifestErrorSnackbar err={err} />, { variant: "error", autoHideDuration: null });
      throw err;
    }
  }

  /**
   * Create the leases
   */
  async function handleNext() {
    setIsCreatingLeases(true);

    const bidKeys = Object.keys(selectedBids);

    // Create the lease
    try {
      const messages = bidKeys.map(gseq => selectedBids[gseq]).map(bid => TransactionMessageData.getCreateLeaseMsg(bid));

      const response = await signAndBroadcastTx([...messages]);

      if (!response) throw new Error("Rejected transaction");

      event(AnalyticsEvents.CREATE_LEASE, {
        category: "deployments",
        label: "Create lease"
      });
    } catch (error) {
      // Rejected transaction
      setIsCreatingLeases(false);
      return;
    }

    setIsSendingManifest(true);

    const localDeploymentData = getDeploymentLocalData(dseq);
    if (localDeploymentData && localDeploymentData.manifest) {
      // Send the manifest

      const sendManifestKey = enqueueSnackbar(<Snackbar title="Deploying! 🚀" subTitle="Please wait a few seconds..." showLoading />, {
        variant: "info",
        autoHideDuration: null
      });

      try {
        const yamlJson = yaml.load(localDeploymentData.manifest);
        const mani = deploymentData.getManifest(yamlJson, true);

        for (let i = 0; i < bidKeys.length; i++) {
          const currentBid = selectedBids[bidKeys[i]];
          const provider = providers.find(x => x.owner === currentBid.provider);
          await sendManifest(provider, mani);
        }
      } catch (err) {
        console.error(err);
      }

      closeSnackbar(sendManifestKey);
    }

    event(AnalyticsEvents.SEND_MANIFEST, {
      category: "deployments",
      label: "Send manifest after creating lease"
    });

    router.replace(UrlService.deploymentDetails(dseq, "EVENTS", "events"));
  }

  async function handleCloseDeployment() {
    try {
      const message = TransactionMessageData.getCloseDeploymentMsg(address, dseq);
      const response = await signAndBroadcastTx([message]);

      if (response) {
        router.replace(UrlService.deploymentList());
      }
    } catch (error) {
      throw error;
    }
  }

  function handleMenuClick(ev) {
    setAnchorEl(ev.currentTarget);
  }

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const onSearchChange = event => {
    const value = event.target.value;
    setSearch(value);
  };

  return (
    <>
      <NextSeo title="Create Deployment - Create Lease" />

      <Box>
        {!isLoadingBids && bids.length > 0 && !allClosed && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: { xs: "column", sm: "column", md: "row" } }}>
            <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", width: { xs: "100%", sm: "100%", md: "auto" } }}>
              <TextField
                label="Search provider..."
                disabled={bids.length === 0 || isSendingManifest}
                value={search}
                onChange={onSearchChange}
                type="text"
                variant="outlined"
                fullWidth
                size="small"
                InputProps={{
                  endAdornment: search && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch("")}>
                        <CloseIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <Box margin="0 .5rem">
                <IconButton aria-label="settings" aria-haspopup="true" onClick={handleMenuClick} size="small">
                  <MoreHorizIcon fontSize="large" />
                </IconButton>
              </Box>
              <Menu
                id="bid-actions-menu"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right"
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right"
                }}
                onClick={handleMenuClose}
              >
                <MenuItem onClick={() => handleCloseDeployment()}>Close Deployment</MenuItem>
              </Menu>
            </Box>

            <Box
              sx={{ display: "flex", alignItems: "center", width: { xs: "100%", sm: "100%", md: "auto" }, margin: { xs: ".5rem 0", sm: ".4rem 0", md: "0" } }}
            >
              {/* <Typography
                variant="caption"
                color="textSecondary"
                sx={{ textAlign: "center", padding: "0 .5rem", lineHeight: "1rem", fontSize: ".65rem", whiteSpace: "nowrap" }}
              >
                Cloudmos fee
                <br />
                {uaktToAKT(cloudmosFee.fee)} AKT | <PriceValue value={uaktToAKT(cloudmosFee.fee)} />
              </Typography> */}
              <Button
                variant="contained"
                color="secondary"
                onClick={handleNext}
                classes={{ text: classes.nowrap }}
                sx={{ width: { xs: "100%", sm: "100%", md: "auto" } }}
                disabled={dseqList.some(gseq => !selectedBids[gseq]) || isSendingManifest || isCreatingLeases}
              >
                {isCreatingLeases ? (
                  <CircularProgress size="24px" color="secondary" />
                ) : (
                  <>
                    Accept Bid{dseqList.length > 1 ? "s" : ""}
                    <Box component="span" marginLeft=".5rem" display="flex" alignItems="center">
                      <ArrowForwardIosIcon fontSize="small" />
                    </Box>
                  </>
                )}
              </Button>
            </Box>
          </Box>
        )}

        <Box display="flex" alignItems="center">
          {!isLoadingBids && (allClosed || bids.length === 0) && (
            <Button variant="contained" color="secondary" onClick={handleCloseDeployment} size="small">
              Close Deployment
            </Button>
          )}
        </Box>

        {(isLoadingBids || bids.length === 0) && !maxRequestsReached && !isSendingManifest && (
          <Box textAlign="center" paddingTop="1rem">
            <CircularProgress color="secondary" size="4rem" />
            <Box paddingTop="1rem">
              <Typography variant="body1">Waiting for bids...</Typography>
            </Box>
          </Box>
        )}

        {warningRequestsReached && !maxRequestsReached && bids.length === 0 && (
          <Box paddingTop="1rem">
            <Alert variant="standard" severity="info">
              There should be bids by now... You can wait longer in case a bid shows up or close the deployment and try again with a different configuration.
            </Alert>
          </Box>
        )}

        {maxRequestsReached && bids.length === 0 && (
          <Box paddingTop="1rem">
            <Alert variant="standard" severity="warning">
              There's no bid for the current deployment. You can close the deployment and try again with a different configuration.
            </Alert>
          </Box>
        )}

        {bids.length > 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexDirection: { xs: "column", sm: "column", md: "row" },
              marginBottom: { xs: ".2rem", sm: ".2rem", md: 0 }
            }}
          >
            <Box sx={{ display: "flex", alignItem: "center", width: { xs: "100%", sm: "100%", md: "auto" } }}>
              <FormControlLabel
                control={<Checkbox checked={isFilteringFavorites} onChange={(ev, value) => setIsFilteringFavorites(value)} color="secondary" size="small" />}
                label="Favorites"
              />

              <FormControlLabel
                control={<Checkbox checked={isFilteringAudited} onChange={(ev, value) => setIsFilteringAudited(value)} color="secondary" size="small" />}
                label="Audited"
              />

              {!isLoadingBids && allClosed && (
                <Box sx={{ display: "flex", alignItems: "center", marginLeft: "1rem" }}>
                  <CustomTooltip
                    arrow
                    title={
                      <Alert severity="warning" variant="outlined">
                        All bids for this deployment are closed. This can happen if no bids are accepted for more than 5 minutes after the deployment creation.
                        You can close this deployment and create a new one.
                      </Alert>
                    }
                  >
                    <InfoIcon color="error" fontSize="small" />
                  </CustomTooltip>
                </Box>
              )}
            </Box>

            {!isSendingManifest && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  marginLeft: { xs: 0, sm: 0, md: "1rem" },
                  marginTop: { xs: ".2rem", sm: ".2rem", md: 0 },
                  alignSelf: { xs: "start", sm: "center" }
                }}
              >
                <BidCountdownTimer height={bids?.length > 0 ? bids[0].dseq : null} />
              </Box>
            )}

            {!maxRequestsReached && !isSendingManifest && (
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "1rem", fontSize: ".7rem", alignSelf: { xs: "start", sm: "center" } }}>
                <Typography variant="caption" color="grey">
                  Waiting for more bids...
                </Typography>
                <Box marginLeft=".5rem">
                  <CircularProgress size=".7rem" color="secondary" />
                </Box>
              </Box>
            )}
          </Box>
        )}

        <LinearLoadingSkeleton isLoading={isSendingManifest} />
      </Box>

      {dseqList.length > 0 && (
        <ViewPanel stickToBottom style={{ overflow: "auto", paddingBottom: "2rem" }}>
          {dseqList.map((gseq, i) => (
            <BidGroup
              key={gseq}
              gseq={gseq}
              bids={groupedBids[gseq]}
              handleBidSelected={handleBidSelected}
              selectedBid={selectedBids[gseq]}
              disabled={isSendingManifest}
              providers={providers}
              filteredBids={filteredBids}
              deploymentDetail={deploymentDetail}
              isFilteringFavorites={isFilteringFavorites}
              isFilteringAudited={isFilteringAudited}
              groupIndex={i}
              totalBids={dseqList.length}
              isSendingManifest={isSendingManifest}
            />
          ))}
        </ViewPanel>
      )}
    </>
  );
};
