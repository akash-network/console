import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Box, Button, Typography, useTheme } from "@mui/material";
import * as Sentry from "@sentry/nextjs";
import { NextPage, NextPageContext } from "next";
import Link from "next/link";
import { NextSeo } from "next-seo";

import PageContainer from "@src/components/shared/PageContainer";
import { Title } from "@src/components/shared/Title";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../components/layout/Layout";

type Props = {
  statusCode: number;
};

const Error: NextPage<Props> = ({ statusCode }) => {
  return (
    <Layout>
      <NextSeo title="Error" />

      <PageContainer>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h1">{statusCode}</Typography>

          <Title value="Error occured." />

          <Typography variant="body1">{statusCode ? `An error ${statusCode} occurred on server` : "An error occurred on client"}</Typography>

          <Box sx={{ paddingTop: "1rem" }}>
            <Link href={UrlService.home()} passHref>
              <Button variant="contained" color="secondary" sx={{ display: "inline-flex", alignItems: "center", textTransform: "initial" }}>
                Go to homepage&nbsp;
                <ArrowForwardIcon fontSize="small" />
              </Button>
            </Link>
          </Box>
        </Box>
      </PageContainer>
    </Layout>
  );
};

Error.getInitialProps = async (context: NextPageContext) => {
  const { res, err } = context;
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;

  // In case this is running in a serverless function, await this in order to give Sentry
  // time to send the error before the lambda exits
  await Sentry.captureUnderscoreErrorException(context);

  // This will contain the status code of the response
  // return Error.getInitialProps({ statusCode });
  return { statusCode };
};

export default Error;
