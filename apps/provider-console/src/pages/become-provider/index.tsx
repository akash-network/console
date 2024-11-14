"use client";
import React, { useCallback,useEffect, useMemo, useState } from "react";
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

  const providerSteps = useMemo(
    () => [
      { key: "serverAccess", component: ServerAccess, label: "Server Access" },
      { key: "providerConfig", component: ProviderConfig, label: "Provider Configuration" },
      { key: "providerAttribute", component: ProviderAttributes, label: "Provider Attributes" },
      { key: "providerPricing", component: ProviderPricing, label: "Pricing" },
      { key: "walletImport", component: WalletImport, label: "Wallet Import" }
    ],
    []
  );

  useEffect(() => {
    const currentStepIndex = providerSteps.findIndex(step => !providerProcess.process[step.key]);
    setActiveStep(currentStepIndex === -1 ? providerSteps.length : currentStepIndex);
  }, [providerProcess.process, providerSteps]);

  const handleStepComplete = useCallback(() => {
    setProviderProcess(prev => ({
      ...prev,
      process: {
        ...prev.process,
        [providerSteps[activeStep].key]: true
      }
    }));
  }, [activeStep, providerSteps, setProviderProcess]);

  const CurrentStepComponent = useMemo(() => {
    if (activeStep >= providerSteps.length) {
      return () => (
        <div className="mt-4">
          <ProviderActionDetails actionId={providerProcess.actionId} />
        </div>
      );
    }
    return providerSteps[activeStep].component;
  }, [activeStep, providerSteps, providerProcess.actionId]);

  return (
    <Layout>
      {/* Display the stepper component */}
      <CustomizedSteppers activeStep={activeStep} />
      <CurrentStepComponent onComplete={handleStepComplete} />
    </Layout>
  );
};

// Wrap the component with authentication HOC
export default withAuth(BecomeProvider);
