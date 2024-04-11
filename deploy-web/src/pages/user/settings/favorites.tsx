import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import { Box, CircularProgress, Grid, Typography } from "@mui/material";
import { useUserFavoriteTemplates } from "@src/queries/useTemplateQuery";
import { TemplateGridButton } from "@src/components/shared/TemplateGridButton";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";
import { UserProfileLayout } from "@src/app/profile/[username]/UserProfileLayout";

type Props = {};

const UserFavoritesPage: React.FunctionComponent<Props> = ({}) => {
  const { data: favoriteTemplates, isLoading: isLoadingTemplates } = useUserFavoriteTemplates();
  const { user, isLoading } = useCustomUser();

  return (
    <Layout>
      <NextSeo title={user?.username} />

      <UserProfileLayout page="favorites" username={user?.username} bio={user?.bio}>
        {(isLoading || isLoadingTemplates) && <CircularProgress color="secondary" />}

        <Grid container spacing={2}>
          {!isLoadingTemplates && favoriteTemplates?.length === 0 && (
            <Box sx={{ padding: "1rem" }}>
              <Typography variant="body2">No template favorites.</Typography>
            </Box>
          )}

          {favoriteTemplates?.map(t => (
            <TemplateGridButton
              key={t.id}
              template={t}
              onClick={() => {
                event(AnalyticsEvents.USER_PROFILE_CLICK_TEMPLATE, {
                  category: "settings",
                  label: "Click on template from template favorites"
                });
              }}
            />
          ))}
        </Grid>
      </UserProfileLayout>
    </Layout>
  );
};

export default UserFavoritesPage;

export const getServerSideProps = withCustomPageAuthRequired({
  async getServerSideProps({ params, req, res }) {
    return {
      props: {}
    };
  }
});
