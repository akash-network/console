import React from "react";
import { useQuery } from "react-query";

import { Layout } from "@src/components/layout/Layout";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import consoleClient from "@src/utils/consoleClient";
import { ProviderPricing } from "@src/components/become-provider/ProviderPricing";

const Pricing: React.FunctionComponent = () => {
  const { address } = useSelectedChain();
  const { data: providerDetails, isLoading: isLoadingProviderDetails }: { data: any; isLoading: boolean } = useQuery(
    "providerDetails",
    () => consoleClient.get(`/v1/providers/${address}`),
    {
      // You might want to adjust these options based on your needs
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
          <ProviderPricing existingPricing={providerDetails.pricing} editMode={true} stepChange={() => {}} />
        </div>
      )}
    </Layout>
  );
};

export default Pricing;
