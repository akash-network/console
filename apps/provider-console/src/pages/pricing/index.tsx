import React, { useEffect, useState } from "react";

import { Layout } from "@src/components/layout/Layout";
import { ProviderPricing } from "@src/components/become-provider/ProviderPricing";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import restClient from "@src/utils/restClient";
import { convertFromPricingAPI, sanitizeMachineAccess } from "@src/utils/sanityUtils";
import { Alert, AlertDescription, AlertTitle } from "@akashnetwork/ui/components";
import { useProvider } from "@src/context/ProviderContext";

const Pricing: React.FunctionComponent = () => {
  const { activeControlMachine } = useControlMachine();
  const [existingPricing, setExistingPricing] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { providerDetails } = useProvider();

  const fetchPricing = async () => {
    try {
      setIsLoading(true);
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response: any = await restClient.post("/get-provider-pricing", request);
      if (response) {
        setExistingPricing(convertFromPricingAPI(response.pricing));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeControlMachine) {
      fetchPricing();
    }
  }, [activeControlMachine]);

  return (
    <Layout>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div>
          {!activeControlMachine && (
            <Alert variant="destructive">
              <AlertTitle>Control Machine Required</AlertTitle>
              <AlertDescription>Please connect your control machine first to start updating pricing settings.</AlertDescription>
            </Alert>
          )}
          {activeControlMachine && !existingPricing && (
            <Alert variant="destructive">
              <AlertTitle>Unable to fetch pricing</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                Please try again later.
                <button onClick={fetchPricing} className="rounded bg-red-100 px-3 py-1 text-sm text-red-900 hover:bg-red-200">
                  Try Again
                </button>
              </AlertDescription>
            </Alert>
          )}
          <ProviderPricing
            existingPricing={existingPricing}
            editMode={true}
            stepChange={() => {}}
            disabled={activeControlMachine && existingPricing ? false : true}
            providerDetails={providerDetails}
          />
        </div>
      )}
    </Layout>
  );
};

export default Pricing;
