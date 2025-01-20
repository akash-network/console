import React from "react";
import { useQuery } from "react-query";

import { ProviderAttributes } from "@src/components/become-provider/ProviderAttributes";
import { Layout } from "@src/components/layout/Layout";
import { withAuth } from "@src/components/shared/withAuth";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import consoleClient from "@src/utils/consoleClient";

const Attributes: React.FunctionComponent = () => {
  const { address } = useSelectedChain();
  const { data: providerDetails, isLoading: isLoadingProviderDetails }: { data: any; isLoading: boolean } = useQuery(
    "providerDetails",
    () => consoleClient.get(`/v1/providers/${address}`),
    {
      refetchOnWindowFocus: false,
      retry: 3
    }
  );

  return (
    <Layout>
      {isLoadingProviderDetails ? (
        <div>Loading...</div>
      ) : (
        <div>
          <ProviderAttributes existingAttributes={providerDetails.attributes} editMode={true} />
        </div>
      )}
    </Layout>
  );
};

export default withAuth({ WrappedComponent: Attributes, authLevel: "provider" });
