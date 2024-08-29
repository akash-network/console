"use client";
import React, { useState } from "react";
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

const GetStarted: React.FunctionComponent = () => {
  const [activeStep, setActiveStep] = useState<number>(5);

  const [serverInformation, setServerInformation] = useState();

  const finishServerAccess = info => {
    changeStep(1);
    setServerInformation(info);
  };

  const changeStep = (step: number) => {
    setActiveStep(step);
  };

  return (
    <Layout>
      <CustomizedSteppers activeStep={activeStep} />
      {activeStep === 0 && <ServerAccess stepChange={info => finishServerAccess(info)} />}
      {activeStep === 1 && <WalletImport stepChange={() => console.log("finished")} />}
      {activeStep === 2 && <ProviderConfig stepChange={() => console.log("finished")} />}
      {activeStep === 3 && <ProviderAttributes stepChange={() => console.log("finished")} />}
      {activeStep === 4 && <ProviderPricing stepChange={() => console.log("finished")} />}
      {activeStep === 5 && <ProviderProcess />}
    </Layout>
  );
};

export default GetStarted;
