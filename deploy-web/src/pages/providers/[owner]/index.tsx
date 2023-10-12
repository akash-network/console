import { useState, useEffect } from "react";
import { Typography, Box, Paper, useTheme, CircularProgress, Alert } from "@mui/material";
import { useRouter } from "next/router";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import Layout from "@src/components/layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import { ApiProviderDetail, ClientProviderDetailWithStatus } from "@src/types/provider";
import { useProviderAttributesSchema, useProviderDetail, useProviderStatus } from "@src/queries/useProvidersQuery";
import ProviderDetailLayout, { ProviderDetailTabs } from "@src/components/providers/ProviderDetailLayout";
import { ProviderSpecs } from "@src/components/providers/ProviderSpecs";
import { LabelValue } from "@src/components/shared/LabelValue";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import { FormattedDate } from "react-intl";
import dynamic from "next/dynamic";
import { ActiveLeasesGraph } from "@src/components/providers/ActiveLeasesGraph";
import { makeStyles } from "tss-react/mui";
import CheckIcon from "@mui/icons-material/Check";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { UrlService } from "@src/utils/urlUtils";
import { getNetworkBaseApiUrl } from "@src/utils/constants";
import axios from "axios";

const NetworkCapacity = dynamic(() => import("../../../components/providers/NetworkCapacity"), {
  ssr: false
});

type Props = {
  owner: string;
  _provider: ApiProviderDetail;
};

const useStyles = makeStyles()(theme => ({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,1fr)",
    gap: "1rem",
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(1,1fr)"
    }
  }
}));

