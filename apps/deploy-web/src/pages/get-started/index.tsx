"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";

import { GetStartedStepper } from "@src/components/get-started/GetStartedStepper";
import Layout from "@src/components/layout/Layout";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { domainName, UrlService } from "@src/utils/urlUtils";

const GetStarted: React.FunctionComponent = () => {
  return (
    <Layout>
      <CustomNextSeo
        title="Get started with Akash Console"
        url={`${domainName}${UrlService.getStarted()}`}
        description="Follow the steps to get started with Akash Console!"
      />

      <Card>
        <CardHeader>
          <CardTitle>Get started with Akash Console!</CardTitle>
        </CardHeader>
        <CardContent>
          <GetStartedStepper />
        </CardContent>
      </Card>
    </Layout>
  );
};

export default GetStarted;
