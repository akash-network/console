"use client";
import React from "react";
import Layout from "@src/components/layout/Layout";
import { GetStartedStepper } from "@src/components/get-started/GetStartedStepper";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { UrlService } from "@src/utils/urlUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@src/components/ui/card";

type Props = {};

const GetStarted: React.FunctionComponent<Props> = ({}) => {
  return (
    <Layout>
      <CustomNextSeo
        title="Get started with Akash Console"
        url={`https://console.akash.network${UrlService.getStarted()}`}
        description="Follow the steps to get started with Cloudmos!"
      />

      <Card>
        <CardHeader
        // title=""
        // titleTypographyProps={{ variant: "h3", sx: { fontSize: "1.25rem", fontWeight: "bold" } }}
        // sx={{ borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}` }}
        >
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
