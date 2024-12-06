"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import Head from "next/head";
import Script from "next/script";

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

      <Head>
        <link rel="stylesheet" href="https://unpkg.com/@leapwallet/elements@1/dist/style.css" />
      </Head>
      <Script defer async src="https://unpkg.com/@leapwallet/elements@1/dist/umd/main.js" />
    </Layout>
  );
};

export default GetStarted;
