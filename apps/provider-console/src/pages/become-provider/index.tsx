"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";

import { CertManagerStep } from "@src/components/become-provider/CertManagerStep";
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
import { hasRequiredCertManagerSecrets } from "@src/types/certManager";
import { migrateProviderStorage } from "@src/utils/migrateProviderStorage";

const BecomeProvider: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const [certManagerSecrets] = useAtom(providerProcessStore.certManagerSecretsAtom);
  const [, resetProviderProcess] = useAtom(providerProcessStore.resetProviderProcess);
  const { address } = useWallet();
  const previousAddressRef = useRef<string | undefined>(undefined);
  const certManagerSecretsRehydratedRef = useRef(false);

  const providerSteps = useMemo(
    () => [
      { key: "serverAccess", component: ServerAccess, label: "Server Access", visualStep: 0 },
      { key: "providerConfig", component: ProviderConfig, label: "Provider Configuration", visualStep: 1 },
      { key: "providerAttribute", component: ProviderAttributes, label: "Provider Attributes", visualStep: 2 },
      { key: "providerPricing", component: ProviderPricing, label: "Pricing", visualStep: 3 },
      { key: "portsAndDNS", component: PortsAndDNS, label: "Ports & DNS", visualStep: 3 },
      { key: "certManager", component: CertManagerStep, label: "TLS / Cert Manager", visualStep: 4 },
      { key: "walletImport", component: WalletImport, label: "Wallet Import", visualStep: 5 }
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

  // After rehydration, cert-manager credentials live only in memory; if the
  // user reloaded past the cert-manager step, the persisted `certManager: true`
  // flag lies. Flip it back so the wizard routes the user to re-enter creds.
  useEffect(() => {
    if (certManagerSecretsRehydratedRef.current) return;
    certManagerSecretsRehydratedRef.current = true;
    if (providerProcess.process.certManager && !hasRequiredCertManagerSecrets(providerProcess.certManager, certManagerSecrets)) {
      setProviderProcess(prev => ({
        ...prev,
        process: { ...prev.process, certManager: false }
      }));
    }
  }, [providerProcess.process.certManager, providerProcess.certManager, certManagerSecrets, setProviderProcess]);

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

  const visualActiveStep = useMemo(() => {
    if (activeStep >= providerSteps.length) {
      return providerSteps[providerSteps.length - 1].visualStep + 1;
    }
    return providerSteps[activeStep].visualStep;
  }, [activeStep, providerSteps]);

  return (
    <Layout>
      <CustomizedSteppers activeStep={visualActiveStep} />
      <CurrentStepComponent onComplete={handleStepComplete} />
    </Layout>
  );
};

export default withAuth({ WrappedComponent: BecomeProvider, authLevel: "wallet" });
