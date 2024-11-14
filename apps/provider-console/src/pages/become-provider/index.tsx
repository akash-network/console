"use client";
import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";

import { ProviderAttributes } from "@src/components/become-provider/ProviderAttributes";
import { ProviderConfig } from "@src/components/become-provider/ProviderConfig";
import { ProviderPricing } from "@src/components/become-provider/ProviderPricing";
import { ServerAccess } from "@src/components/become-provider/ServerAccess";
import { CustomizedSteppers } from "@src/components/become-provider/Stepper";
import { WalletImport } from "@src/components/become-provider/WalletImport";
import { Layout } from "@src/components/layout/Layout";
import { ProviderActionDetails } from "@src/components/shared/ProviderActionDetails";
import { withAuth } from "@src/components/shared/withAuth";
import providerProcessStore from "@src/store/providerProcessStore";

const BecomeProvider: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);

  useEffect(() => {
    const steps = [
      { key: "serverAccess", component: ServerAccess },
      { key: "providerConfig", component: ProviderConfig },
      { key: "providerAttribute", component: ProviderAttributes },
      { key: "providerPricing", component: ProviderPricing },
      { key: "walletImport", component: WalletImport }
    ];

    const currentStepIndex = steps.findIndex(step => !providerProcess.process[step.key]);
    setActiveStep(currentStepIndex === -1 ? steps.length : currentStepIndex);
  }, [providerProcess.process]);

  const handleStepChange = () => {
    setProviderProcess(prev => ({
      ...prev,
      process: {
        ...prev.process,
        [steps[activeStep].key]: true
      }
    }));
  };

  const steps = [
    { key: "serverAccess", component: ServerAccess },
    { key: "providerConfig", component: ProviderConfig },
    { key: "providerAttribute", component: ProviderAttributes },
    { key: "providerPricing", component: ProviderPricing },
    { key: "walletImport", component: WalletImport }
  ];

  return (
    <Layout>
      <CustomizedSteppers activeStep={activeStep} />
      {activeStep < steps.length ? (
        React.createElement(steps[activeStep].component, {
          stepChange: handleStepChange
        })
      ) : (
        <div className="mt-4">
          <ProviderActionDetails actionId={providerProcess.actionId} />
        </div>
      )}
    </Layout>
  );
};

export default withAuth(BecomeProvider);
