import React from "react";
import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import PageContainer from "@src/components/shared/PageContainer";
import { NextSeo } from "next-seo";
import { Breadcrumbs, Card, CardContent, CardHeader, Paper, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { NoWalletSection } from "@src/components/get-started/NoWalletSection";
import Link from "next/link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { CreateWalletSection } from "@src/components/get-started/CreateWalletSection";
import { NoKeplrSection } from "@src/components/get-started/NoKeplrSection";
import { WithKeplrSection } from "@src/components/get-started/WithKeplrSection";

const useStyles = makeStyles()(theme => ({
  paper: {
    padding: ".5rem 1rem",
    marginBottom: "1rem",
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100],
      cursor: "pointer"
    },
    "&:last-child": {
      marginBottom: 0
    }
  },
  subTitle: {
    fontWeight: "bold"
  }
}));

enum GetWalletSection {
  NoWallet = "no-wallet",
  NoKeplr = "no-keplr",
  HasKeplr = "has-keplr",
  CreateWallet = "create-wallet"
}

type Props = {};

const GetStartedWallet: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();
  const { classes } = useStyles();
  const router = useRouter();
  // Fallback to null if the section is not valid
  const currentSection = Object.values(GetWalletSection).includes(router.query.section as GetWalletSection) ? router.query.section : null;

  const sections = [
    {
      title: "I don't have any cryptocurrencies",
      description: "No worries, we'll guide you through the process of getting your hands on some crypto to be able to deploy.",
      id: GetWalletSection.NoWallet
    },
    {
      title: "I have cryptocurrencies, but not on Keplr wallet",
      description: "Great! We'll guide you through the process of installing the Keplr wallet browser extension and swapping your way to the cosmos ecosystem.",
      id: GetWalletSection.NoKeplr
    },
    {
      title: "I have a Keplr wallet",
      description: "If you're already familiar with the cosmos ecosystem and already have a Keplr wallet, it will be super easy to acquire some AKT!",
      id: GetWalletSection.HasKeplr
    }
  ];

  return (
    <Layout>
      <NextSeo title="Setup wallet" description="Follow the steps to install Keplr and get tokens!" />

      <PageContainer>
        <Breadcrumbs sx={{ marginBottom: "1rem" }} separator={<NavigateNextIcon fontSize="small" />}>
          <Link href={UrlService.getStarted()}>Get Started</Link>
          <Typography color="text.primary">Setup Wallet</Typography>
        </Breadcrumbs>

        <Card elevation={1}>
          <CardHeader
            title="Installing Keplr and getting AKT"
            titleTypographyProps={{ variant: "h3", sx: { fontSize: "1.25rem", fontWeight: "bold" } }}
            sx={{ borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}` }}
          />
          <CardContent>
            {!currentSection &&
              sections.map((section, index) => (
                <Paper elevation={5} className={classes.paper} key={index} onClick={() => router.push(UrlService.getStartedWallet(section.id))}>
                  <Typography variant="body1" className={classes.subTitle}>
                    {section.title}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {section.description}
                  </Typography>
                </Paper>
              ))}

            {currentSection === GetWalletSection.NoWallet && <NoWalletSection />}
            {currentSection === GetWalletSection.NoKeplr && <NoKeplrSection />}
            {currentSection === GetWalletSection.HasKeplr && <WithKeplrSection />}
          </CardContent>
        </Card>
      </PageContainer>
    </Layout>
  );
};

export default GetStartedWallet;
