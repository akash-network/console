import { useState, useEffect } from "react";
import { Typography, Box, Paper, useTheme, CircularProgress, Alert } from "@mui/material";
import { useAkashProviders } from "../../../context/AkashProvider";
import { useRouter } from "next/router";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { ProviderDetail } from "@src/types/provider";
import { useProviderAttributesSchema, useProviderStatus } from "@src/queries/useProvidersQuery";
import ProviderDetailLayout, { ProviderDetailTabs } from "@src/components/providers/ProviderDetailLayout";
import { ProviderSpecs } from "@src/components/providers/ProviderSpecs";
import { LabelValue } from "@src/components/shared/LabelValue";
import { getProviderAttributeValue } from "@src/utils/providerAttributes/helpers";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import { FormattedDate } from "react-intl";
import dynamic from "next/dynamic";
import { ActiveLeasesGraph } from "@src/components/providers/ActiveLeasesGraph";
import { makeStyles } from "tss-react/mui";
import CheckIcon from "@mui/icons-material/Check";

const NetworkCapacity = dynamic(() => import("../../../components/providers/NetworkCapacity"), {
  ssr: false
});

type Props = {
  owner: string;
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

const ProviderDetailPage: React.FunctionComponent<Props> = ({ owner }) => {
  const [provider, setProvider] = useState<Partial<ProviderDetail>>(null);
  const { classes } = useStyles();
  const router = useRouter();
  const theme = useTheme();
  const { providers, getProviders, isLoadingProviders } = useAkashProviders();
  const { address } = useKeplr();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });
  const { data: providerAttributesSchema, isFetching: isLoadingSchema } = useProviderAttributesSchema();
  const {
    data: providerStatus,
    isLoading: isLoadingStatus,
    refetch: getProviderStatus,
    isError
  } = useProviderStatus(provider?.host_uri, {
    enabled: false,
    retry: false,
    onSuccess: _providerStatus => {
      setProvider(provider => (provider ? { ...provider, ...providerStatus } : providerStatus));
    }
  });
  const isLoading = isLoadingProviders || isLoadingStatus || isLoadingLeases || isLoadingSchema;

  useEffect(() => {
    if (provider) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  useEffect(() => {
    const providerFromList = providers?.find(d => d.owner === owner);

    if (providerFromList) {
      const numberOfDeployments = leases?.filter(d => d.provider === providerFromList.owner).length || 0;
      const numberOfActiveLeases = leases?.filter(d => d.provider === providerFromList.owner && d.state === "active").length || 0;

      setProvider({ ...providerFromList, userLeases: numberOfDeployments, userActiveLeases: numberOfActiveLeases });
    } else {
      // TODO Provider not found handle display
    }
  }, [leases, providers]);

  const refresh = () => {
    getProviders();
    getLeases();
    getProviderStatus();
  };

  return (
    <Layout isLoading={isLoading}>
      <NextSeo title={`Provider detail ${owner}`} />

      <ProviderDetailLayout address={owner} page={ProviderDetailTabs.DETAIL} refresh={refresh} provider={provider}>
        {!provider && isLoading && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress color="secondary" size="4rem" />
          </Box>
        )}

        {provider && !provider.isActive && (
          <Alert
            variant="outlined"
            severity="warning"
            sx={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontSize: "1rem" }}
          >
            This provider is inactive.
          </Alert>
        )}

        {provider && provider.isActive && (
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
                  <LabelValue label="Host" value={getProviderAttributeValue("host", provider, providerAttributesSchema)} />
                  <LabelValue label="Website" value={getProviderAttributeValue("website", provider, providerAttributesSchema)} />
                  <LabelValue label="Status page" value={getProviderAttributeValue("status-page", provider, providerAttributesSchema)} />
                  <LabelValue label="Country" value={getProviderAttributeValue("country", provider, providerAttributesSchema)} />
                  <LabelValue label="Timezone" value={getProviderAttributeValue("timezone", provider, providerAttributesSchema)} />
                  <LabelValue label="Hosting Provider" value={getProviderAttributeValue("hosting-provider", provider, providerAttributesSchema)} />
                </Box>
                <Box>
                  <LabelValue label="Email" value={provider.info.email} />
                  <LabelValue label="Organization" value={getProviderAttributeValue("organization", provider, providerAttributesSchema)} />
                  <LabelValue label="Region" value={getProviderAttributeValue("location-region", provider, providerAttributesSchema)} />
                  <LabelValue label="City" value={getProviderAttributeValue("city", provider, providerAttributesSchema)} />
                  <LabelValue label="Location Type" value={getProviderAttributeValue("location-type", provider, providerAttributesSchema)} />
                  <LabelValue label="Tier" value={getProviderAttributeValue("tier", provider, providerAttributesSchema)} />
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
                  <LabelValue
                    label="IP Leases"
                    value={
                      getProviderAttributeValue("feat-endpoint-ip", provider, providerAttributesSchema) === "true" && (
                        <CheckIcon sx={{ marginLeft: ".5rem" }} color="secondary" />
                      )
                    }
                  />
                  <LabelValue
                    label="Chia"
                    value={
                      getProviderAttributeValue("workload-support-chia", provider, providerAttributesSchema) === "true" && (
                        <CheckIcon sx={{ marginLeft: ".5rem" }} color="secondary" />
                      )
                    }
                  />
                </Box>
                <Box>
                  <LabelValue label="Kube version" value={provider.kube ? `${provider.kube?.major}.${provider.kube?.minor}` : "Unkown"} />
                  <LabelValue
                    label="Custom domain"
                    value={
                      getProviderAttributeValue("feat-endpoint-custom-domain", provider, providerAttributesSchema) === "true" && (
                        <CheckIcon sx={{ marginLeft: ".5rem" }} color="secondary" />
                      )
                    }
                  />
                  <LabelValue
                    label="Chia capabilities"
                    value={getProviderAttributeValue("workload-support-chia-capabilities", provider, providerAttributesSchema)}
                  />
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

export async function getServerSideProps({ params }) {
  return {
    props: {
      owner: params?.owner
    }
  };
}
