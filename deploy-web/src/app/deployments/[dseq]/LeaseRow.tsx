import React, { SetStateAction, useCallback } from "react";
import { useEffect, useState } from "react";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import LaunchIcon from "@mui/icons-material/Launch";
import InfoIcon from "@mui/icons-material/Info";
import CheckIcon from "@mui/icons-material/CheckCircle";
import { useCertificate } from "../../../context/CertificateProvider";
import { useSnackbar } from "notistack";
import { makeStyles } from "tss-react/mui";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useLeaseStatus } from "@src/queries/useLeaseQuery";
import { useProviderStatus } from "@src/queries/useProvidersQuery";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
  useTheme
} from "@mui/material";
import { deploymentData } from "@src/utils/deploymentData";
import { getGpusFromAttributes, sendManifestToProvider } from "@src/utils/deploymentUtils";
import { LabelValueOld } from "../../../components/shared/LabelValueOld";
import { StatusPill } from "../../../components/shared/StatusPill";
import { LinkTo } from "../../../components/shared/LinkTo";
import { SpecDetail } from "../../../components/shared/SpecDetail";
import { PricePerMonth } from "../../../components/shared/PricePerMonth";
import { PriceEstimateTooltip } from "../../../components/shared/PriceEstimateTooltip";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { FavoriteButton } from "../../../components/shared/FavoriteButton";
import { AuditorButton } from "../../../components/providers/AuditorButton";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { cx } from "@emotion/css";
import { getSplitText } from "@src/hooks/useShortText";
import { ApiProviderList } from "@src/types/provider";
import { LeaseDto } from "@src/types/deployment";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { useBidInfo } from "@src/queries/useBidQuery";

const yaml = require("js-yaml");

