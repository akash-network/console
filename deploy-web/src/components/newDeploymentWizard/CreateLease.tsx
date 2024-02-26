"use client";
import React, { useState, useEffect } from "react";
import { BidGroup } from "./BidGroup";
import { useCertificate } from "../../context/CertificateProvider";
import { useLocalNotes } from "../../context/LocalNoteProvider";
import { useRouter } from "next/navigation";
import { useWallet } from "@src/context/WalletProvider";
import { useBidList } from "@src/queries/useBidQuery";
import { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import { sendManifestToProvider } from "@src/utils/deploymentUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { getDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { deploymentData } from "@src/utils/deploymentData";
import { UrlService } from "@src/utils/urlUtils";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import ViewPanel from "../shared/ViewPanel";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { CustomTooltip } from "../shared/CustomTooltip";
import { BidDto } from "@src/types/deployment";
import { BidCountdownTimer } from "./BidCountdownTimer";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { RouteStepKeys } from "@src/utils/constants";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { useToast } from "../ui/use-toast";
import { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";
import { Button } from "../ui/button";
import { Alert } from "../ui/alert";
import { Checkbox } from "../ui/checkbox";
import { ArrowRight, InfoCircle, UserBadgeCheck, Xmark, MoreHoriz } from "iconoir-react";
import Spinner from "../shared/Spinner";
import { InputWithIcon } from "../ui/input";
import { CustomDropdownLinkItem } from "../shared/CustomDropdownLinkItem";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu";

const yaml = require("js-yaml");

// const useStyles = makeStyles()(theme => ({
//   tooltip: {
//     fontSize: "1rem",
//     padding: ".5rem"
//   },
//   tooltipIcon: {
//     fontSize: "1.5rem",
//     color: theme.palette.text.secondary
//   },
//   marginLeft: {
//     marginLeft: "1rem"
//   },
//   nowrap: {
//     whiteSpace: "nowrap"
//   }
// }));

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
  const { address, signAndBroadcastTx } = useWallet();
  const { localCert } = useCertificate();
  const { toast, dismiss } = useToast();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState(null);
  const [numberOfRequests, setNumberOfRequests] = useState(0);
  const { data: providers } = useProviderList();
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
    ?.sort((a, b) => parseFloat(a.price.amount) - parseFloat(b.price.amount))
    .reduce((a, b) => {
      a[b.gseq] = [...(a[b.gseq] || []), b];
      return a as { [key: number]: BidDto };
    }, {} as any);
  const dseqList = Object.keys(groupedBids).map(g => parseInt(g));
  const allClosed = (bids?.length || 0) > 0 && bids?.every(bid => bid.state === "closed");

  useEffect(() => {
    getDeploymentDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter bids by search
  useEffect(() => {
    let fBids: string[] = [];
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

          if (!isAdded && provider?.hostUri.includes(search)) {
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
  }, [search, bids, providers, isFilteringFavorites, isFilteringAudited, favoriteProviders]);

  const handleBidSelected = bid => {
    setSelectedBids({ ...selectedBids, [bid.gseq]: bid });
  };

  async function sendManifest(providerInfo, manifest) {
    try {
      const response = await sendManifestToProvider(providerInfo, manifest, dseq, localCert as LocalCert);

      return response;
    } catch (err) {
      toast({ title: "Error", description: `Error while sending manifest to provider. ${err}`, variant: "destructive" });
      // return <Snackbar title="Error" subTitle={`Error while sending manifest to provider. ${err}`} iconVariant="error" />;
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

      // const sendManifestKey = enqueueSnackbar(<Snackbar title="Deploying! 🚀" subTitle="Please wait a few seconds..." showLoading />, {
      //   variant: "info",
      //   autoHideDuration: null
      // });
      const { id: sendManifestKey } = toast({ title: "Deploying! 🚀", description: "Please wait a few seconds...", loading: true, variant: "default" });

      try {
        const yamlJson = yaml.load(localDeploymentData.manifest);
        const mani = deploymentData.getManifest(yamlJson, true);

        for (let i = 0; i < bidKeys.length; i++) {
          const currentBid = selectedBids[bidKeys[i]];
          const provider = providers?.find(x => x.owner === currentBid.provider);
          await sendManifest(provider, mani);
        }
      } catch (err) {
        console.error(err);
      }
      dismiss(sendManifestKey);
      // closeSnackbar(sendManifestKey);
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
      <CustomNextSeo
        title="Create Deployment - Create Lease"
        url={`https://deploy.cloudmos.io${UrlService.newDeployment({ step: RouteStepKeys.createLeases })}`}
      />

      <div>
        {!isLoadingBids && (bids?.length || 0) > 0 && !allClosed && (
          <div
            className="flex flex-col items-center justify-between py-2 md:flex-row"
            // sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: { xs: "column", sm: "column", md: "row" } }}
          >
            <div
              className="flex w-full items-center md:w-auto"
              // sx={{ flexGrow: 1, display: "flex", alignItems: "center", width: { xs: "100%", sm: "100%", md: "auto" } }}
            >
              <InputWithIcon
                label="Search provider..."
                disabled={bids?.length === 0 || isSendingManifest}
                value={search}
                onChange={onSearchChange}
                type="text"
                className="w-full"
                endIcon={
                  search && (
                    <Button size="icon" onClick={() => setSearch("")}>
                      <Xmark />
                    </Button>
                  )
                }
                // InputProps={{
                //   endAdornment: search && <InputAdornment position="end"></InputAdornment>
                // }}
              />

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <div className="mx-2">
                    <Button size="icon" variant="ghost" onClick={handleMenuClick}>
                      <MoreHoriz />
                    </Button>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <CustomDropdownLinkItem onClick={() => handleCloseDeployment()}>Close Deployment</CustomDropdownLinkItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* <div className="mx-2">
                <Button aria-haspopup="true" onClick={handleMenuClick} size="small">
                  <MoreHorizIcon fontSize="large" />
                </Button>
              </div>
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
              </Menu> */}
            </div>

            <div
              className="flex w-full items-center py-2 md:w-auto md:py-0"
              // sx={{ display: "flex", alignItems: "center", width: { xs: "100%", sm: "100%", md: "auto" }, margin: { xs: ".5rem 0", sm: ".4rem 0", md: "0" } }}
            >
              <Button
                variant="default"
                color="secondary"
                onClick={handleNext}
                className="w-full whitespace-nowrap md:w-auto"
                // classes={{ text: classes.nowrap }}
                // sx={{ width: { xs: "100%", sm: "100%", md: "auto" } }}
                disabled={dseqList.some(gseq => !selectedBids[gseq]) || isSendingManifest || isCreatingLeases}
              >
                {isCreatingLeases ? (
                  <Spinner size="small" />
                ) : (
                  <>
                    Accept Bid{dseqList.length > 1 ? "s" : ""}
                    <span className="ml-2 flex items-center">
                      <ArrowRight className="text-xs" />
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center">
          {!isLoadingBids && (allClosed || bids?.length === 0) && (
            <Button variant="default" color="secondary" onClick={handleCloseDeployment} size="sm">
              Close Deployment
            </Button>
          )}
        </div>

        {(isLoadingBids || (bids?.length || 0) === 0) && !maxRequestsReached && !isSendingManifest && (
          <div className="pt-4 text-center">
            <Spinner size="large" />
            <div className="pt-4">Waiting for bids...</div>
          </div>
        )}

        {warningRequestsReached && !maxRequestsReached && (bids?.length || 0) === 0 && (
          <div className="pt-4">
            <Alert
            // severity="info"
            >
              There should be bids by now... You can wait longer in case a bid shows up or close the deployment and try again with a different configuration.
            </Alert>
          </div>
        )}

        {maxRequestsReached && (bids?.length || 0) === 0 && (
          <div className="pt-4">
            <Alert
            // severity="warning"
            >
              There's no bid for the current deployment. You can close the deployment and try again with a different configuration.
            </Alert>
          </div>
        )}

        {bids && bids.length > 0 && (
          <div
            className="mb-1 flex flex-col items-center justify-between md:mb-0 md:flex-row"
            // sx={{
            //   display: "flex",
            //   alignItems: "center",
            //   justifyContent: "space-between",
            //   flexDirection: { xs: "column", sm: "column", md: "row" },
            //   marginBottom: { xs: ".2rem", sm: ".2rem", md: 0 }
            // }}
          >
            <div
              className="flex w-full items-center md:w-auto"
              // sx={{ display: "flex", alignItem: "center", width: { xs: "100%", sm: "100%", md: "auto" } }}
            >
              <div className="flex items-center space-x-2">
                <Checkbox checked={isFilteringFavorites} onCheckedChange={value => setIsFilteringFavorites(value as boolean)} id="provider-favorites" />
                <label
                  htmlFor="provider-favorites"
                  className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Favorites
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox checked={isFilteringFavorites} onCheckedChange={value => setIsFilteringFavorites(value as boolean)} />
                <Checkbox checked={isFilteringAudited} onCheckedChange={value => setIsFilteringAudited(value as boolean)} id="provider-audited" />
                <label
                  htmlFor="provider-audited"
                  className="inline-flex cursor-pointer items-center text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Audited
                  <UserBadgeCheck className="ml-2 text-sm text-green-600" />
                </label>
              </div>

              {!isLoadingBids && allClosed && (
                <div className="ml-4 flex items-center">
                  <CustomTooltip
                    title={
                      <Alert variant="warning">
                        All bids for this deployment are closed. This can happen if no bids are accepted for more than 5 minutes after the deployment creation.
                        You can close this deployment and create a new one.
                      </Alert>
                    }
                  >
                    <InfoCircle className="text-xs text-red-600" />
                  </CustomTooltip>
                </div>
              )}
            </div>

            {!isSendingManifest && (
              <div
                className="mt-2 flex items-center self-start sm:self-center md:ml-4 md:mt-0"
                // sx={{
                //   display: "flex",
                //   alignItems: "center",
                //   marginLeft: { xs: 0, sm: 0, md: "1rem" },
                //   marginTop: { xs: ".2rem", sm: ".2rem", md: 0 },
                //   alignSelf: { xs: "start", sm: "center" }
                // }}
              >
                <BidCountdownTimer height={bids && bids?.length > 0 ? bids[0].dseq : null} />
              </div>
            )}

            {!maxRequestsReached && !isSendingManifest && (
              <div
                className="flex items-center self-start text-xs leading-4 sm:self-center"
                // sx={{ display: "flex", alignItems: "center", lineHeight: "1rem", fontSize: ".7rem", alignSelf: { xs: "start", sm: "center" } }}
              >
                <p className="text-xs text-muted-foreground">Waiting for more bids...</p>
                <div className="ml-2">
                  <Spinner size="small" />
                </div>
              </div>
            )}
          </div>
        )}

        <LinearLoadingSkeleton isLoading={isSendingManifest} />
      </div>

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
