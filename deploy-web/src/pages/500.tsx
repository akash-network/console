import Layout from "../components/layout/Layout";
import { ReactNode } from "react";
import PageContainer from "@src/components/shared/PageContainer";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { Title } from "@src/components/shared/Title";
import { NextSeo } from "next-seo";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

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
            <Button
              href={UrlService.home()}
              component={Link}
              variant="contained"
              color="secondary"
              sx={{ display: "inline-flex", alignItems: "center", textTransform: "initial" }}
            >
              Go to homepage&nbsp;
              <ArrowForwardIcon fontSize="small" />
            </Button>
          </Box>
        </Box>
      </PageContainer>
    </Layout>
  );
};

export default FiveHundred;