const useStyles = makeStyles()(theme => ({
  root: {
    marginBottom: "1rem"
  },
  cardHeader: {
    borderBottom: "1px solid rgba(0,0,0,0.1)",
    padding: ".5rem 1rem",
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[100]
  },
  cardHeaderTitle: {
    fontSize: "18px"
  },
  listItem: {
    borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`
  },
  link: {
    display: "flex",
    alignItems: "center"
  },
  tooltip: {
    fontSize: "1rem"
  },
  tooltipIcon: {
    fontSize: "1rem",
    color: theme.palette.grey[500]
  },
  whiteLink: {
    fontWeight: "bold",
    color: theme.palette.common.white
  },
  marginLeft: {
    marginLeft: "1rem"
  },
  serviceChip: {
    height: ".875rem",
    lineHeight: ".875rem",
    fontSize: ".5rem",
    fontWeight: "bold"
  },
  activeLeaseIcon: {
    fontSize: "1rem",
    display: "flex",
    color: theme.palette.success.dark
  }
}));

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
  const { enqueueSnackbar } = useSnackbar();
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
  } = useLeaseStatus(provider?.hostUri, lease, {
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
  } = useProviderStatus(provider?.hostUri, {
    enabled: false,
    retry: false
  });
  const isLeaseNotFound = error && (error as string).includes && (error as string).includes("lease not found") && isLeaseActive;
  const servicesNames = leaseStatus ? Object.keys(leaseStatus.services) : [];
  const { classes } = useStyles();
  const theme = useTheme();
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

      await sendManifestToProvider(provider, manifest, dseq, localCert);

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
    <Card className={classes.root} elevation={4}>
      <CardHeader
        classes={{ title: classes.cardHeaderTitle, root: classes.cardHeader }}
        title={
          <Box display="flex" alignItems="center">
            <Typography variant="caption" sx={{ display: "inline-flex", alignItems: "center" }}>
              <span>{lease.state}</span>
              <StatusPill state={lease.state} size="small" />

              <Box
                component="span"
                sx={{
                  marginLeft: "1rem",
                  color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.primary.main
                }}
              >
                GSEQ:
              </Box>
              <Box component="span" sx={{ marginLeft: ".25rem" }}>
                {lease.gseq}
              </Box>

              <Box component="span" sx={{ marginLeft: "1rem", color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.primary.main }}>
                OSEQ:
              </Box>
              <Box component="span" sx={{ marginLeft: ".25rem" }}>
                {lease.oseq}
              </Box>
            </Typography>

            {isLeaseActive && (
              <Box marginLeft="1rem" display="inline-flex">
                <LinkTo onClick={() => setActiveTab("LOGS")}>View logs</LinkTo>
              </Box>
            )}
          </Box>
        }
      />
      <CardContent>
        <Box display="flex">
          <Box>
            <Box paddingBottom="1rem">
              <SpecDetail
                cpuAmount={lease.cpuAmount}
                gpuAmount={lease.gpuAmount}
                gpuModels={gpuModels}
                memoryAmount={lease.memoryAmount}
                storageAmount={lease.storageAmount}
                color={isLeaseActive ? "primary" : "default"}
                size="medium"
              />
            </Box>
            <LabelValueOld
              label="Price:"
              value={
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <PricePerMonth denom={lease.price.denom} perBlockValue={udenomToDenom(lease.price.amount, 10)} sx={{ fontSize: "1.25rem" }} />
                  <PriceEstimateTooltip denom={lease.price.denom} value={lease.price.amount} />
                </Box>
              }
            />

            {isLeaseActive && (
              <LabelValueOld
                label="Provider:"
                value={
                  <>
                    {isLoadingProviderStatus && <CircularProgress size="1rem" color="secondary" />}
                    {providerStatus && (
                      <>
                        <Link href={UrlService.providerDetail(lease.provider)}>
                          {providerStatus.name?.length > 25 ? getSplitText(providerStatus.name, 10, 10) : providerStatus.name}
                        </Link>

                        <Box display="flex" alignItems="center" marginLeft={1}>
                          <FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />

                          {provider.isAudited && (
                            <Box marginLeft=".5rem">
                              <AuditorButton provider={provider} />
                            </Box>
                          )}
                        </Box>
                      </>
                    )}
                  </>
                }
                marginTop=".25rem"
                marginBottom="1rem"
              />
            )}
          </Box>
        </Box>

        {isLeaseNotFound && (
          <Alert severity="warning">
            The lease was not found on this provider. This can happen if no manifest was sent to the provider. To send one you can update your deployment in the{" "}
            <LinkTo onClick={handleEditManifestClick}>VIEW / EDIT MANIFEST</LinkTo> tab.
            {deploymentManifest && (
              <>
                <Box margin="1rem 0">
                  <strong>OR</strong>
                </Box>
                <Button variant="contained" color="secondary" disabled={isSendingManifest} onClick={sendManifest} size="small">
                  {isSendingManifest ? <CircularProgress size="1.5rem" color="secondary" /> : <span>Send manifest manually</span>}
                </Button>
              </>
            )}
          </Alert>
        )}

        {!leaseStatus && isLoadingLeaseStatus && <CircularProgress size="1rem" color="secondary" />}

        {isLeaseActive &&
          leaseStatus &&
          leaseStatus.services &&
          servicesNames
            .map(n => leaseStatus.services[n])
            .map((service, i) => (
              <Box
                pb={servicesNames.length === i + 1 ? 0 : 2}
                mb={servicesNames.length === i + 1 ? 0 : 2}
                borderBottom={
                  servicesNames.length === i + 1 ? 0 : `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[700] : theme.palette.grey[300]}`
                }
                key={`${service.name}_${i}`}
              >
                <Box display="flex" alignItems="center">
                  <LabelValueOld label="Group:" value={service.name} fontSize="1rem" />
                  {isLoadingLeaseStatus || !isServicesAvailable ? (
                    <Box display="inline-flex" marginLeft="1rem">
                      <CircularProgress size="1rem" color="secondary" />
                    </Box>
                  ) : (
                    <Box display="inline-flex" marginLeft=".5rem">
                      <Tooltip
                        classes={{ tooltip: classes.tooltip }}
                        arrow
                        title={
                          <>
                            Workloads can take some time to spin up. If you see an error when browsing the uri, it is recommended to refresh and wait a bit.
                            Check the{" "}
                            <LinkTo onClick={() => setActiveTab("LOGS")} className={classes.whiteLink}>
                              logs
                            </LinkTo>{" "}
                            for more information.
                          </>
                        }
                      >
                        <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                      </Tooltip>
                    </Box>
                  )}

                  {isServicesAvailable && (
                    <Box marginLeft=".5rem">
                      <CheckIcon className={classes.activeLeaseIcon} />
                    </Box>
                  )}
                </Box>

                <Box
                  display="flex"
                  alignItems="center"
                  mb={service.uris?.length > 0 || (leaseStatus.forwarded_ports && leaseStatus.forwarded_ports[service.name]?.length > 0) ? "1rem" : 0}
                >
                  <Box display="flex" alignItems="center">
                    <Typography variant="caption">Available:&nbsp;</Typography>
                    <Chip label={service.available} size="small" color="default" className={classes.serviceChip} />
                  </Box>
                  <Box display="flex" alignItems="center">
                    <Typography variant="caption" className={classes.marginLeft}>
                      Ready Replicas:&nbsp;
                    </Typography>
                    <Chip label={service.ready_replicas} size="small" color="default" className={classes.serviceChip} />
                  </Box>
                  <Box display="flex" alignItems="center">
                    <Typography variant="caption" className={classes.marginLeft}>
                      Total:&nbsp;
                    </Typography>
                    <Chip label={service.total} size="small" color="default" className={classes.serviceChip} />
                  </Box>
                </Box>

                {leaseStatus.forwarded_ports && leaseStatus.forwarded_ports[service.name]?.length > 0 && (
                  <Box marginTop=".5rem" mb={service.uris?.length > 0 ? "1rem" : 0}>
                    <LabelValueOld
                      label="Forwarded Ports:"
                      value={leaseStatus.forwarded_ports[service.name].map(p => (
                        <Box key={"port_" + p.externalPort} display="inline" mr={0.5}>
                          {p.host ? (
                            <LinkTo label={``} disabled={p.available < 1} onClick={ev => handleExternalUrlClick(ev, `${p.host}:${p.externalPort}`)}>
                              {p.port}:{p.externalPort}
                            </LinkTo>
                          ) : (
                            <>
                              <Chip label={`${p.port}:${p.externalPort}`} size="small" />
                            </>
                          )}
                        </Box>
                      ))}
                    />
                  </Box>
                )}

                {service.uris?.length > 0 && (
                  <>
                    <Box marginTop=".5rem">
                      <LabelValueOld label="URI(s):" />
                      <List dense>
                        {service.uris.map(uri => {
                          return (
                            <ListItem key={uri} dense sx={{ padding: ".2rem 0" }}>
                              <ListItemText
                                primary={
                                  <Box display="flex" alignItems="center">
                                    <LinkTo className={cx(classes.link, "text-truncate")} onClick={ev => handleExternalUrlClick(ev, uri)}>
                                      {uri} <LaunchIcon fontSize="small" />
                                    </LinkTo>
                                    &nbsp;&nbsp;
                                    <IconButton
                                      edge="end"
                                      aria-label="uri"
                                      size="small"
                                      onClick={ev => {
                                        copyTextToClipboard(uri);
                                        enqueueSnackbar(<Snackbar title="Uri copied to clipboard!" iconVariant="success" />, {
                                          variant: "success",
                                          autoHideDuration: 2000
                                        });
                                      }}
                                    >
                                      <FileCopyIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                }
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    </Box>
                  </>
                )}
              </Box>
            ))}

        {isLeaseActive && leaseStatus && leaseStatus.ips && (
          <Box marginTop=".5rem">
            <LabelValueOld label="IP(s):" />
            <List dense>
              {servicesNames
                .map(n => leaseStatus.ips[n])
                .map((ips, i) => {
                  return ips?.map((ip, ii) => (
                    <ListItem key={`${ip.IP}${ip.ExternalPort}`}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center">
                            <LinkTo className={classes.link} onClick={ev => handleExternalUrlClick(ev, ip.IP)}>
                              {ip.IP}:{ip.ExternalPort} <LaunchIcon fontSize="small" />
                            </LinkTo>
                            &nbsp;&nbsp;
                            <Tooltip
                              classes={{ tooltip: classes.tooltip }}
                              arrow
                              title={
                                <>
                                  <div>IP:&nbsp;{ip.IP}</div>
                                  <div>External Port:&nbsp;{ip.ExternalPort}</div>
                                  <div>Port:&nbsp;{ip.Port}</div>
                                  <div>Protocol:&nbsp;{ip.Protocol}</div>
                                </>
                              }
                            >
                              <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                            </Tooltip>
                            &nbsp;&nbsp;
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={ev => {
                                copyTextToClipboard(ip.IP);
                                enqueueSnackbar(<Snackbar title="Ip copied to clipboard!" iconVariant="success" />, {
                                  variant: "success",
                                  autoHideDuration: 2000
                                });
                              }}
                            >
                              <FileCopyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                      />
                    </ListItem>
                  ));
                })}
            </List>
          </Box>
        )}
      </CardContent>
    </Card>
  );
});
