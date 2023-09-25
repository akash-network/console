import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import Layout from "@src/components/layout/Layout";
import { LeaseList } from "@src/components/providers/LeaseList";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { ClientProviderDetailWithStatus } from "@src/types/provider";
import { useProviderDetail, useProviderStatus } from "@src/queries/useProvidersQuery";
import ProviderDetailLayout, { ProviderDetailTabs } from "@src/components/providers/ProviderDetailLayout";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  owner: string;
};

const ProviderLeasesPage: React.FunctionComponent<Props> = ({ owner }) => {
  const [provider, setProvider] = useState<Partial<ClientProviderDetailWithStatus>>(null);
  const [filteredLeases, setFilteredLeases] = useState(null);
  const router = useRouter();
  const { isLoading: isLoadingProvider, refetch: getProviderDetail } = useProviderDetail(owner, {
    enabled: false,
    retry: false,
    onSuccess: _providerDetail => {
      setProvider(provider => (provider ? { ...provider, ..._providerDetail } : _providerDetail));
    }
  });
  const { address } = useKeplr();
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
      <CustomNextSeo title={`Provider leases for ${owner}`} url={`https://deploy.cloudmos.io${UrlService.providerDetailLeases(owner)}`} />

      <ProviderDetailLayout address={owner} page={ProviderDetailTabs.LEASES} refresh={refresh} provider={provider}>
        <LeaseList isLoadingLeases={isLoadingLeases} leases={filteredLeases} />
      </ProviderDetailLayout>
    </Layout>
  );
};

export default ProviderLeasesPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      owner: params?.owner
    }
  };
}
