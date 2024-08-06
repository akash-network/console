"use client";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  CustomTooltip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
  Snackbar,
  Spinner
} from "@akashnetwork/ui/components";
import { ArrowRight, BadgeCheck, Bin, InfoCircle, MoreHoriz, Xmark } from "iconoir-react";
import yaml from "js-yaml";
import { useRouter } from "next/navigation";
import { event } from "nextjs-google-analytics";
import { useSnackbar } from "notistack";

import { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";
import { useWallet } from "@src/context/WalletProvider";
import { useBidList } from "@src/queries/useBidQuery";
import { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { BidDto } from "@src/types/deployment";
import { AnalyticsEvents } from "@src/utils/analytics";
import { RouteStepKeys } from "@src/utils/constants";
import { deploymentData } from "@src/utils/deploymentData";
import { getDeploymentLocalData } from "@src/utils/deploymentLocalDataUtils";
import { sendManifestToProvider } from "@src/utils/deploymentUtils";
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
  const router = useRouter();
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
  const groupedBids =
    bids
      ?.sort((a, b) => parseFloat(a.price.amount) - parseFloat(b.price.amount))
      .reduce((a, b) => {
        a[b.gseq] = [...(a[b.gseq] || []), b];
        return a as { [key: number]: BidDto };
      }, {} as any) || {};
  const dseqList = Object.keys(groupedBids).map(g => parseInt(g));
  const allClosed = (bids?.length || 0) > 0 && bids?.every(bid => bid.state === "closed");
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  useEffect(() => {
    getDeploymentDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleBidSelected = bid => {
    setSelectedBids({ ...selectedBids, [bid.gseq]: bid });
  };

  async function sendManifest(providerInfo, manifest) {
    try {
      const response = await sendManifestToProvider(providerInfo, manifest, dseq, localCert as LocalCert);

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
          const provider = providers?.find(x => x.owner === currentBid.provider);
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
    const message = TransactionMessageData.getCloseDeploymentMsg(address, dseq);
    const response = await signAndBroadcastTx([message]);

    if (response) {
      router.replace(UrlService.deploymentList());
    }
  }

  const onSearchChange = event => {
    const value = event.target.value;
    setSearch(value);
  };

  return (
    <>
      <CustomNextSeo title="Create Deployment - Create Lease" url={`${domainName}${UrlService.newDeployment({ step: RouteStepKeys.createLeases })}`} />

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
                onClick={handleNext}
                className="w-full whitespace-nowrap md:w-auto"
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

        {!isLoadingBids && (allClosed || bids?.length === 0) && (
          <Button variant="default" color="secondary" onClick={handleCloseDeployment} size="sm">
            Close Deployment
          </Button>
        )}

        {warningRequestsReached && !maxRequestsReached && (bids?.length || 0) === 0 && (
          <div className="pt-4">
            <Alert variant="warning">
              There should be bids by now... You can wait longer in case a bid shows up or close the deployment and try again with a different configuration.
            </Alert>
          </div>
        )}

        {(isLoadingBids || (bids?.length || 0) === 0) && !maxRequestsReached && !isSendingManifest && (
          <div className="flex flex-col items-center justify-center pt-4 text-center">
            <Spinner size="large" />
            <div className="pt-4">Waiting for bids...</div>
          </div>
        )}

        {maxRequestsReached && (bids?.length || 0) === 0 && (
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
                <Checkbox checked={isFilteringFavorites} onCheckedChange={value => setIsFilteringFavorites(value as boolean)} id="provider-favorites" />
                <label
                  htmlFor="provider-favorites"
                  className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Favorites
                </label>
              </div>

              <div className="ml-4 flex items-center space-x-2">
                <Checkbox checked={isFilteringAudited} onCheckedChange={value => setIsFilteringAudited(value as boolean)} id="provider-audited" />
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
