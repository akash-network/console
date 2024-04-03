"use client";
import React, { SetStateAction, useCallback } from "react";
import { useEffect, useState } from "react";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { useProviderStatus } from "@src/queries/useProvidersQuery";
import { deploymentData } from "@src/utils/deploymentData";
import { getGpusFromAttributes, sendManifestToProvider } from "@src/utils/deploymentUtils";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { cx } from "@emotion/css";
import { getSplitText } from "@src/hooks/useShortText";
import { ApiProviderList } from "@src/types/provider";
import { LeaseDto } from "@src/types/deployment";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { useBidInfo } from "@src/queries/useBidQuery";
import { useToast } from "@src/components/ui/use-toast";
import { useCertificate } from "@src/context/CertificateProvider";
import { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";
import { Card, CardContent } from "@src/components/ui/card";
import { SpecDetail } from "@src/components/shared/SpecDetail";
import { LabelValueOld } from "@src/components/shared/LabelValueOld";
import { PricePerMonth } from "@src/components/shared/PricePerMonth";
import { PriceEstimateTooltip } from "@src/components/shared/PriceEstimateTooltip";
import Spinner from "@src/components/shared/Spinner";
import { FavoriteButton } from "@src/components/shared/FavoriteButton";
import { AuditorButton } from "@src/components/providers/AuditorButton";
import { Alert } from "@src/components/ui/alert";
import { LinkTo } from "@src/components/shared/LinkTo";
import { Button } from "@src/components/ui/button";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import { StatusPill } from "@src/components/shared/StatusPill";
import { cn } from "@src/utils/styleUtils";
import { Check, Copy, InfoCircle, OpenInWindow } from "iconoir-react";
import { Badge } from "@src/components/ui/badge";

const yaml = require("js-yaml");

// const useStyles = makeStyles()(theme => ({
//   root: {
//     marginBottom: "1rem"
//   },
//   cardHeader: {
//     borderBottom: "1px solid rgba(0,0,0,0.1)",
//     padding: ".5rem 1rem",
//     backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[100]
//   },
//   cardHeaderTitle: {
//     fontSize: "18px"
//   },
//   listItem: {
//     borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`
//   },
//   link: {
//     display: "flex",
//     alignItems: "center"
//   },
//   tooltip: {
//     fontSize: "1rem"
//   },
//   tooltipIcon: {
//     fontSize: "1rem",
//     color: theme.palette.grey[500]
//   },
//   whiteLink: {
//     fontWeight: "bold",
//     color: theme.palette.common.white
//   },
//   marginLeft: {
//     marginLeft: "1rem"
//   },
//   serviceChip: {
//     height: ".875rem",
//     lineHeight: ".875rem",
//     fontSize: ".5rem",
//     fontWeight: "bold"
//   },
//   activeLeaseIcon: {
//     fontSize: "1rem",
//     display: "flex",
//     color: theme.palette.success.dark
//   }
// }));

type Props = {
  lease: LeaseDto;
  setActiveTab: (value: SetStateAction<string>) => void;
  deploymentManifest: string;
  dseq: string;
  providers: ApiProviderList[];
  loadDeploymentDetail: () => void;
};

export type AcceptRefType = {
  getLeaseStatus: () => void;
};

export const LeaseRow = React.forwardRef<AcceptRefType, Props>(({ lease, setActiveTab, deploymentManifest, dseq, providers, loadDeploymentDetail }, ref) => {
  const { toast } = useToast();
  const provider = providers?.find(p => p.owner === lease?.provider);
  const { localCert } = useCertificate();
  const isLeaseActive = lease.state === "active";
  const [isServicesAvailable, setIsServicesAvailable] = useState(false);
  const { favoriteProviders, updateFavoriteProviders } = useLocalNotes();
  const isFavorite = favoriteProviders.some(x => lease?.provider === x);
  const {
    data: leaseStatus,
    error,
    refetch: getLeaseStatus,
    isLoading: isLoadingLeaseStatus
  } = useLeaseStatus(provider?.hostUri || "", lease, {
    enabled: isLeaseActive && !isServicesAvailable && !!provider?.hostUri && !!localCert,
    refetchInterval: 10_000,
    onSuccess: leaseStatus => {
      if (leaseStatus) {
        checkIfServicesAreAvailable(leaseStatus);
      }
    }
  });
  const {
    data: providerStatus,
    isLoading: isLoadingProviderStatus,
    refetch: getProviderStatus
  } = useProviderStatus(provider?.hostUri || "", {
    enabled: false,
    retry: false
  });
  const isLeaseNotFound = error && (error as string).includes && (error as string).includes("lease not found") && isLeaseActive;
  const servicesNames = leaseStatus ? Object.keys(leaseStatus.services) : [];
  const [isSendingManifest, setIsSendingManifest] = useState(false);
  const { data: bid } = useBidInfo(lease.owner, lease.dseq, lease.gseq, lease.oseq, lease.provider);

  React.useImperativeHandle(ref, () => ({
    getLeaseStatus: loadLeaseStatus
  }));

  const loadLeaseStatus = useCallback(() => {
    if (isLeaseActive && provider && localCert) {
      getLeaseStatus();
      getProviderStatus();
    }
  }, [isLeaseActive, provider, localCert, getLeaseStatus, getProviderStatus]);

  const checkIfServicesAreAvailable = leaseStatus => {
    const servicesNames = leaseStatus ? Object.keys(leaseStatus.services) : [];
    const isServicesAvailable =
      servicesNames.length > 0
        ? servicesNames
            .map(n => leaseStatus.services[n])
            .every((service, i) => {
              return service.available > 0;
            })
        : false;
    setIsServicesAvailable(isServicesAvailable);
  };

  useEffect(() => {
    loadLeaseStatus();
  }, [lease, provider, localCert, loadLeaseStatus]);

  function handleExternalUrlClick(ev, externalUrl) {
    ev.preventDefault();

    window.open("http://" + externalUrl, "_blank");
  }

  function handleEditManifestClick(ev) {
    ev.preventDefault();
    setActiveTab("EDIT");
  }

  async function sendManifest() {
    setIsSendingManifest(true);
    try {
      const doc = yaml.load(deploymentManifest);
      const manifest = deploymentData.getManifest(doc, true);

      await sendManifestToProvider(provider as ApiProviderList, manifest, dseq, localCert as LocalCert);

      toast({ title: "Manifest sent!", variant: "success" });
      // enqueueSnackbar(<Snackbar title="Manifest sent!" iconVariant="success" />, { variant: "success", autoHideDuration: 10_000 });

      loadDeploymentDetail();
    } catch (err) {
      toast({ title: "Error", description: `Error while sending manifest to provider. ${err}`, variant: "destructive" });
      // enqueueSnackbar(<ManifestErrorSnackbar err={err} />, { variant: "error", autoHideDuration: null });
    }
    setIsSendingManifest(false);
  }

  const onStarClick = event => {
    event.preventDefault();
    event.stopPropagation();

    const newFavorites = isFavorite ? favoriteProviders.filter(x => x !== lease.provider) : favoriteProviders.concat([lease.provider]);

    updateFavoriteProviders(newFavorites);
  };

  const gpuModels = bid && bid.bid.resources_offer.flatMap(x => getGpusFromAttributes(x.resources.gpu.attributes));

  return (
    <Card className="mb-4">
      <CardContent
      // classes={{ title: classes.cardHeaderTitle, root: classes.cardHeader }}
      >
        <div className="flex items-center">
          <div className="inline-flex items-center text-sm text-muted-foreground">
            <span>{lease.state}</span>
            <StatusPill state={lease.state} size="small" />

            <span className="ml-4 text-muted-foreground">GSEQ:</span>
            <span className="ml-1">{lease.gseq}</span>

            <span className="ml-4">OSEQ:</span>
            <span className="ml-1">{lease.oseq}</span>
          </div>

          {isLeaseActive && (
            <div className="ml-4 inline-flex">
              <LinkTo onClick={() => setActiveTab("LOGS")}>View logs</LinkTo>
            </div>
          )}
        </div>
        <div className="flex">
          <div>
            <div className="pb-4">
              <SpecDetail
                cpuAmount={lease.cpuAmount}
                gpuAmount={lease.gpuAmount}
                gpuModels={gpuModels}
                memoryAmount={lease.memoryAmount}
                storageAmount={lease.storageAmount}
                color={isLeaseActive ? "primary" : "default"}
                size="medium"
              />
            </div>
            <LabelValueOld
              label="Price:"
              value={
                <div className="flex items-center">
                  <PricePerMonth denom={lease.price.denom} perBlockValue={udenomToDenom(lease.price.amount, 10)} className="text-lg" />
                  <PriceEstimateTooltip denom={lease.price.denom} value={lease.price.amount} />
                </div>
              }
            />

            {isLeaseActive && (
              <LabelValueOld
                label="Provider:"
                className="mb-4 mt-1"
                value={
                  <>
                    {isLoadingProviderStatus && <Spinner />}
                    {providerStatus && (
                      <>
                        <Link href={UrlService.providerDetail(lease.provider)}>
                          {providerStatus.name?.length > 25 ? getSplitText(providerStatus.name, 10, 10) : providerStatus.name}
                        </Link>

                        <div className="ml-1 flex items-center">
                          <FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />

                          {provider?.isAudited && (
                            <div className="ml-2">
                              <AuditorButton provider={provider} />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                }
              />
            )}
          </div>
        </div>

        {isLeaseNotFound && (
          <Alert variant="warning">
            The lease was not found on this provider. This can happen if no manifest was sent to the provider. To send one you can update your deployment in the{" "}
            <LinkTo onClick={handleEditManifestClick}>VIEW / EDIT MANIFEST</LinkTo> tab.
            {deploymentManifest && (
              <>
                <div className="my-4">
                  <strong>OR</strong>
                </div>
                <Button variant="default" color="secondary" disabled={isSendingManifest} onClick={sendManifest} size="sm">
                  {isSendingManifest ? <Spinner /> : <span>Send manifest manually</span>}
                </Button>
              </>
            )}
          </Alert>
        )}

        {!leaseStatus && isLoadingLeaseStatus && <Spinner />}

        {isLeaseActive &&
          leaseStatus &&
          leaseStatus.services &&
          servicesNames
            .map(n => leaseStatus.services[n])
            .map((service, i) => (
              <div
                className={cn({ ["mb-2 border-b pb-2"]: servicesNames.length !== i + 1 })}
                // pb={servicesNames.length === i + 1 ? 0 : 2}
                // mb={servicesNames.length === i + 1 ? 0 : 2}
                // borderBottom={
                //   servicesNames.length === i + 1 ? 0 : `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[700] : theme.palette.grey[300]}`
                // }
                key={`${service.name}_${i}`}
              >
                <div className="flex items-center">
                  <LabelValueOld label="Group:" value={service.name} className="text-lg" />
                  {isLoadingLeaseStatus || !isServicesAvailable ? (
                    <div className="ml-4 inline-flex">
                      <Spinner />
                    </div>
                  ) : (
                    <div className="ml-2 inline-flex">
                      <CustomTooltip
                        title={
                          <>
                            Workloads can take some time to spin up. If you see an error when browsing the uri, it is recommended to refresh and wait a bit.
                            Check the{" "}
                            <LinkTo onClick={() => setActiveTab("LOGS")} className="text-white">
                              logs
                            </LinkTo>{" "}
                            for more information.
                          </>
                        }
                      >
                        <InfoCircle className="ml-2 text-xs text-muted-foreground" fontSize="small" />
                      </CustomTooltip>
                    </div>
                  )}

                  {isServicesAvailable && (
                    <div className="ml-2">
                      <Check className="text-lg text-green-600" />
                    </div>
                  )}
                </div>

                <div
                  className={cn("flex items-center", {
                    ["mb-4"]: service.uris?.length > 0 || (leaseStatus.forwarded_ports && leaseStatus.forwarded_ports[service.name]?.length > 0)
                  })}
                  // display="flex"
                  // alignItems="center"
                  // mb={service.uris?.length > 0 || (leaseStatus.forwarded_ports && leaseStatus.forwarded_ports[service.name]?.length > 0) ? "1rem" : 0}
                >
                  <div className="flex items-center">
                    <span className="text-xs text-muted-foreground">Available:&nbsp;</span>
                    <Badge color="default" className="text-xs leading-3">
                      {service.available}
                    </Badge>
                  </div>
                  <div className="flex items-center">
                    <span className="ml-4 text-xs text-muted-foreground">Ready Replicas:&nbsp;</span>
                    <Badge className="text-xs leading-3">{service.ready_replicas}</Badge>
                  </div>
                  <div className="flex items-center">
                    <span className="ml-4 text-xs text-muted-foreground">Total:&nbsp;</span>
                    <Badge className="text-xs leading-3">{service.total}</Badge>
                  </div>
                </div>

                {leaseStatus.forwarded_ports && leaseStatus.forwarded_ports[service.name]?.length > 0 && (
                  <div
                    className={cn("mt-2", { ["mb-4"]: service.uris?.length > 0 })}
                    // mb={service.uris?.length > 0 ? "1rem" : 0}
                  >
                    <LabelValueOld
                      label="Forwarded Ports:"
                      value={leaseStatus.forwarded_ports[service.name].map(p => (
                        <div key={"port_" + p.externalPort} className="mr-2 inline">
                          {p.host ? (
                            <LinkTo disabled={p.available < 1} onClick={ev => handleExternalUrlClick(ev, `${p.host}:${p.externalPort}`)}>
                              {p.port}:{p.externalPort}
                            </LinkTo>
                          ) : (
                            <>
                              <Badge>{`${p.port}:${p.externalPort}`}</Badge>
                            </>
                          )}
                        </div>
                      ))}
                    />
                  </div>
                )}

                {service.uris?.length > 0 && (
                  <>
                    <div className="mt-2">
                      <LabelValueOld label="URI(s):" />
                      <ul className="space-y-4">
                        {service.uris.map(uri => {
                          return (
                            <li className="flex items-center py-1" key={uri}>
                              <LinkTo className="flex items-center truncate" onClick={ev => handleExternalUrlClick(ev, uri)}>
                                {uri} <OpenInWindow />
                              </LinkTo>
                              &nbsp;&nbsp;
                              <Button
                                aria-label="uri"
                                size="icon"
                                variant="ghost"
                                onClick={ev => {
                                  copyTextToClipboard(uri);
                                  toast({ title: "Uri copied to clipboard!", variant: "success" });
                                }}
                              >
                                <Copy />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            ))}

        {isLeaseActive && leaseStatus && leaseStatus.ips && (
          <div className="mt-2">
            <LabelValueOld label="IP(s):" />
            <ul>
              {servicesNames
                .map(n => leaseStatus.ips[n])
                .map((ips, i) => {
                  return ips?.map((ip, ii) => (
                    <li key={`${ip.IP}${ip.ExternalPort}`} className="flex items-center">
                      <LinkTo className="flex items-center" onClick={ev => handleExternalUrlClick(ev, ip.IP)}>
                        {ip.IP}:{ip.ExternalPort} <OpenInWindow />
                      </LinkTo>
                      &nbsp;&nbsp;
                      <CustomTooltip
                        title={
                          <>
                            <div>IP:&nbsp;{ip.IP}</div>
                            <div>External Port:&nbsp;{ip.ExternalPort}</div>
                            <div>Port:&nbsp;{ip.Port}</div>
                            <div>Protocol:&nbsp;{ip.Protocol}</div>
                          </>
                        }
                      >
                        <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                      </CustomTooltip>
                      &nbsp;&nbsp;
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={ev => {
                          copyTextToClipboard(ip.IP);
                          toast({ title: "IP copied to clipboard!", variant: "success" });
                        }}
                      >
                        <Copy />
                      </Button>
                    </li>
                  ));
                })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
