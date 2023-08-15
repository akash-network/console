import React from "react";
import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import PageContainer from "@src/components/shared/PageContainer";
import { NextSeo } from "next-seo";
import { Card, CardContent, CardHeader, useTheme } from "@mui/material";
import { GetStartedStepper } from "@src/components/get-started/GetStartedStepper";

const useStyles = makeStyles()(theme => ({}));

type Props = {};

const GetStarted: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();
  const { classes } = useStyles();

  return (
    <Layout>
      <NextSeo title="Get started with Cloudmos" description="Follow the steps to get started with Cloudmos!" />

      <PageContainer>
        <Card elevation={1}>
          <CardHeader
            title="Get started with Cloudmos!"
            titleTypographyProps={{ variant: "h3", sx: { fontSize: "1.25rem", fontWeight: "bold" } }}
            sx={{ borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}` }}
          />
          <CardContent>
            <GetStartedStepper />
          </CardContent>
        </Card>
      </PageContainer>
    </Layout>
  );
};

export default GetStarted;
