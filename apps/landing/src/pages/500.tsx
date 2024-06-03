import { ReactNode } from "react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { NextPage, NextPageContext } from "next";
import Link from "next/link";
import { NextSeo } from "next-seo";

import PageContainer from "@src/components/shared/PageContainer";
import { Title } from "@src/components/shared/Title";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../components/layout/Layout";

type Props = {
  children?: ReactNode;
};

const FiveHundred: React.FunctionComponent<Props> = ({}) => {
  return (
    <Layout>
      <NextSeo title="Error" />

      <PageContainer>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h1">500</Typography>

          <Title value="An error has occured." />

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

export default FiveHundred;
