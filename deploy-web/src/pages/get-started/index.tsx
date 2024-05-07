"use client";
import React from "react";
import Layout from "@src/components/layout/Layout";
import { GetStartedStepper } from "@src/components/get-started/GetStartedStepper";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { UrlService, domainName } from "@src/utils/urlUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@src/components/ui/card";

type Props = {};

const GetStarted: React.FunctionComponent<Props> = ({}) => {
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
