"use client";
import type { SetStateAction } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CustomTooltip, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Check, Copy, InfoCircle, OpenInWindow } from "iconoir-react";
import yaml from "js-yaml";
import get from "lodash/get";
import Link from "next/link";
import { useSnackbar } from "notistack";

import { AuditorButton } from "@src/components/providers/AuditorButton";
import { CodeSnippet } from "@src/components/shared/CodeSnippet";
import { FavoriteButton } from "@src/components/shared/FavoriteButton";
import { LabelValueOld } from "@src/components/shared/LabelValueOld";
import { LinkTo } from "@src/components/shared/LinkTo";
import { PriceEstimateTooltip } from "@src/components/shared/PriceEstimateTooltip";
import { PricePerMonth } from "@src/components/shared/PricePerMonth";
import { SpecDetail } from "@src/components/shared/SpecDetail";
import { StatusPill } from "@src/components/shared/StatusPill";
import { useCertificate } from "@src/context/CertificateProvider";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useBidInfo } from "@src/queries/useBidQuery";
import type { LeaseStatusDto } from "@src/queries/useLeaseQuery";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { useProviderStatus } from "@src/queries/useProvidersQuery";
import networkStore from "@src/store/networkStore";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { deploymentData } from "@src/utils/deploymentData";
import { getGpusFromAttributes, sendManifestToProvider } from "@src/utils/deploymentUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { sshVmImages } from "@src/utils/sdl/data";
import { UrlService } from "@src/utils/urlUtils";
import { CopyTextToClipboardButton } from "../copy-text-to-clipboard-button/CopyTextToClipboardButton";
import { ManifestErrorSnackbar } from "../shared/ManifestErrorSnackbar";
import { ShortenedValue } from "../shortened-value/ShortenedValue";

type Props = {
  index: number;
  lease: LeaseDto;
  setActiveTab: (value: SetStateAction<string>) => void;
  deploymentManifest: string;
  dseq: string;
  providers: ApiProviderList[];
  loadDeploymentDetail: () => void;
  isRemoteDeploy?: boolean;
  repo?: string | null;
};

export type AcceptRefType = {
  getLeaseStatus: () => void;
};