const ProviderDetailPage: React.FunctionComponent<Props> = ({ owner, _provider }) => {
  const [provider, setProvider] = useState<Partial<ClientProviderDetailWithStatus>>(_provider);
  const { classes } = useStyles();
  const router = useRouter();
  const theme = useTheme();
  const { address } = useWallet();
  const { isLoading: isLoadingProvider, refetch: getProviderDetail } = useProviderDetail(owner, {
    enabled: false,
    retry: false,
    onSuccess: _providerDetail => {
      setProvider(provider => (provider ? { ...provider, ..._providerDetail } : _providerDetail));
    }
  });
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });
  const { data: providerAttributesSchema, isFetching: isLoadingSchema } = useProviderAttributesSchema();
  const {
    data: providerStatus,
    isLoading: isLoadingStatus,
    refetch: getProviderStatus
  } = useProviderStatus(provider?.hostUri, {
    enabled: false,
    retry: false,
    onSuccess: _providerStatus => {
      setProvider(provider => (provider ? { ...provider, ..._providerStatus } : _providerStatus));
    }
  });
  const isLoading = isLoadingProvider || isLoadingStatus || isLoadingLeases || isLoadingSchema;

  useEffect(() => {
    getProviderDetail();
    getLeases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (provider && !providerStatus) {
      getProviderStatus();
    }
  }, [provider, providerStatus]);

  useEffect(() => {
    if (leases) {
      const numberOfDeployments = leases?.filter(d => d.provider === owner).length || 0;
      const numberOfActiveLeases = leases?.filter(d => d.provider === owner && d.state === "active").length || 0;

      setProvider(provider => ({ ...provider, userLeases: numberOfDeployments, userActiveLeases: numberOfActiveLeases }));
    }
  }, [leases]);

  const refresh = () => {
    getProviderDetail();
    getLeases();
    getProviderStatus();
  };

  return (
    <Layout isLoading={isLoading}>
      <CustomNextSeo title={`Provider detail ${provider?.name || provider?.owner}`} url={`https://deploy.cloudmos.io${UrlService.providerDetail(owner)}`} />

      <ProviderDetailLayout address={owner} page={ProviderDetailTabs.DETAIL} refresh={refresh} provider={provider}>
        {!provider && isLoading && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress color="secondary" size="4rem" />
          </Box>
        )}

        {provider && !provider.isOnline && !isLoading && (
          <Alert
            variant="outlined"
            severity="warning"
            sx={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontSize: "1rem" }}
          >
            This provider is inactive.
          </Alert>
        )}

        {provider && provider.isOnline && (
          <>
            <Box sx={{ marginBottom: "1rem" }}>
              <NetworkCapacity
                activeCPU={provider.activeStats.cpu / 1000}
                activeGPU={provider.activeStats.gpu}
                activeMemory={provider.activeStats.memory}
                activeStorage={provider.activeStats.storage}
                pendingCPU={provider.pendingStats.cpu / 1000}
                pendingGPU={provider.pendingStats.gpu}
                pendingMemory={provider.pendingStats.memory}
                pendingStorage={provider.pendingStats.storage}
                totalCPU={(provider.availableStats.cpu + provider.pendingStats.cpu + provider.activeStats.cpu) / 1000}
                totalGPU={provider.availableStats.gpu + provider.pendingStats.gpu + provider.activeStats.gpu}
                totalMemory={provider.availableStats.memory + provider.pendingStats.memory + provider.activeStats.memory}
                totalStorage={provider.availableStats.storage + provider.pendingStats.storage + provider.activeStats.storage}
              />
            </Box>

            <Typography variant="body2" sx={{ marginBottom: "1rem" }}>
              Up time (24h)
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", marginBottom: "2rem" }}>
              {provider?.uptime
                // sort by date
                .sort((a, b) => new Date(a.checkDate).getTime() - new Date(b.checkDate).getTime())
                .map((x, i) => (
                  <CustomTooltip
                    key={x.id}
                    title={<FormattedDate value={x.checkDate} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />}
                    leaveDelay={0}
                  >
                    <Box
                      sx={{
                        width: "2%",
                        height: "24px",
                        marginLeft: i > 0 ? ".25rem" : 0,
                        backgroundColor: x.isOnline ? theme.palette.success.main : theme.palette.error.main,
                        borderRadius: "2px"
                      }}
                    ></Box>
                  </CustomTooltip>
                ))}
            </Box>

            <ActiveLeasesGraph provider={provider} />
          </>
        )}

        {provider && providerAttributesSchema && (
          <>
            <Box sx={{ marginTop: "1rem" }}>
              <Typography variant="body2" sx={{ marginBottom: "1rem" }}>
                General Info
              </Typography>

              <Paper sx={{ padding: "1rem", marginBottom: "1rem" }} className={classes.grid}>
                <Box>
                  <LabelValue label="Host" value={provider.host} />
                  <LabelValue label="Website" value={provider.website} />
                  <LabelValue label="Status page" value={provider.statusPage} />
                  <LabelValue label="Country" value={provider.country} />
                  <LabelValue label="Timezone" value={provider.timezone} />
                  <LabelValue label="Hosting Provider" value={provider.hostingProvider} />
                </Box>
                <Box>
                  <LabelValue label="Email" value={provider.email} />
                  <LabelValue label="Organization" value={provider.organization} />
                  <LabelValue label="Region" value={provider.locationRegion} />
                  <LabelValue label="City" value={provider.city} />
                  <LabelValue label="Location Type" value={provider.locationType} />
                  <LabelValue label="Tier" value={provider.tier} />
                </Box>
              </Paper>

              <Typography variant="body2" sx={{ marginBottom: "1rem" }}>
                Specs
              </Typography>
              <ProviderSpecs provider={provider} providerAttributesSchema={providerAttributesSchema} />

              <Typography variant="body2" sx={{ marginBottom: "1rem", marginTop: "1rem" }}>
                Features
              </Typography>
              <Paper sx={{ padding: "1rem", marginBottom: "1rem" }} className={classes.grid}>
                <Box>
                  <LabelValue label="Akash version" value={provider.akashVersion || "Unknown"} />
                  <LabelValue label="IP Leases" value={provider.featEndpointIp && <CheckIcon sx={{ marginLeft: ".5rem" }} color="secondary" />} />
                  <LabelValue label="Chia" value={provider.workloadSupportChia && <CheckIcon sx={{ marginLeft: ".5rem" }} color="secondary" />} />
                </Box>
                <Box>
                  <LabelValue label="Kube version" value={provider.kube ? `${provider.kube?.major}.${provider.kube?.minor}` : "Unkown"} />
                  <LabelValue label="Custom domain" value={provider.featEndpointCustomDomain && <CheckIcon sx={{ marginLeft: ".5rem" }} color="secondary" />} />
                  <LabelValue label="Chia capabilities" value={provider.workloadSupportChiaCapabilities} />
                </Box>
              </Paper>

              <Typography variant="body2" sx={{ marginBottom: "1rem" }}>
                Stats
              </Typography>
              <Paper sx={{ padding: "1rem", marginBottom: "1rem" }}>
                <LabelValue label="Deployments" value={provider.deploymentCount} />
                <LabelValue label="Leases" value={provider.leaseCount} />
                <LabelValue label="Orders" value={provider.orderCount || "0"} />
                {provider.error && <LabelValue label="Errors" value={provider.error} />}
              </Paper>
            </Box>

            <Typography variant="body2" sx={{ marginBottom: "1rem" }}>
              Raw attributes
            </Typography>
            <Paper elevation={1} sx={{ padding: "1rem" }}>
              {provider.attributes.map(x => (
                <LabelValue key={x.key} label={x.key} value={x.value} />
              ))}
            </Paper>
          </>
        )}
      </ProviderDetailLayout>
    </Layout>
  );
};

export default ProviderDetailPage;

export async function getServerSideProps({ params, query }) {
  const apiUrl = getNetworkBaseApiUrl(query.network as string);
  const response = await axios.get(`${apiUrl}/providers/${params?.owner}`);

  return {
    props: {
      owner: params?.owner,
      _provider: response.data
    }
  };
}

