import React from "react";
import { useSnackbar } from "notistack";
import { makeStyles } from "tss-react/mui";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { donationAddress } from "@src/utils/constants";
import { Box, Chip, Container, Grid, IconButton, Typography } from "@mui/material";
import { DiscordIcon } from "../shared/icons";
import getConfig from "next/config";
import CloseIcon from "@mui/icons-material/Close";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import CopyrightIcon from "@mui/icons-material/Copyright";
import YouTubeIcon from "@mui/icons-material/YouTube";
import TwitterIcon from "@mui/icons-material/Twitter";
import GitHubIcon from "@mui/icons-material/GitHub";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";

const { publicRuntimeConfig } = getConfig();

export interface IFooterProps {}

export const useStyles = makeStyles()(theme => ({
  root: {
    marginTop: "5rem",
    paddingBottom: "3rem",
    [theme.breakpoints.down("sm")]: {
      textAlign: "center"
    }
  },
  link: {
    fontWeight: "bold",
    textDecoration: "underline"
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: "bold",
    marginBottom: ".5rem"
  },
  subSitle: {
    fontSize: ".9rem",
    fontWeight: 300
  },
  donationLabel: {
    maxWidth: "15rem"
  },
  sectionTitle: {
    fontWeight: "normal",
    padding: ".5rem 0",
    fontSize: "1rem"
  },
  socialLinks: {
    listStyle: "none",
    display: "flex",
    padding: 0,
    margin: 0,
    [theme.breakpoints.down("sm")]: {
      justifyContent: "center"
    }
  },
  socialLink: {
    display: "block",
    padding: ".5rem 1rem",
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
    height: "1.5rem",
    width: "1.5rem",
    fontSize: "3rem",
    display: "block",
    margin: "0 auto"
  },
  meta: {
    display: "flex",
    alignItems: "center",
    height: "5rem",
    justifyContent: "space-between",
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      marginBottom: "1rem"
    }
  },
  privacyLink: {
    color: "inherit"
  }
}));

export const Footer: React.FunctionComponent<IFooterProps> = ({}) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { classes } = useStyles();

  const onDonationClick = () => {
    copyTextToClipboard(donationAddress);

    const action = key => (
      <IconButton
        onClick={() => {
          closeSnackbar(key);
        }}
      >
        <CloseIcon />
      </IconButton>
    );

    enqueueSnackbar("Address copied!", {
      anchorOrigin: { vertical: "bottom", horizontal: "right" },
      variant: "success",
      action,
      autoHideDuration: 3000
    });
  };

  return (
    <div className={classes.root}>
      <footer>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={10}>
            <Typography variant="body1" className={classes.title}>
              Cloudmos
            </Typography>
            <Typography variant="body2" className={classes.subSitle}>
              Cloudmos is the #1 platform to deploy docker containers on the Akash Network, a decentralized cloud compute
              marketplace. Explore, deploy and track all in one place!
            </Typography>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Grid container>
              <Grid item xs={12} sx={{ marginBottom: "1rem" }}>
                <Typography variant="body2" className={classes.sectionTitle}>
                  Donate
                </Typography>
                <Chip
                  label={donationAddress}
                  size="small"
                  deleteIcon={<FileCopyIcon fontSize="small" />}
                  onDelete={onDonationClick}
                  onClick={onDonationClick}
                  classes={{ label: classes.donationLabel }}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>

        <Box className={classes.meta}>
          <ul className={classes.socialLinks}>
            <li>
              <a href="https://discord.gg/akash" target="_blank" className={classes.socialLink}>
                <DiscordIcon className={classes.socialIcon} />
              </a>
            </li>
            <li>
              <a href="https://www.youtube.com/channel/UC1rgl1y8mtcQoa9R_RWO0UA?sub_confirmation=1" target="_blank" className={classes.socialLink}>
                <YouTubeIcon className={classes.socialIcon} />
              </a>
            </li>
            <li>
              <a href="https://twitter.com/cloudmosio" target="_blank" className={classes.socialLink}>
                <TwitterIcon className={classes.socialIcon} />
              </a>
            </li>
            {/* <li>
              <a href="https://github.com/akash-network/cloudmos" target="_blank" className={classes.socialLink}>
                <GitHubIcon className={classes.socialIcon} />
              </a>
            </li> */}
          </ul>

          <Box sx={{ margin: { xs: ".5rem 0 1rem", sm: 0 }, display: "flex", alignItems: "center" }}>
            <Link href={UrlService.termsOfService()}>
              <a className={classes.privacyLink}>
                <Typography variant="caption">Terms of Service</Typography>
              </a>
            </Link>

            <Box sx={{ marginLeft: "1rem" }}>
              <Link href={UrlService.privacyPolicy()}>
                <a className={classes.privacyLink}>
                  <Typography variant="caption">Privacy Policy</Typography>
                </a>
              </Link>
            </Box>
            
            <Box sx={{ marginLeft: "1rem" }}>
              <Link href={UrlService.contact()}>
                <a className={classes.privacyLink}>
                  <Typography variant="caption">Contact</Typography>
                </a>
              </Link>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", fontSize: ".75rem" }}>
            <CopyrightIcon fontSize="small" />
            &nbsp;Cloudmos
          </Box>
        </Box>
      </footer>
    </div>
  );
};