export const LeaseRow = React.forwardRef<AcceptRefType, Props>(
  ({ index, lease, setActiveTab, deploymentManifest, dseq, providers, loadDeploymentDetail, isRemoteDeploy, repo }, ref) => {
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
    } = useLeaseStatus(provider, lease, {
      enabled: isLeaseActive && !isServicesAvailable && !!provider?.hostUri && !!localCert,
      refetchInterval: 10_000,
      onSuccess: leaseStatus => {
        if (leaseStatus) {
          checkIfServicesAreAvailable(leaseStatus);
        }
      }
    });
    const { isLoading: isLoadingProviderStatus, refetch: getProviderStatus } = useProviderStatus(provider, {
      enabled: false,
      retry: false
    });
    const isLeaseNotFound = error && (error as string).includes && (error as string).includes("lease not found") && isLeaseActive;
    const servicesNames = useMemo(() => (leaseStatus ? Object.keys(leaseStatus.services) : []), [leaseStatus]);
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

    const parsedManifest = useMemo(() => yaml.load(deploymentManifest), [deploymentManifest]);

    const checkIfServicesAreAvailable = (leaseStatus: LeaseStatusDto) => {
      const servicesNames = leaseStatus ? Object.keys(leaseStatus.services) : [];
      const isServicesAvailable =
        servicesNames.length > 0
          ? servicesNames
              .map(n => leaseStatus.services[n])
              .every(service => {
                return service.available > 0;
              })
          : false;
      setIsServicesAvailable(isServicesAvailable);
    };

    useEffect(() => {
      loadLeaseStatus();
    }, [lease, provider, localCert, loadLeaseStatus]);

    function handleEditManifestClick(ev: React.MouseEvent) {
      ev.preventDefault();
      setActiveTab("EDIT");
    }

    const chainNetwork = networkStore.useSelectedNetworkId();
    async function sendManifest() {
      setIsSendingManifest(true);
      try {
        const manifest = deploymentData.getManifest(parsedManifest, true);

        await sendManifestToProvider(provider, manifest, { dseq, localCert, chainNetwork });

        enqueueSnackbar(<Snackbar title="Manifest sent!" iconVariant="success" />, { variant: "success", autoHideDuration: 10_000 });

        loadDeploymentDetail();
      } catch (err) {
        enqueueSnackbar(<ManifestErrorSnackbar err={err} />, { variant: "error", autoHideDuration: null });
      }
      setIsSendingManifest(false);
    }

    const onStarClick = (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const newFavorites = isFavorite ? favoriteProviders.filter(x => x !== lease.provider) : favoriteProviders.concat([lease.provider]);

      updateFavoriteProviders(newFavorites);
    };

    const gpuModels = bid && bid.bid.resources_offer.flatMap(x => getGpusFromAttributes(x.resources.gpu.attributes));

    const sshInstructions = useMemo(() => {
      return servicesNames.reduce((acc, serviceName) => {
        if (!sshVmImages.has(get(parsedManifest, ["services", serviceName, "image"]))) {
          return acc;
        }

        const exposes = leaseStatus?.forwarded_ports?.[serviceName];
        if (!exposes) return acc;

        return exposes?.reduce((exposesAcc, expose) => {
          if (expose.port !== 22) {
            return exposesAcc;
          }

          if (exposesAcc) {
            exposesAcc += "\n";
          }

          return exposesAcc.concat(`ssh root@${expose.host} -p ${expose.externalPort} -i ~/.ssh/id_rsa`);
        }, acc);
      }, "");
    }, [parsedManifest, servicesNames, leaseStatus]);

    return (
      <Card className="mb-4">
        <CardHeader className="bg-secondary py-2">
          <div className="flex items-center">
            <div className="inline-flex items-center text-xs text-muted-foreground">
              <span data-testid={`lease-row-${index}-state`}>{lease.state}</span>
              <StatusPill state={lease.state} size="small" />

              <span className="ml-4 text-muted-foreground">GSEQ:</span>
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
            <div className="mb-4">
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

            <LabelValueOld
              label="Provider:"
              value={
                <>
                  {isLeaseActive && isLoadingProviderStatus && <Spinner size="small" className="mr-2" />}
                  {provider && (
                    <div className="flex items-center space-x-2">
                      <Link href={UrlService.providerDetail(lease.provider)}>
                        <ShortenedValue value={provider.name} maxLength={40} headLength={14} />
                      </Link>

                      <div className="flex items-center space-x-2">
                        <CopyTextToClipboardButton value={provider.name} />
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
          </div>

          {isLeaseNotFound && (
            <Alert variant="warning">
              The lease was not found on this provider. This can happen if no manifest was sent to the provider. To send one you can update your deployment in
              the <LinkTo onClick={handleEditManifestClick}>VIEW / EDIT MANIFEST</LinkTo> tab.
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
                          <InfoCircle className="ml-2 text-xs text-muted-foreground" fontSize="small" />
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
                      <span className="text-xs text-muted-foreground">Available:&nbsp;</span>
                      <Badge variant={service.available > 0 ? "success" : "destructive"} className="h-3 px-1 text-xs leading-3">
                        <small>{service.available}</small>
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-muted-foreground">Ready Replicas:&nbsp;</span>
                      <Badge variant={service.ready_replicas > 0 ? "success" : "destructive"} className="h-3 px-1 text-xs leading-3">
                        <small>{service.ready_replicas}</small>
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-muted-foreground">Total:&nbsp;</span>
                      <Badge variant={service.total > 0 ? "success" : "destructive"} className="h-3 px-1 text-xs leading-3">
                        <small>{service.total}</small>
                      </Badge>
                    </div>
                  </div>

                  {leaseStatus.forwarded_ports && leaseStatus.forwarded_ports[service.name]?.length > 0 && !isRemoteDeploy && (
                    <div className={cn({ ["mb-4"]: service.uris?.length > 0 })}>
                      <LabelValueOld
                        label="Forwarded Ports:"
                        value={
                          <div className="inline-flex items-center space-x-2">
                            {leaseStatus.forwarded_ports[service.name].map(p => (
                              <div key={"port_" + p.externalPort}>
                                {p.host ? (
                                  <Link
                                    className={cn({ ["cursor-none text-muted-foreground"]: p.available < 1 }, "inline-flex items-center space-x-2 text-sm")}
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

                  {isRemoteDeploy && repo && (
                    <div className="mt-2">
                      <LabelValueOld label="Deployed Repo:" />
                      <ul className="mt-2 space-y-2">
                        <li className="flex items-center">
                          <Link href={repo} target="_blank" className="inline-flex items-center space-x-2 truncate text-sm">
                            <span>{repo?.replace("https://github.com/", "")?.replace("https://gitlab.com/", "")}</span> <OpenInWindow className="text-xs" />
                          </Link>
                        </li>
                      </ul>
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
                                <CopyTextToClipboardButton value={uri} />
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
                  .map(ip => (
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
                        <InfoCircle className="text-xs text-muted-foreground" />
                      </CustomTooltip>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-full"
                        onClick={() => {
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

          {sshInstructions && (
            <div className="mt-4">
              <h5 className="font-bold dark:text-neutral-500">SSH Instructions:</h5>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  Open a command terminal on your machine and copy this command into it:
                  <CodeSnippet code={sshInstructions} />
                </li>
                <li>
                  Replace ~/.ssh/id_rsa with the path to the private key (stored on your local machine) corresponding to the public key you provided earlier
                </li>
                <li>Run the command</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);
