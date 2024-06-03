import React from "react";
import ReactPlayer from "react-player/lazy";
import LaunchIcon from "@mui/icons-material/RocketLaunch";
import TwitterIcon from "@mui/icons-material/Twitter";
import YouTubeIcon from "@mui/icons-material/YouTube";
import { Box, Button, Grid, Typography, useTheme } from "@mui/material";
import { NextSeo } from "next-seo";
import { makeStyles } from "tss-react/mui";

import Layout from "@src/components/layout/Layout";
import { GradientText } from "@src/components/shared/GradientText";
import { DiscordIcon } from "@src/components/shared/icons";
import PageContainer from "@src/components/shared/PageContainer";

const useStyles = makeStyles()(theme => ({
  title: {
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "3rem",
    marginBottom: "1rem",
    [theme.breakpoints.down("sm")]: {
      fontSize: "2.5rem"
    }
  },
  actionButtonContainer: {
    margin: ".5rem auto",
    display: "flex",
    justifyContent: "center",
    maxWidth: "640px"
  },
  actionButtonBig: {
    margin: ".5rem",
    padding: ".7rem 2rem",
    textTransform: "initial",
    fontSize: "1.2rem",
    flexBasis: "50%"
  },
  actionButton: {
    margin: ".5rem",
    padding: ".5rem 1.5rem",
    textTransform: "initial",
    fontSize: "1rem",
    flexBasis: "50%"
  },
  actionButtonLabel: {
    display: "flex",
    flexDirection: "column",
    "& small": {
      fontSize: ".7rem"
    }
  },
  disclaimerTitle: {
    fontWeight: "bold",
    marginBottom: "1rem"
  },
  link: {
    fontWeight: "bold",
    textDecoration: "underline"
  },
  socials: {
    textAlign: "center"
  },
  socialLink: {
    padding: "1rem",
    transition: ".3s all ease",
    "& path": {
      fill: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main,
      transition: ".3s all ease"
    },
    "&:hover": {
      color: theme.palette.secondary.main,
      "& path": {
        fill: theme.palette.secondary.main
      }
    }
  },
  socialIcon: {
    height: "3rem",
    width: "3rem",
    fontSize: "3rem",
    display: "block",
    margin: "0 auto"
  },
  alert: {
    margin: "1rem auto",
    maxWidth: 640
  },
  loading: { textAlign: "center", marginTop: "4rem", marginBottom: "1rem" },
  releaseNote: {
    textAlign: "left",
    maxWidth: 640,
    margin: "auto"
  }
}));

type Props = {};

const Index: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();
  const { classes } = useStyles();

  return (
    <Layout>
      <NextSeo title="Cloudmos" />

      <PageContainer>
        <Typography variant="h1" className={classes.title}>
          <GradientText>Decentralized Cloud</GradientText>
        </Typography>

        <Box textAlign="center" maxWidth="640px" margin="0 auto">
          <Typography variant="h3" sx={{ fontWeight: "bold", fontSize: "1.5rem", marginBottom: ".5rem" }}>
            Go above and beyond the traditional cloud
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Deploy any docker container in a few clicks! Cloudmos greatly simplifies and enhances docker container deployments on the Akash Network.
          </Typography>

          <Box marginTop={3} marginBottom={3}>
            <Button
              size="large"
              variant="contained"
              color="secondary"
              classes={{ root: classes.actionButtonBig }}
              component="a"
              href={"https://deploy.cloudmos.io"}
              target="_blank"
            >
              <Box component="span" sx={{ display: "flex", alignItems: "center" }}>
                Launch App <LaunchIcon sx={{ marginLeft: ".5rem" }} />
              </Box>
            </Button>
          </Box>
        </Box>

        <Box margin="1rem auto" display="flex" justifyContent="center">
          <ReactPlayer url="https://www.youtube.com/watch?v=KscVdyESSm4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} />
        </Box>

        <Box margin="3rem auto 0rem" maxWidth="640px">
          <Box textAlign="center">
            <Typography variant="h5" className={classes.disclaimerTitle}>
              <GradientText>Follow our progress</GradientText>
            </Typography>
          </Box>

          <Grid container spacing={1} className={classes.socials}>
            <Grid item xs={4}>
              <a href="https://discord.gg/akash" target="_blank" className={classes.socialLink}>
                <DiscordIcon className={classes.socialIcon} />
              </a>
            </Grid>
            <Grid item xs={4}>
              <a href="https://www.youtube.com/channel/UC1rgl1y8mtcQoa9R_RWO0UA?sub_confirmation=1" target="_blank" className={classes.socialLink}>
                <YouTubeIcon className={classes.socialIcon} />
              </a>
            </Grid>
            <Grid item xs={4}>
              <a href="https://twitter.com/cloudmosio" target="_blank" className={classes.socialLink}>
                <TwitterIcon className={classes.socialIcon} />
              </a>
            </Grid>
          </Grid>
        </Box>
      </PageContainer>
    </Layout>
  );
};

export async function getServerSideProps() {
  return {
    props: {}
    //revalidate: 20
  };
}

export default Index;
