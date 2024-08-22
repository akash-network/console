"use client";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";

import Layout from "@src/components/layout/Layout";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { CustomizedSteppers } from "@src/components/become-provider/Stepper";
import { ServerAccess } from "@src/components/become-provider/server-access";

const GetStarted: React.FunctionComponent = () => {
  const [activeStep, setActiveStep] = useState<number | null>(0);

  const changeStep = (step: number) => {
    setActiveStep(step);
  };

  return (
    <Layout>
      <CustomizedSteppers activeStep={0} />
      {activeStep === 0 && <ServerAccess />}
    </Layout>
  );
};

export default GetStarted;
