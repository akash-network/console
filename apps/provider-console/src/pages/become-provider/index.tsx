"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Popup } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";

import Layout from "@src/components/layout/Layout";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { CustomizedSteppers } from "@src/components/become-provider/Stepper";
import { ServerAccess } from "@src/components/become-provider/server-access";
import { WalletImport } from "@src/components/become-provider/wallet-import";
import { ProviderConfig } from "@src/components/become-provider/provider-config";
import { ProviderAttributes } from "@src/components/become-provider/provider-attributes";
import { ProviderPricing } from "@src/components/become-provider/provider-pricing";
import { ProviderProcess } from "@src/components/become-provider/provider-process";
import { useSelectedChain } from "@src/context/CustomChainProvider";

import { useRouter } from "next/router";
import providerProcessStore from "@src/store/providerProcessStore";
import withAuth from "@src/components/shared/withAuth";


const GetStarted: React.FunctionComponent = () => {
  const { isWalletConnected, wallet } = useSelectedChain();
  const [activeStep, setActiveStep] = useState<number>(0);
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const router = useRouter();


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

    console.log("Process", providerProcess);
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
        <ProviderProcess />
      )}
    </Layout>
  );
};

export default withAuth(GetStarted); // Wrap with the HOC
