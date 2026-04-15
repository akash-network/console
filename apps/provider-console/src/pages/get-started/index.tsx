"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";

import { GetStartedStepper } from "@src/components/get-started/GetStartedStepper";
import { Layout } from "@src/components/layout/Layout";

const GetStarted: React.FunctionComponent = () => {
  return (
    <Layout>
      <Card>
        <CardHeader>
          <CardTitle>Get started with Provider Console!</CardTitle>
        </CardHeader>
        <CardContent>
          <GetStartedStepper />
        </CardContent>
      </Card>
    </Layout>
  );
};

export default GetStarted;
