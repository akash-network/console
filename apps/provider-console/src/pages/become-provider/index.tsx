"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";

import { PortsAndDNS } from "@src/components/become-provider/PortsAndDNS";
import { ProviderAttributes } from "@src/components/become-provider/ProviderAttributes";
import { ProviderConfig } from "@src/components/become-provider/ProviderConfig";
import { ProviderPricing } from "@src/components/become-provider/ProviderPricing";
import { ServerAccess } from "@src/components/become-provider/ServerAccess";
import { CustomizedSteppers } from "@src/components/become-provider/Stepper";
import { WalletImport } from "@src/components/become-provider/WalletImport";
import { Layout } from "@src/components/layout/Layout";
import { withAuth } from "@src/components/shared/withAuth";
import { useWallet } from "@src/context/WalletProvider";
import providerProcessStore from "@src/store/providerProcessStore";
import { migrateProviderStorage } from "@src/utils/migrateProviderStorage";

const BecomeProvider: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const [, resetProviderProcess] = useAtom(providerProcessStore.resetProviderProcess);
  const { address } = useWallet();
  const previousAddressRef = useRef<string | undefined>(undefined);

  const providerSteps = useMemo(
    () => [
      { key: "serverAccess", component: ServerAccess, label: "Server Access", visualStep: 0 },
      { key: "providerConfig", component: ProviderConfig, label: "Provider Configuration", visualStep: 1 },
      { key: "providerAttribute", component: ProviderAttributes, label: "Provider Attributes", visualStep: 2 },
      { key: "providerPricing", component: ProviderPricing, label: "Pricing", visualStep: 3 },
      { key: "portsAndDNS", component: PortsAndDNS, label: "Ports & DNS", visualStep: 3 },
      { key: "walletImport", component: WalletImport, label: "Wallet Import", visualStep: 4 }
    ],
    []
  );

  // Run one-time migration on mount
  useEffect(() => {
    migrateProviderStorage();
  }, []);

  // Reset provider process when wallet address changes
  useEffect(() => {
    if (previousAddressRef.current !== undefined && previousAddressRef.current !== address) {
      // Wallet address has changed, reset the provider process
      resetProviderProcess();
    }
    previousAddressRef.current = address;
  }, [address, resetProviderProcess]);

  useEffect(() => {
    const currentStepIndex = providerSteps.findIndex(step => !providerProcess.process[step.key]);
    setActiveStep(currentStepIndex === -1 ? providerSteps.length : currentStepIndex);
  }, [providerProcess.process, providerSteps]);

  const handleStepComplete = useCallback(() => {
    // Skip processing for wallet import step
    if (providerSteps[activeStep].key === "walletImport") {
      return;
    }

    setProviderProcess((prev: typeof providerProcess) => ({
      ...prev,
      process: {
        ...prev.process,
        [providerSteps[activeStep].key]: true
      }
    }));
  }, [activeStep, providerSteps, setProviderProcess, providerProcess]);

  const CurrentStepComponent = useMemo(() => {
    return providerSteps[activeStep].component;
  }, [activeStep, providerSteps]);

  return (
    <Layout>
      <CustomizedSteppers activeStep={activeStep} />
      <CurrentStepComponent onComplete={handleStepComplete} />
    </Layout>
  );
};

export default withAuth({ WrappedComponent: BecomeProvider, authLevel: "wallet" });
