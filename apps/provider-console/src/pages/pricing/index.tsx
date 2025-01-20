import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Spinner } from "@akashnetwork/ui/components";

import { ProviderPricing } from "@src/components/become-provider/ProviderPricing";
import { Layout } from "@src/components/layout/Layout";
import { withAuth } from "@src/components/shared/withAuth";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useProvider } from "@src/context/ProviderContext";
import { ProviderPricingType } from "@src/types/provider";
import restClient from "@src/utils/restClient";
import { convertFromPricingAPI, sanitizeMachineAccess } from "@src/utils/sanityUtils";

const Pricing: React.FunctionComponent = () => {
  const { activeControlMachine, controlMachineLoading } = useControlMachine();
  const [existingPricing, setExistingPricing] = useState<ProviderPricingType | undefined>(undefined);
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
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80">
            <div className="flex items-center gap-2">
              <Spinner />
              <span className="text-sm text-gray-600">Loading provider pricing...</span>
            </div>
          </div>
        )}

        <div className={isLoading ? "pointer-events-none" : ""}>
          {!activeControlMachine && !controlMachineLoading && (
            <Alert variant="destructive">
              <AlertTitle>Control Machine Required</AlertTitle>
              <AlertDescription>Please connect your control machine first to start updating pricing settings.</AlertDescription>
            </Alert>
          )}
          {controlMachineLoading && (
            <Alert>
              <AlertTitle>Connecting to Control Machine</AlertTitle>
              <AlertDescription className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  <span>Please wait while we check control machine access...</span>
                </div>
              </AlertDescription>
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
            disabled={activeControlMachine && existingPricing ? false : true}
            providerDetails={providerDetails}
          />
        </div>
      </div>
    </Layout>
  );
};

export default withAuth({ WrappedComponent: Pricing, authLevel: "provider" });
