"use client";
import { useEffect, useState } from "react";

import { DynamicReactJson } from "@src/components/shared/DynamicJsonView";
import { useWallet } from "@src/context/WalletProvider";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useProviderDetail, useProviderStatus } from "@src/queries/useProvidersQuery";
import { ApiProviderList, ClientProviderDetailWithStatus } from "@src/types/provider";
import { domainName, UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import ProviderDetailLayout, { ProviderDetailTabs } from "./ProviderDetailLayout";

export const COMPONENTS = {
  Layout,
  CustomNextSeo,
  ProviderDetailLayout,
  DynamicReactJson
};

type Props = {
  owner: string;
  components?: typeof COMPONENTS;
};

export const ProviderRawData: React.FunctionComponent<Props> = ({ owner, components: c = COMPONENTS }) => {
  const [provider, setProvider] = useState<Partial<ClientProviderDetailWithStatus> | null>(null);
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
      setProvider(provider => (provider ? { ...provider, ...providerStatus } : providerStatus));
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

      setProvider(provider => ({ ...provider, userLeases: numberOfDeployments, userActiveLeases: numberOfActiveLeases }));
    }
  }, [leases]);

  const refresh = () => {
    getProviderDetail();
    getLeases();
    getProviderStatus();
  };

  return (
    <c.Layout isLoading={isLoadingLeases || isLoadingProvider || isLoadingStatus}>
      <c.CustomNextSeo title={`Provider raw data for ${owner}`} url={`${domainName}${UrlService.providerDetailRaw(owner)}`} />

      <c.ProviderDetailLayout address={owner} page={ProviderDetailTabs.RAW} refresh={refresh} provider={provider as ClientProviderDetailWithStatus}>
        {provider && <c.DynamicReactJson src={JSON.parse(JSON.stringify(provider))} collapsed={1} />}
      </c.ProviderDetailLayout>
    </c.Layout>
  );
};
