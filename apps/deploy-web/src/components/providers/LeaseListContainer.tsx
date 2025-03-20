"use client";
import { useEffect, useState } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useProviderDetail, useProviderStatus } from "@src/queries/useProvidersQuery";
import { LeaseDto } from "@src/types/deployment";
import { ApiProviderList, ClientProviderDetailWithStatus } from "@src/types/provider";
import { domainName, UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { LeaseList } from "./LeaseList";
import ProviderDetailLayout, { ProviderDetailTabs } from "./ProviderDetailLayout";

type Props = {
  owner: string;
};

export const LeaseListContainer: React.FunctionComponent<Props> = ({ owner }) => {
  const [provider, setProvider] = useState<Partial<ClientProviderDetailWithStatus> | null>(null);
  const [filteredLeases, setFilteredLeases] = useState<Array<LeaseDto> | null>(null);
  const {
    data: providerDetail,
    isLoading: isLoadingProvider,
    refetch: getProviderDetail
  } = useProviderDetail(owner, {
    enabled: false,
    retry: false
  });
  useEffect(() => {
    if (providerDetail) {
      setProvider(provider => (provider ? { ...provider, ...providerDetail } : providerDetail));
    }
  }, [providerDetail]);

  const { address } = useWallet();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });
  const {
    data: providerStatus,
    isLoading: isLoadingStatus,
    refetch: getProviderStatus
  } = useProviderStatus(provider as ApiProviderList, {
    enabled: false,
    retry: false
  });
  useEffect(() => {
    if (providerStatus) {
      setProvider(provider => (provider ? { ...provider, ...providerStatus } : (providerStatus as ClientProviderDetailWithStatus)));
    }
  }, [providerStatus]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (leases) {
      const numberOfDeployments = leases?.filter(d => d.provider === owner).length || 0;
      const numberOfActiveLeases = leases?.filter(d => d.provider === owner && d.state === "active").length || 0;

      setProvider({ ...provider, userLeases: numberOfDeployments, userActiveLeases: numberOfActiveLeases });
    }
  }, [leases]);

  const refresh = () => {
    getProviderDetail();
    getLeases();
    getProviderStatus();
  };

  useEffect(() => {
    if (provider && leases && leases.length > 0) {
      const _leases = leases?.filter(d => d.provider === provider.owner);
      setFilteredLeases(_leases);
    }
  }, [leases, provider]);

  return (
    <Layout isLoading={isLoadingLeases || isLoadingProvider || isLoadingStatus}>
      <CustomNextSeo title={`Provider leases for ${owner}`} url={`${domainName}${UrlService.providerDetailLeases(owner)}`} />

      <ProviderDetailLayout address={owner} page={ProviderDetailTabs.LEASES} refresh={refresh} provider={provider as ClientProviderDetailWithStatus}>
        <LeaseList isLoadingLeases={isLoadingLeases} leases={filteredLeases} />
      </ProviderDetailLayout>
    </Layout>
  );
};
