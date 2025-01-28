import React, { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";

import { ProviderPricing } from "@src/components/become-provider/ProviderPricing";
import { Layout } from "@src/components/layout/Layout";
import { ControlMachineError } from "@src/components/shared/ControlMachineError";
import { withAuth } from "@src/components/shared/withAuth";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useProvider } from "@src/context/ProviderContext";
import { ProviderPricingType } from "@src/types/provider";
import restClient from "@src/utils/restClient";
import { convertFromPricingAPI, sanitizeMachineAccess } from "@src/utils/sanityUtils";

const Pricing: React.FunctionComponent = () => {
  const { activeControlMachine } = useControlMachine();
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
      <div>
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80">
            <div className="flex items-center gap-2">
              <Spinner />
              <span className="text-sm text-gray-600">Loading provider pricing...</span>
            </div>
          </div>
        )}

        <div className={isLoading ? "pointer-events-none" : ""}>
          <ControlMachineError customMessage={!existingPricing ? "Please try again later." : undefined} onRetry={!existingPricing ? fetchPricing : undefined} />
          <ProviderPricing existingPricing={existingPricing} editMode={true} disabled={!existingPricing} providerDetails={providerDetails} />
        </div>
      </div>
    </Layout>
  );
};

export default withAuth({ WrappedComponent: Pricing, authLevel: "provider" });
