import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import { Box, Button, CircularProgress, Grid, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { useUserTemplates } from "@src/queries/useTemplateQuery";
import { IUserSetting } from "@src/types/user";
import axios from "axios";
import { BASE_API_MAINNET_URL } from "@src/utils/constants";
import { TemplateGridButton } from "@src/components/shared/TemplateGridButton";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { UserProfileLayout } from "@src/components/user/UserProfileLayout";

type Props = {
  username: string;
  user: IUserSetting;
};

const useStyles = makeStyles()(theme => ({
  templateButton: {
    height: "100%",
    cursor: "pointer",
    padding: "1rem",
    transition: "background-color .3s ease",
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]
    }
  }
}));

const UserProfilePage: React.FunctionComponent<Props> = ({ username, user }) => {
  const { classes } = useStyles();
  const { data: userTemplates, isLoading: isLoadingTemplates, error } = useUserTemplates(username);
  const { user: _user } = useCustomUser();

  return (
    <Layout>
      <NextSeo title={username} />

      <UserProfileLayout page="templates" username={username} bio={user?.bio}>
        {isLoadingTemplates && <CircularProgress color="secondary" size="2rem" />}

        <Grid container spacing={2}>
          {!isLoadingTemplates && userTemplates?.length === 0 && (
            <Box sx={{ padding: "1rem" }}>
              <Typography variant="body2">No public templates.</Typography>

              {username === _user?.username && (
                <Button
                  component={Link}
                  href={UrlService.sdlBuilder()}
                  variant="contained"
                  color="secondary"
                  sx={{ marginTop: "1rem" }}
                  size="small"
                  onClick={() => {
                    event(AnalyticsEvents.CREATE_SDL_TEMPLATE_LINK, {
                      category: "profile",
                      label: "Create SDL template link from profile"
                    });
                  }}
                >
                  Create one!
                </Button>
              )}
            </Box>
          )}

          {userTemplates?.map(t => (
            <TemplateGridButton
              key={t.id}
              template={t}
              onClick={() => {
                event(AnalyticsEvents.USER_PROFILE_CLICK_TEMPLATE, {
                  category: "profile",
                  label: "Click on template from templates"
                });
              }}
            />
          ))}
        </Grid>
      </UserProfileLayout>
    </Layout>
  );
};

export default UserProfilePage;

export async function getServerSideProps({ params }) {
  try {
    const user = await fetchUser(params?.username);

    return {
      props: {
        username: params?.username,
        user
      }
    };
  } catch (error) {
    console.log("Error", error);
    if (error.response?.status === 404 || error.response?.status === 400) {
      return {
        notFound: true
      };
    } else {
      throw error;
    }
  }
}

async function fetchUser(username: string) {
  const response = await axios.get(`${BASE_API_MAINNET_URL}/user/byUsername/${username}`);
  return response.data;
}
