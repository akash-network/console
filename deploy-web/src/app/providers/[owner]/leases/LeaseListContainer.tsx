"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useWallet } from "@src/context/WalletProvider";
import { ClientProviderDetailWithStatus } from "@src/types/provider";
import { useProviderDetail, useProviderStatus } from "@src/queries/useProvidersQuery";
import { LeaseList } from "./LeaseList";
import { PageContainer } from "@src/components/shared/PageContainer";
import { LeaseDto } from "@src/types/deployment";
import ProviderDetailLayout, { ProviderDetailTabs } from "../ProviderDetailLayout";

type Props = {
  owner: string;
};

export const LeaseListContainer: React.FunctionComponent<Props> = ({ owner }) => {
  const [provider, setProvider] = useState<Partial<ClientProviderDetailWithStatus> | null>(null);
  const [filteredLeases, setFilteredLeases] = useState<Array<LeaseDto> | null>(null);
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
  } = useProviderStatus(provider?.hostUri || "", {
    enabled: false,
    retry: false,
    onSuccess: _providerStatus => {
      setProvider(provider => (provider ? { ...provider, ...providerStatus } : (providerStatus as ClientProviderDetailWithStatus)));
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
    <PageContainer isLoading={isLoadingLeases || isLoadingProvider || isLoadingStatus}>
      <ProviderDetailLayout address={owner} page={ProviderDetailTabs.LEASES} refresh={refresh} provider={provider as ClientProviderDetailWithStatus}>
        <LeaseList isLoadingLeases={isLoadingLeases} leases={filteredLeases} />
      </ProviderDetailLayout>
    </PageContainer>
  );
  // return (
  //   <Layout isLoading={isLoadingLeases || isLoadingProvider || isLoadingStatus}>
  //     <CustomNextSeo title={`Provider leases for ${owner}`} url={`https://deploy.cloudmos.io${UrlService.providerDetailLeases(owner)}`} />

  //     <ProviderDetailLayout address={owner} page={ProviderDetailTabs.LEASES} refresh={refresh} provider={provider}>
  //       <LeaseList isLoadingLeases={isLoadingLeases} leases={filteredLeases} />
  //     </ProviderDetailLayout>
  //   </Layout>
  // );
};
