import { useState, useEffect } from "react";
import { useAkashProviders } from "../../../context/AkashProvider";
import { makeStyles } from "tss-react/mui";
import { useRouter } from "next/router";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import Layout from "@src/components/layout/Layout";
import { LeaseList } from "@src/components/providers/LeaseList";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { ProviderDetail } from "@src/types/provider";
import { useProviderStatus } from "@src/queries/useProvidersQuery";
import ProviderDetailLayout, { ProviderDetailTabs } from "@src/components/providers/ProviderDetailLayout";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  owner: string;
};

const useStyles = makeStyles()(theme => ({
  root: {
    "& .MuiPagination-ul": {
      justifyContent: "center"
    }
  }
}));

const ProviderLeasesPage: React.FunctionComponent<Props> = ({ owner }) => {
  const { classes } = useStyles();
  const [provider, setProvider] = useState<Partial<ProviderDetail>>(null);
  const [filteredLeases, setFilteredLeases] = useState(null);
  const router = useRouter();
  const { providers, getProviders, isLoadingProviders } = useAkashProviders();
  const { address } = useKeplr();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });
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

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    if (provider && leases && leases.length > 0) {
      const _leases = leases?.filter(d => d.provider === provider.owner);
      setFilteredLeases(_leases);
    }
  }, [leases, provider]);

  return (
    <Layout isLoading={isLoadingLeases || isLoadingProviders || isLoadingStatus}>
      <CustomNextSeo title={`Provider leases for ${owner}`} url={`https://deploy.cloudmos.io${UrlService.providerDetailLeases(owner)}`} />

      <ProviderDetailLayout address={owner} page={ProviderDetailTabs.LEASES} refresh={refresh} provider={provider}>
        <div className={classes.root}>
          <LeaseList isLoadingLeases={isLoadingLeases} leases={filteredLeases} />
        </div>
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
