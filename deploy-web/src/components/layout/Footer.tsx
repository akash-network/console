import React from "react";
import { useSnackbar } from "notistack";
import { makeStyles } from "tss-react/mui";
import { Box, Grid, Typography } from "@mui/material";
import { DiscordIcon } from "../shared/icons";
import CopyrightIcon from "@mui/icons-material/Copyright";
import YouTubeIcon from "@mui/icons-material/YouTube";
import { FaXTwitter } from "react-icons/fa6";
import GitHubIcon from "@mui/icons-material/GitHub";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";

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
  footerLink: {
    color: "inherit"
  }
}));

export const Footer: React.FunctionComponent<IFooterProps> = ({}) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { classes } = useStyles();

  return (
    <div className={classes.root}>
      <footer>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body1" className={classes.title}>
              Akash Console
            </Typography>
            <Typography variant="body2" className={classes.subSitle}>
              Akash Console is the #1 platform to deploy docker containers on the Akash Network, a decentralized cloud compute marketplace. Explore, deploy and
              track all in one place!
            </Typography>
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
              <a href="https://www.youtube.com/@AkashNetwork" target="_blank" className={classes.socialLink}>
                <YouTubeIcon className={classes.socialIcon} />
              </a>
            </li>
            <li>
              <a href="https://twitter.com/akashnet_" target="_blank" className={classes.socialLink}>
                <FaXTwitter className={classes.socialIcon} />
              </a>
            </li>
            <li>
              <a href="https://github.com/akash-network/cloudmos" target="_blank" className={classes.socialLink}>
                <GitHubIcon className={classes.socialIcon} />
              </a>
            </li>
          </ul>

          <Box sx={{ margin: { xs: ".5rem 0 1rem", sm: 0 }, display: "flex", alignItems: "center" }}>
            <Link href={UrlService.termsOfService()} className={classes.footerLink}>
              <Typography variant="caption">Terms of Service</Typography>
            </Link>

            <Box sx={{ marginLeft: "1rem" }}>
              <Link href={UrlService.privacyPolicy()} className={classes.footerLink}>
                <Typography variant="caption">Privacy Policy</Typography>
              </Link>
            </Box>

            <Box sx={{ marginLeft: "1rem" }}>
              <Link href={UrlService.faq()} className={classes.footerLink}>
                <Typography variant="caption">FAQ</Typography>
              </Link>
            </Box>

            <Box sx={{ marginLeft: "1rem" }}>
              <Link href={UrlService.contact()} className={classes.footerLink}>
                <Typography variant="caption">Contact</Typography>
              </Link>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", fontSize: ".75rem" }}>
            <CopyrightIcon fontSize="small" />
            &nbsp;Overclock Labs
          </Box>
        </Box>
      </footer>
    </div>
  );
};
