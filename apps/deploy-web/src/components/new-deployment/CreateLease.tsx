"use client";
import type { ChangeEventHandler } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Checkbox,
  CustomTooltip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
  Snackbar,
  Spinner
} from "@akashnetwork/ui/components";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ArrowRight, BadgeCheck, Bin, InfoCircle, MoreHoriz, Xmark } from "iconoir-react";
import yaml from "js-yaml";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useWhen } from "@src/hooks/useWhen";
import { useBidList } from "@src/queries/useBidQuery";
import { useBlock } from "@src/queries/useBlocksQuery";
import { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { analyticsService } from "@src/services/analytics/analytics.service";
import networkStore from "@src/store/networkStore";
import type { BidDto } from "@src/types/deployment";
import { RouteStep } from "@src/types/route-steps.type";
import { deploymentData } from "@src/utils/deploymentData";
import { TRIAL_ATTRIBUTE } from "@src/utils/deploymentData/v1beta3";
import { getDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { addScriptToHead } from "@src/utils/domUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { useCertificate } from "../../context/CertificateProvider";
import { useLocalNotes } from "../../context/LocalNoteProvider";
import { CustomDropdownLinkItem } from "../shared/CustomDropdownLinkItem";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import { ManifestErrorSnackbar } from "../shared/ManifestErrorSnackbar";
import ViewPanel from "../shared/ViewPanel";
import { BidCountdownTimer } from "./BidCountdownTimer";
import { BidGroup } from "./BidGroup";

type Props = {
  dseq: string;
};

// Refresh bids every 7 seconds;
const REFRESH_BIDS_INTERVAL = 7000;
// Request every 7 seconds to a max of 5.5 minutes before deployments closes
const MAX_NUM_OF_BID_REQUESTS = Math.floor((5.5 * 60 * 1000) / REFRESH_BIDS_INTERVAL);
// Show a warning after 1 minute
const WARNING_NUM_OF_BID_REQUESTS = Math.round((60 * 1000) / REFRESH_BIDS_INTERVAL);
const TRIAL_SIGNUP_WARNING_TIMEOUT = 33000;

export const CreateLease: React.FunctionComponent<Props> = ({ dseq }) => {
  const { providerProxy } = useServices();

  const [isSendingManifest, setIsSendingManifest] = useState(false);
  const [isFilteringFavorites, setIsFilteringFavorites] = useState(false);
  const [isFilteringAudited, setIsFilteringAudited] = useState(false);
  const [isCreatingLeases, setIsCreatingLeases] = useState(false);
  const [selectedBids, setSelectedBids] = useState<{ [gseq: string]: BidDto }>({});
  const [filteredBids, setFilteredBids] = useState<Array<string>>([]);
  const [search, setSearch] = useState("");
  const { address, signAndBroadcastTx, isManaged, isTrialing } = useWallet();
  const { localCert } = useCertificate();
  const router = useRouter();
  const [numberOfRequests, setNumberOfRequests] = useState(0);
  const { data: providers } = useProviderList();
  const warningRequestsReached = numberOfRequests > WARNING_NUM_OF_BID_REQUESTS;
  const maxRequestsReached = numberOfRequests > MAX_NUM_OF_BID_REQUESTS;
  const { favoriteProviders } = useLocalNotes();
  const {
    data: bids,
    isLoading: isLoadingBids,
    dataUpdatedAt: bidsUpdatedAt
  } = useBidList(address, dseq, {
    initialData: [],
    refetchInterval: REFRESH_BIDS_INTERVAL,
    enabled: !maxRequestsReached && !isSendingManifest
  });
  useEffect(() => {
    setNumberOfRequests(prev => ++prev);
  }, [bidsUpdatedAt]);

  const activeBid = useMemo(() => bids?.find(bid => bid.state === "active"), [bids]);
  const hasActiveBid = !!activeBid;
  const { data: deploymentDetail, refetch: getDeploymentDetail } = useDeploymentDetail(address, dseq, { refetchOnMount: false, enabled: false });
  const groupedBids =
    bids
      ?.sort((a, b) => parseFloat(a.price.amount) - parseFloat(b.price.amount))
      .reduce((a, b) => {
        a[b.gseq] = [...(a[b.gseq] || []), b];
        return a as { [key: number]: BidDto };
      }, {} as any) || {};
  const dseqList = Object.keys(groupedBids).map(group => parseInt(group));
  const muiTheme = useMuiTheme();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));

  const allClosed = (bids?.length || 0) > 0 && bids?.every(bid => bid.state === "closed");
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { closeDeploymentConfirm } = useManagedDeploymentConfirm();

  useEffect(() => {
    getDeploymentDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useWhen(hasActiveBid, () => {
    if (activeBid) {
      selectBid(activeBid);
    }
  });

  const chainNetwork = networkStore.useSelectedNetworkId();
  const sendManifest = useCallback(async () => {
    setIsSendingManifest(true);
    const bidKeys = Object.keys(selectedBids);

    const localDeploymentData = getDeploymentLocalData(dseq);

    analyticsService.track("send_manifest", {
      category: "deployments",
      label: "Send manifest after creating lease"
    });

    if (!localDeploymentData || !localDeploymentData.manifest) {
      return;
    }

    const sendManifestNotification =
      !isManaged &&
      enqueueSnackbar(<Snackbar title="Deploying! 🚀" subTitle="Please wait a few seconds..." showLoading />, {
        variant: "info",
        autoHideDuration: null
      });

    try {
      const yamlJson = yaml.load(localDeploymentData.manifest);
      const mani = deploymentData.getManifest(yamlJson, true);

      for (let i = 0; i < bidKeys.length; i++) {
        const currentBid = selectedBids[bidKeys[i]];
        const provider = providers?.find(x => x.owner === currentBid.provider);

        if (!provider) {
          throw new Error("Provider not found");
        }
        await providerProxy.sendManifest(provider, mani, { dseq, localCert, chainNetwork });
      }

      // Ad tracking script
      browserEnvConfig.NEXT_PUBLIC_TRACKING_ENABLED &&
        browserEnvConfig.NEXT_PUBLIC_GROWTH_CHANNEL_TRACKING_ENABLED &&
        addScriptToHead({
          src: "https://pxl.growth-channel.net/s/76250b26-c260-4776-874b-471ed290230d",
          async: true,
          defer: true,
          id: "growth-channel-script-lease"
        });

      router.replace(UrlService.deploymentDetails(dseq, "EVENTS", "events"));
    } catch (err) {
      enqueueSnackbar(<ManifestErrorSnackbar err={err} />, { variant: "error", autoHideDuration: null });
      console.error(err);
    } finally {
      if (sendManifestNotification) {
        closeSnackbar(sendManifestNotification);
      }

      setIsSendingManifest(false);
    }
  }, [selectedBids, dseq, providers, localCert, isManaged, enqueueSnackbar, closeSnackbar, router, chainNetwork]);

  // Filter bids
  useEffect(() => {
    if ((search || isFilteringFavorites || isFilteringAudited) && providers) {
      let filteredBids = [...(bids || [])];

      if (search) {
        filteredBids = filteredBids.filter(bid => {
          const provider = providers?.find(p => p.owner === bid.provider);
          return provider?.attributes.some(att => att.value?.toLowerCase().includes(search.toLowerCase())) || provider?.hostUri.includes(search);
        });
      }

      if (isFilteringFavorites) {
        filteredBids = filteredBids.filter(bid => favoriteProviders.some(y => y === bid.provider));
      }

      if (isFilteringAudited) {
        filteredBids = filteredBids.filter(bid => !!providers.filter(x => x.isAudited).find(p => p.owner === bid.provider));
      }

      setFilteredBids(filteredBids.map(bid => bid.id));
    } else {
      setFilteredBids(bids?.map(bid => bid.id) || []);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, bids, providers, isFilteringFavorites, isFilteringAudited, favoriteProviders]);

  const [zeroBidsForTrialWarningDisplayed, setZeroBidsForTrialWarningDisplayed] = useState(false);
  const { data: block } = useBlock(dseq, {
    disabled: true
  });

  useEffect(() => {
    if (!isTrialing || numberOfRequests === 0 || (bids && bids.length > 0)) {
      setZeroBidsForTrialWarningDisplayed(false);
      return;
    }

    const intervalId = setInterval(() => {
      const blockTime = new Date(block.block.header.time).getTime();
      const now = new Date().getTime();

      setZeroBidsForTrialWarningDisplayed(now - blockTime > TRIAL_SIGNUP_WARNING_TIMEOUT);
      clearInterval(intervalId);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [block, bids, isTrialing, numberOfRequests]);

  const selectBid = (bid: BidDto) => {
    setSelectedBids(prev => ({ ...prev, [bid.gseq]: bid }));
  };

  /**
   * Create the leases
   */
  async function createLease() {
    setIsCreatingLeases(true);

    const bidKeys = Object.keys(selectedBids);

    // Create the lease
    try {
      const messages = bidKeys.map(gseq => selectedBids[gseq]).map(bid => TransactionMessageData.getCreateLeaseMsg(bid));

      const response = await signAndBroadcastTx([...messages]);

      if (!response) throw new Error("Rejected transaction");

      analyticsService.track("create_lease", {
        category: "deployments",
        label: "Create lease"
      });
      await sendManifest();
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreatingLeases(false);
    }
  }

  async function handleCloseDeployment() {
    analyticsService.track("close_deployment_btn_clk", "Amplitude");
    const isConfirmed = await closeDeploymentConfirm([dseq]);

    if (!isConfirmed) {
      return;
    }

    const message = TransactionMessageData.getCloseDeploymentMsg(address, dseq);
    const response = await signAndBroadcastTx([message]);

    if (response) {
      router.replace(UrlService.deploymentList());
    }
  }

  const onSearchChange: ChangeEventHandler<HTMLInputElement> = event => {
    const value = event.target.value;
    setSearch(value);
  };

  const trialProviderCount = useMemo(() => {
    if (providers) {
      return providers.filter(provider => {
        return provider.attributes.some(attribute => {
          return attribute.key === TRIAL_ATTRIBUTE && attribute.value === "true";
        });
      }).length;
    }

    return 0;
  }, [providers]);

  return (
    <>
      <CustomNextSeo title="Create Deployment - Create Lease" url={`${domainName}${UrlService.newDeployment({ step: RouteStep.createLeases })}`} />

      <div className="mt-4">
        {!isLoadingBids && (bids?.length || 0) > 0 && !allClosed && (
          <div className="flex flex-col items-end justify-between py-2 md:flex-row">
            <div className="flex w-full flex-grow items-end md:w-auto">
              <div className="flex-grow">
                <Input
                  placeholder="Search provider..."
                  disabled={bids?.length === 0 || isSendingManifest}
                  value={search}
                  onChange={onSearchChange}
                  type="text"
                  className="w-full"
                  label="Search provider"
                  endIcon={
                    search && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSearch("")}
                        className="text-muted-foreground hover:bg-transparent hover:text-current"
                      >
                        <Xmark />
                      </Button>
                    )
                  }
                />
              </div>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <div className="mx-2">
                    <Button size="icon" variant="ghost">
                      <MoreHoriz className="text-lg" />
                    </Button>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <CustomDropdownLinkItem onClick={() => handleCloseDeployment()} icon={<Bin />}>
                    Close Deployment
                  </CustomDropdownLinkItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex w-full items-center py-2 md:w-auto md:py-0">
              <Button
                variant="default"
                color="secondary"
                onClick={hasActiveBid ? sendManifest : createLease}
                className="w-full whitespace-nowrap md:w-auto"
                disabled={hasActiveBid ? false : dseqList.some(gseq => !selectedBids[gseq]) || isSendingManifest || isCreatingLeases}
                data-testid="create-lease-button"
              >
                {isCreatingLeases || isSendingManifest ? (
                  <Spinner size="small" />
                ) : (
                  <>
                    {hasActiveBid ? "Re-send Manifest" : "Accept Bid"}
                    {dseqList.length > 1 ? "s" : ""}
                    <span className="ml-2 flex items-center">
                      <ArrowRight className="text-xs" />
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {!isLoadingBids && allClosed && (
          <Button variant="default" color="secondary" onClick={handleCloseDeployment} size="sm">
            Close Deployment
          </Button>
        )}

        {!zeroBidsForTrialWarningDisplayed && warningRequestsReached && !maxRequestsReached && (bids?.length || 0) === 0 && (
          <div className="pt-4">
            <Alert variant="warning">
              There should be bids by now... You can wait longer in case a bid shows up or close the deployment and try again with a different configuration.
            </Alert>
          </div>
        )}

        {(isLoadingBids || (bids?.length || 0) === 0) && !maxRequestsReached && !isSendingManifest && !zeroBidsForTrialWarningDisplayed && (
          <div className="flex flex-col items-center justify-center pt-4 text-center">
            <Spinner size="large" />
            <div className="pt-4">Waiting for bids...</div>
          </div>
        )}

        {!zeroBidsForTrialWarningDisplayed && maxRequestsReached && (bids?.length || 0) === 0 && (
          <div className="pt-4">
            <Alert variant="warning">
              There's no bid for the current deployment. You can close the deployment and try again with a different configuration.
            </Alert>
          </div>
        )}

        {bids && bids.length > 0 && (
          <div className="my-1 flex flex-col items-center justify-between md:flex-row">
            <div className="flex w-full items-center md:w-auto">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={isFilteringFavorites}
                  onCheckedChange={value => {
                    setIsFilteringFavorites(value as boolean);
                    analyticsService.track("filtered_by_favorite_providers", { value }, "Amplitude");
                  }}
                  id="provider-favorites"
                />
                <label
                  htmlFor="provider-favorites"
                  className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Favorites
                </label>
              </div>

              <div className="ml-4 flex items-center space-x-2">
                <Checkbox
                  checked={isFilteringAudited}
                  onCheckedChange={value => {
                    setIsFilteringAudited(value as boolean);
                    analyticsService.track("filtered_by_audited_providers", { value }, "Amplitude");
                  }}
                  id="provider-audited"
                  data-testid="create-lease-filter-audited"
                />
                <label
                  htmlFor="provider-audited"
                  className="inline-flex cursor-pointer items-center text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Audited
                  <BadgeCheck className="ml-2 text-sm text-green-600" />
                </label>
              </div>

              {!isLoadingBids && allClosed && (
                <div className="ml-4 flex items-center">
                  <CustomTooltip
                    title={
                      <div>
                        All bids for this deployment are closed. This can happen if no bids are accepted for more than 5 minutes after the deployment creation.
                        You can close this deployment and create a new one.
                      </div>
                    }
                  >
                    <InfoCircle className="text-xs text-red-600" />
                  </CustomTooltip>
                </div>
              )}
            </div>

            {!isSendingManifest && (
              <div className="mt-2 flex items-center self-start sm:self-center md:ml-4 md:mt-0">
                <BidCountdownTimer height={bids && bids?.length > 0 ? bids[0].dseq : null} />
              </div>
            )}

            {!maxRequestsReached && !isSendingManifest && (
              <div className="flex items-center self-start text-xs leading-4 sm:self-center">
                <p className="text-xs text-muted-foreground">Waiting for more bids...</p>
                <div className="ml-2">
                  <Spinner size="small" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <LinearLoadingSkeleton isLoading={isSendingManifest} />
      {dseqList.length > 0 && (
        <ViewPanel stickToBottom className="overflow-visible pb-16 md:overflow-auto" style={{ height: smallScreen ? "auto" : "" }}>
          {dseqList.map((gseq, i) => (
            <BidGroup
              key={gseq}
              gseq={gseq}
              bids={groupedBids[gseq]}
              handleBidSelected={selectBid}
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

          {isTrialing && (
            <Alert variant="destructive">
              <AlertTitle className="text-center text-lg dark:text-white/90">Free Trial!</AlertTitle>
              <AlertDescription className="space-y-1 text-center dark:text-white/90">
                <p>You are using a free trial and are limited to only a few providers on the network.</p>
                <p>
                  <Link href={UrlService.login()} className="font-bold underline">
                    Sign in
                  </Link>{" "}
                  or{" "}
                  <Link href={UrlService.signup()} className="font-bold underline">
                    Sign up
                  </Link>{" "}
                  and buy credits to unlock all providers.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </ViewPanel>
      )}

      {zeroBidsForTrialWarningDisplayed && (
        <div className="pt-4">
          <Card>
            <CardContent>
              <div className="px-16 pb-4 pt-6 text-center">
                <h3 className="mb-4 text-xl font-bold">Waiting for bids</h3>
                <p className="mb-8">
                  It looks like you’re not receiving any bids. This is likely because all trial providers are currently in use. Console offers{" "}
                  {trialProviderCount} providers for trial users, but many more are available for non-trial users. To access the full list of providers, we
                  recommend signing up and adding funds to your account.
                </p>
                <p>
                  <Button onClick={() => handleCloseDeployment()} variant="outline" type="button" size="sm" className="mr-4">
                    Close Deployment
                  </Button>
                  <Button onClick={() => router.push(UrlService.signup())} color="secondary" variant="default" type="button" size="sm">
                    Sign Up
                  </Button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};
