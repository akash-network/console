"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";

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
import { useAtom } from "jotai";

const GetStarted: React.FunctionComponent = () => {
  const { isWalletConnected, wallet } = useSelectedChain();
  const [activeStep, setActiveStep] = useState<number>(0);
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const router = useRouter();

  useEffect(() => {
    if (!isWalletConnected) {
      // Store the current page URL before redirecting
      // localStorage.setItem('returnUrl', router.asPath);
      // router.push('/connect-wallet');
    }
  }, [isWalletConnected, router]);

  useEffect(() => {
    const steps = [
      { key: 'serverAccess', component: ServerAccess },
      { key: 'walletImport', component: WalletImport },
      { key: 'providerConfig', component: ProviderConfig },
      { key: 'providerAttribute', component: ProviderAttributes },
      { key: 'providerPricing', component: ProviderPricing },
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
    { key: 'serverAccess', component: ServerAccess },
    { key: 'walletImport', component: WalletImport },
    { key: 'providerConfig', component: ProviderConfig },
    { key: 'providerAttribute', component: ProviderAttributes },
    { key: 'providerPricing', component: ProviderPricing },
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

export default GetStarted;
