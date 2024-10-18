"use client";
import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";

// Import layout and step components
import Layout from "@src/components/layout/Layout";
import { CustomizedSteppers } from "@src/components/become-provider/Stepper";
import { ServerAccess } from "@src/components/become-provider/ServerAccess";
import { WalletImport } from "@src/components/become-provider/WalletImport";
import { ProviderConfig } from "@src/components/become-provider/ProviderConfig";
import { ProviderAttributes } from "@src/components/become-provider/ProviderAttributes";
import { ProviderPricing } from "@src/components/become-provider/ProviderPricing";

// Import state management
import providerProcessStore from "@src/store/providerProcessStore";
import withAuth from "@src/components/shared/withAuth";
import { ProviderActionDetails } from "@src/components/shared/ProviderActionDetails";

const BecomeProvider: React.FunctionComponent = () => {
  // State for managing the current step
  const [activeStep, setActiveStep] = useState<number>(0);
  // Global state for provider process
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);

  // Effect to update the active step based on the provider process state
  useEffect(() => {
    const steps = [
      { key: "serverAccess", component: ServerAccess },
      { key: "providerConfig", component: ProviderConfig },
      { key: "providerAttribute", component: ProviderAttributes },
      { key: "providerPricing", component: ProviderPricing },
      { key: "walletImport", component: WalletImport }
    ];

    // Find the first incomplete step
    const currentStepIndex = steps.findIndex(step => !providerProcess.process[step.key]);
    setActiveStep(currentStepIndex === -1 ? steps.length : currentStepIndex);
  }, [providerProcess.process]);

  // Handler for moving to the next step
  const handleStepChange = () => {
    setProviderProcess(prev => ({
      ...prev,
      process: {
        ...prev.process,
        [steps[activeStep].key]: true
      }
    }));
  };

  // Define the steps for the provider onboarding process
  const steps = [
    { key: "serverAccess", component: ServerAccess },
    { key: "providerConfig", component: ProviderConfig },
    { key: "providerAttribute", component: ProviderAttributes },
    { key: "providerPricing", component: ProviderPricing },
    { key: "walletImport", component: WalletImport }
  ];

  return (
    <Layout>
      {/* Display the stepper component */}
      <CustomizedSteppers activeStep={activeStep} />
      {/* Render the current step component or the final ProviderProcess component */}
      {activeStep < steps.length ? (
        React.createElement(steps[activeStep].component, {
          stepChange: handleStepChange
        })
      ) : (
        <ProviderActionDetails actionId={providerProcess.actionId} />
      )}
    </Layout>
  );
};

// Wrap the component with authentication HOC
export default withAuth(BecomeProvider);
