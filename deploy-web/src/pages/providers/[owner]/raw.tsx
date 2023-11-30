import { useState, useEffect } from "react";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import Layout from "@src/components/layout/Layout";
import { useWallet } from "@src/context/WalletProvider";
import { ClientProviderDetailWithStatus } from "@src/types/provider";
import { useProviderDetail, useProviderStatus } from "@src/queries/useProvidersQuery";
import ProviderDetailLayout, { ProviderDetailTabs } from "@src/components/providers/ProviderDetailLayout";
import { DynamicReactJson } from "@src/components/shared/DynamicJsonView";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  owner: string;
};

const ProviderRawPage: React.FunctionComponent<Props> = ({ owner }) => {
  const [provider, setProvider] = useState<Partial<ClientProviderDetailWithStatus>>(null);
  const { isLoading: isLoadingProvider, refetch: getProviderDetail } = useProviderDetail(owner, {
    enabled: false,
    retry: false,
    onSuccess: _providerDetail => {
      setProvider(provider => (provider ? { ...provider, ..._providerDetail } : _providerDetail));
    }
  });
  const { address } = useWallet();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });
  const {
    data: providerStatus,
    isLoading: isLoadingStatus,
    refetch: getProviderStatus
  } = useProviderStatus(provider?.hostUri, {
    enabled: false,
    retry: false,
    onSuccess: _providerStatus => {
      setProvider(provider => (provider ? { ...provider, ...providerStatus } : providerStatus));
    }
  });

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
    <Layout isLoading={isLoadingLeases || isLoadingProvider || isLoadingStatus}>
      <CustomNextSeo title={`Provider raw data for ${owner}`} url={`https://console.akash.network${UrlService.providerDetailRaw(owner)}`} />

      <ProviderDetailLayout address={owner} page={ProviderDetailTabs.RAW} refresh={refresh} provider={provider}>
        {provider && <DynamicReactJson src={JSON.parse(JSON.stringify(provider))} collapsed={1} />}
      </ProviderDetailLayout>
    </Layout>
  );
};

export default ProviderRawPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      owner: params?.owner
    }
  };
}

