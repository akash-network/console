import { ReactNode } from "react";
import PageContainer from "@src/components/shared/PageContainer";
import { Box, Grid, Typography, useTheme } from "@mui/material";
import { Title } from "@src/components/shared/Title";
import { CustomNextSeo } from "../components/shared/CustomNextSeo";
import Layout from "@src/components/layout/Layout";
import { makeStyles } from "tss-react/mui";
import { DiscordIcon } from "@src/components/shared/icons";
import YouTubeIcon from "@mui/icons-material/YouTube";
import TwitterIcon from "@mui/icons-material/Twitter";
import GitHubIcon from "@mui/icons-material/GitHub";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  children?: ReactNode;
};

export const useStyles = makeStyles()(theme => ({
  socials: {
    textAlign: "center",
    maxWidth: "500px",
    margin: "3rem auto"
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
  }
}));

const ContactPage: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();
  const { classes } = useStyles();

  return (
    <Layout>
      <CustomNextSeo title="Contact" url={`https://deploy.cloudmos.io${UrlService.contact()}`} />

      <PageContainer>
        <Box sx={{ textAlign: "center", padding: "3rem 0" }}>
          <Title value="Contact us" />

          <Box sx={{ paddingTop: "1rem" }}>
            <Typography variant="body1" sx={{ marginBottom: ".5rem" }}>
              Need help or have an issue with something?
            </Typography>
            <Typography variant="body2">The best way to reach us is through our discord server or twitter.</Typography>
          </Box>

          <Grid container spacing={1} className={classes.socials}>
            <Grid item xs={6} sm={4}>
              <a href="https://discord.gg/akash" target="_blank" className={classes.socialLink}>
                <DiscordIcon className={classes.socialIcon} />
              </a>
            </Grid>
            <Grid item xs={6} sm={4}>
              <a href="https://www.youtube.com/channel/UC1rgl1y8mtcQoa9R_RWO0UA?sub_confirmation=1" target="_blank" className={classes.socialLink}>
                <YouTubeIcon className={classes.socialIcon} />
              </a>
            </Grid>
            <Grid item xs={6} sm={4}>
              <a href="https://twitter.com/cloudmosio" target="_blank" className={classes.socialLink}>
                <TwitterIcon className={classes.socialIcon} />
              </a>
            </Grid>
            <Grid item xs={6} sm={3}>
              <a href="https://github.com/akash-network/cloudmos" target="_blank" className={classes.socialLink}>
                <GitHubIcon className={classes.socialIcon} />
              </a>
            </Grid>
          </Grid>
        </Box>
      </PageContainer>
    </Layout>
  );
};

export default ContactPage;
