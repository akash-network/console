"use client";
import React, { SetStateAction, useCallback } from "react";
import { useEffect, useState } from "react";
import { Check, Copy, InfoCircle, OpenInWindow } from "iconoir-react";
import Link from "next/link";
import { useSnackbar } from "notistack";

import { AuditorButton } from "@src/components/providers/AuditorButton";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import { FavoriteButton } from "@src/components/shared/FavoriteButton";
import { LabelValueOld } from "@src/components/shared/LabelValueOld";
import { LinkTo } from "@src/components/shared/LinkTo";
import { PriceEstimateTooltip } from "@src/components/shared/PriceEstimateTooltip";
import { PricePerMonth } from "@src/components/shared/PricePerMonth";
import { SpecDetail } from "@src/components/shared/SpecDetail";
import Spinner from "@src/components/shared/Spinner";
import { StatusPill } from "@src/components/shared/StatusPill";
import { Alert } from "@src/components/ui/alert";
import { Badge } from "@src/components/ui/badge";
import { Button } from "@src/components/ui/button";
import { Card, CardContent, CardHeader } from "@src/components/ui/card";
import { useCertificate } from "@src/context/CertificateProvider";
import { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { getSplitText } from "@src/hooks/useShortText";
import { useBidInfo } from "@src/queries/useBidQuery";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { useProviderStatus } from "@src/queries/useProvidersQuery";
import { LeaseDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { deploymentData } from "@src/utils/deploymentData";
import { getGpusFromAttributes, sendManifestToProvider } from "@src/utils/deploymentUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";
import { ManifestErrorSnackbar } from "../shared/ManifestErrorSnackbar";
import { Snackbar } from "../shared/Snackbar";

const yaml = require("js-yaml");

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
  const { enqueueSnackbar } = useSnackbar();

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

      enqueueSnackbar(<Snackbar title="Manifest sent!" iconVariant="success" />, { variant: "success", autoHideDuration: 10_000 });

      loadDeploymentDetail();
    } catch (err) {
      enqueueSnackbar(<ManifestErrorSnackbar err={err} />, { variant: "error", autoHideDuration: null });
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
      <CardHeader className="bg-secondary py-2">
        <div className="flex items-center">
          <div className="text-muted-foreground inline-flex items-center text-xs">
            <span>{lease.state}</span>
            <StatusPill state={lease.state} size="small" />

            <span className="text-muted-foreground ml-4">GSEQ:</span>
            <span className="ml-1">{lease.gseq}</span>

            <span className="ml-4">OSEQ:</span>
            <span className="ml-1">{lease.oseq}</span>
          </div>

          {isLeaseActive && (
            <div className="ml-4 inline-flex">
              <LinkTo className="text-sm" onClick={() => setActiveTab("LOGS")}>
                View logs
              </LinkTo>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2">
          <div className="">
            <SpecDetail
              cpuAmount={lease.cpuAmount}
              gpuAmount={lease.gpuAmount}
              gpuModels={gpuModels}
              memoryAmount={lease.memoryAmount}
              storageAmount={lease.storageAmount}
              color="secondary"
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
              value={
                <>
                  {isLoadingProviderStatus && <Spinner size="small" />}
                  {providerStatus && (
                    <div className="flex items-center space-x-2">
                      <Link href={UrlService.providerDetail(lease.provider)}>
                        {providerStatus.name?.length > 25 ? getSplitText(providerStatus.name, 10, 10) : providerStatus.name}
                      </Link>

                      <div className="flex items-center space-x-2">
                        <FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />

                        {provider?.isAudited && (
                          <div className="ml-2">
                            <AuditorButton provider={provider} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              }
            />
          )}
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
                  {isSendingManifest ? <Spinner size="small" /> : <span>Send manifest manually</span>}
                </Button>
              </>
            )}
          </Alert>
        )}

        {!leaseStatus && isLoadingLeaseStatus && <Spinner size="small" />}

        {isLeaseActive &&
          leaseStatus &&
          leaseStatus.services &&
          servicesNames
            .map(n => leaseStatus.services[n])
            .map((service, i) => (
              <div
                className={cn("mt-2", {
                  ["border-b pb-2"]: servicesNames.length > 1 && i !== servicesNames.length - 1
                })}
                key={`${service.name}_${i}`}
              >
                <div className="flex items-center">
                  <LabelValueOld label="Group:" value={service.name} />
                  {isLoadingLeaseStatus || !isServicesAvailable ? (
                    <div className="ml-4 inline-flex">
                      <Spinner size="small" />
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
                        <InfoCircle className="text-muted-foreground ml-2 text-xs" fontSize="small" />
                      </CustomTooltip>
                    </div>
                  )}

                  {isServicesAvailable && (
                    <div className="ml-2">
                      <Check className="text-sm text-green-600" />
                    </div>
                  )}
                </div>

                <div
                  className={cn("flex items-center space-x-4", {
                    ["mb-4"]: service.uris?.length > 0 || (leaseStatus.forwarded_ports && leaseStatus.forwarded_ports[service.name]?.length > 0)
                  })}
                >
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground text-xs">Available:&nbsp;</span>
                    <Badge variant={service.available > 0 ? "success" : "destructive"} className="h-3 px-1 text-xs leading-3">
                      <small>{service.available}</small>
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground text-xs">Ready Replicas:&nbsp;</span>
                    <Badge variant={service.ready_replicas > 0 ? "success" : "destructive"} className="h-3 px-1 text-xs leading-3">
                      <small>{service.ready_replicas}</small>
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground text-xs">Total:&nbsp;</span>
                    <Badge variant={service.total > 0 ? "success" : "destructive"} className="h-3 px-1 text-xs leading-3">
                      <small>{service.total}</small>
                    </Badge>
                  </div>
                </div>

                {leaseStatus.forwarded_ports && leaseStatus.forwarded_ports[service.name]?.length > 0 && (
                  <div className={cn({ ["mb-4"]: service.uris?.length > 0 })}>
                    <LabelValueOld
                      label="Forwarded Ports:"
                      value={
                        <div className="inline-flex items-center space-x-2">
                          {leaseStatus.forwarded_ports[service.name].map(p => (
                            <div key={"port_" + p.externalPort}>
                              {p.host ? (
                                <Link
                                  className={cn({ ["text-muted-foreground cursor-none"]: p.available < 1 }, "inline-flex items-center space-x-2 text-sm")}
                                  href={`http://${p.host}:${p.externalPort}`}
                                  target="_blank"
                                >
                                  <span>
                                    {p.port}:{p.externalPort}
                                  </span>
                                  <OpenInWindow className="text-xs" />
                                </Link>
                              ) : (
                                <Badge variant="outline">{`${p.port}:${p.externalPort}`}</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      }
                    />
                  </div>
                )}

                {service.uris?.length > 0 && (
                  <>
                    <div className="mt-2">
                      <LabelValueOld label="URI(s):" />
                      <ul className="mt-2 space-y-2">
                        {service.uris.map(uri => {
                          return (
                            <li className="flex items-center" key={uri}>
                              <Link href={`http://${uri}`} target="_blank" className="inline-flex items-center space-x-2 truncate text-sm">
                                <span>{uri}</span>
                                <OpenInWindow className="text-xs" />
                              </Link>
                              &nbsp;&nbsp;
                              <Button
                                aria-label="uri"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 rounded-full"
                                onClick={ev => {
                                  copyTextToClipboard(uri);
                                  enqueueSnackbar(<Snackbar title="Uri copied to clipboard!" iconVariant="success" />, {
                                    variant: "success",
                                    autoHideDuration: 2000
                                  });
                                }}
                              >
                                <Copy className="text-xs" />
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
            <ul className="mt-2 space-y-2">
              {servicesNames
                .flatMap(service => leaseStatus.ips[service])
                .filter(Boolean)
                .map((ip, i) => (
                  <li key={`${ip.IP}${ip.ExternalPort}`} className="flex items-center">
                    <Link className="inline-flex items-center space-x-2 text-sm" href={`http://${ip.IP}:${ip.ExternalPort}`} target="_blank">
                      <span>
                        {ip.IP}:{ip.ExternalPort}
                      </span>
                      <OpenInWindow className="text-xs" />
                    </Link>
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
                      <InfoCircle className="text-muted-foreground text-xs" />
                    </CustomTooltip>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-full"
                      onClick={ev => {
                        copyTextToClipboard(`${ip.IP}:${ip.ExternalPort}`);
                        enqueueSnackbar(<Snackbar title="Ip copied to clipboard!" iconVariant="success" />, {
                          variant: "success",
                          autoHideDuration: 2000
                        });
                      }}
                    >
                      <Copy className="text-xs" />
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
