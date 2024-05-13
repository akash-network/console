"use client";
import { useState, useEffect, useMemo } from "react";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useWallet } from "@src/context/WalletProvider";
import { ApiProviderDetail, ClientProviderDetailWithStatus } from "@src/types/provider";
import { useProviderAttributesSchema, useProviderDetail, useProviderStatus } from "@src/queries/useProvidersQuery";
import { LabelValue } from "@src/components/shared/LabelValue";
import { CustomNoDivTooltip } from "@src/components/shared/CustomTooltip";
import { FormattedDate } from "react-intl";
import dynamic from "next/dynamic";
import ProviderDetailLayout, { ProviderDetailTabs } from "./ProviderDetailLayout";
import { Alert } from "@src/components/ui/alert";
import { ActiveLeasesGraph } from "./ActiveLeasesGraph";
import Spinner from "@src/components/shared/Spinner";
import { cn } from "@src/utils/styleUtils";
import { Card, CardContent } from "@src/components/ui/card";
import { ProviderSpecs } from "./ProviderSpecs";
import { Check } from "iconoir-react";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import Layout from "../layout/Layout";
import { UrlService, domainName } from "@src/utils/urlUtils";
import { differenceInMinutes, sub } from "date-fns";

const NetworkCapacity = dynamic(() => import("./NetworkCapacity"), {
  ssr: false
});

type Props = {
  owner: string;
  _provider: ApiProviderDetail;
};

export const ProviderDetail: React.FunctionComponent<Props> = ({ owner, _provider }) => {
  const [provider, setProvider] = useState<ClientProviderDetailWithStatus>(_provider as ClientProviderDetailWithStatus);
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
  } = useProviderStatus(provider?.hostUri || "", {
    enabled: true,
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

  function groupUptimeChecksByPeriod(uptimeChecks: { isOnline: boolean; checkDate: string }[] = []) {
    const groupedSnapshots: { checkDate: Date; checks: boolean[] }[] = [];

    const sortedUptimeChecks = uptimeChecks.toSorted((a, b) => new Date(a.checkDate).getTime() - new Date(b.checkDate).getTime());

    for (const snapshot of sortedUptimeChecks) {
      const recentGroup = groupedSnapshots.find(x => differenceInMinutes(new Date(snapshot.checkDate), x.checkDate) < 15);

      if (recentGroup) {
        recentGroup.checks.push(snapshot.isOnline);
      } else {
        groupedSnapshots.push({
          checkDate: new Date(snapshot.checkDate),
          checks: [snapshot.isOnline]
        });
      }
    }

    return groupedSnapshots.map(x => ({
      date: x.checkDate,
      status: x.checks.every(x => x) ? "online" : x.checks.every(x => !x) ? "offline" : "partial"
    }));
  }

  const uptimePeriods = useMemo(() => groupUptimeChecksByPeriod(provider?.uptime || []), [provider?.uptime]);
  const wasRecentlyOnline = provider && (provider.isOnline || (provider.lastCheckDate && new Date(provider.lastCheckDate) >= sub(new Date(), { hours: 24 })));

  return (
    <Layout isLoading={isLoading}>
      <CustomNextSeo title={`Provider detail ${provider?.name || provider?.owner}`} url={`${domainName}${UrlService.providerDetail(owner)}`} />

      <ProviderDetailLayout address={owner} page={ProviderDetailTabs.DETAIL} refresh={refresh} provider={provider}>
        {!provider && isLoading && (
          <div className="flex items-center justify-center">
            <Spinner size="large" />
          </div>
        )}

        {provider && !wasRecentlyOnline && !isLoading && (
          <Alert variant="warning" className="flex items-center justify-center p-8 text-lg">
            This provider is inactive.
          </Alert>
        )}

        {provider && wasRecentlyOnline && (
          <>
            <div className="mb-4">
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
            </div>

            <p className="mb-4">Up time (24h)</p>
            <div className="mb-8 flex items-center space-x-1">
              {uptimePeriods.map((x, i) => (
                <CustomNoDivTooltip
                  key={x.date.toISOString()}
                  title={<FormattedDate value={x.date} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />}
                >
                  <div
                    className={cn("h-[24px] w-[2%] max-w-[8px] rounded-[2px]", {
                      "bg-green-600": x.status === "online",
                      "bg-destructive": x.status === "offline",
                      "bg-warning": x.status === "partial"
                    })}
                  />
                </CustomNoDivTooltip>
              ))}
            </div>

            <ActiveLeasesGraph provider={provider} />
          </>
        )}

        {provider && providerAttributesSchema && (
          <>
            <div className="mt-4">
              <p className="mb-4">General Info</p>

              <Card className="mb-4">
                <CardContent className="mb-4 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <LabelValue label="Host" value={provider.host} />
                    <LabelValue label="Website" value={provider.website} />
                    <LabelValue label="Status page" value={provider.statusPage} />
                    <LabelValue label="Country" value={provider.country} />
                    <LabelValue label="Timezone" value={provider.timezone} />
                    <LabelValue label="Hosting Provider" value={provider.hostingProvider} />
                  </div>
                  <div>
                    <LabelValue label="Email" value={provider.email} />
                    <LabelValue label="Organization" value={provider.organization} />
                    <LabelValue label="Region" value={provider.locationRegion} />
                    <LabelValue label="City" value={provider.city} />
                    <LabelValue label="Location Type" value={provider.locationType} />
                    <LabelValue label="Tier" value={provider.tier} />
                  </div>
                </CardContent>
              </Card>

              <p className="mb-4">Specs</p>
              <ProviderSpecs provider={provider} />

              <p className="mb-4 mt-4">Features</p>
              <Card className="mb-4">
                <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <LabelValue label="Akash version" value={provider.akashVersion || "Unknown"} />
                    <LabelValue label="IP Leases" value={provider.featEndpointIp && <Check className="ml-0 text-primary sm:ml-2" />} />
                    <LabelValue label="Chia" value={provider.workloadSupportChia && <Check className="ml-0 text-primary sm:ml-2" />} />
                  </div>
                  <div>
                    <LabelValue label="Kube version" value={provider.kube ? `${provider.kube?.major}.${provider.kube?.minor}` : "Unkown"} />
                    <LabelValue label="Custom domain" value={provider.featEndpointCustomDomain && <Check className="ml-0 text-primary sm:ml-2" />} />
                    <LabelValue label="Chia capabilities" value={provider.workloadSupportChiaCapabilities} />
                  </div>
                </CardContent>
              </Card>

              <p className="mb-4">Stats</p>

              <Card className="mb-4">
                <CardContent className="p-4">
                  <LabelValue label="Deployments" value={provider.deploymentCount} />
                  <LabelValue label="Leases" value={provider.leaseCount} />
                  <LabelValue label="Orders" value={provider.orderCount || "0"} />
                  {provider.error && <LabelValue label="Errors" value={provider.error} />}
                </CardContent>
              </Card>
            </div>

            <p className="mb-4">Raw attributes</p>
            <Card>
              <CardContent className="p-4">
                {provider.attributes.map(x => (
                  <LabelValue key={x.key} label={x.key} value={x.value} />
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </ProviderDetailLayout>
    </Layout>
  );
};
