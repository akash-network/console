"use client";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";

import Layout from "@src/components/layout/Layout";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { CustomizedSteppers } from "@src/components/become-provider/Stepper";
import { ServerAccess } from "@src/components/become-provider/server-access";
import { WalletImport } from "@src/components/become-provider/wallet-import";

const GetStarted: React.FunctionComponent = () => {
  const [activeStep, setActiveStep] = useState<number>(1);

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
    </Layout>
  );
};

export default GetStarted;
