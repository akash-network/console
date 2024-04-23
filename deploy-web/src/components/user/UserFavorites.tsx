import { useUserFavoriteTemplates } from "@src/queries/useTemplateQuery";
import { IUserSetting } from "@src/types/user";
import { TemplateGridButton } from "@src/components/shared/TemplateGridButton";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { UserProfileLayout } from "@src/components/user/UserProfileLayout";
import Spinner from "@src/components/shared/Spinner";
import { NextSeo } from "next-seo";
import Layout from "../layout/Layout";

type Props = {};

export const UserFavorites: React.FunctionComponent<Props> = () => {
  const { data: favoriteTemplates, isLoading: isLoadingTemplates } = useUserFavoriteTemplates();
  const { user, isLoading } = useCustomUser();

  return (
    <Layout isLoading={isLoading}>
      <NextSeo title={user?.username} />
      <UserProfileLayout page="favorites" username={user?.username} bio={user?.bio}>
        {isLoadingTemplates && (
          <div className="flex items-center justify-center p-8">
            <Spinner size="large" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {!isLoadingTemplates && favoriteTemplates?.length === 0 && (
            <div className="p-4">
              <p>No template favorites.</p>
            </div>
          )}

          {favoriteTemplates?.map(t => (
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
        </div>
      </UserProfileLayout>
    </Layout>
  );
};

// type Props = {};

// export default const UserFavoritesPage: NextPage = withCustomPageAuthRequired(({}) => {
//   const { data: favoriteTemplates, isLoading: isLoadingTemplates } = useUserFavoriteTemplates();
//   const { user, isLoading } = useCustomUser();

//   return (
//     <Layout>
//       <NextSeo title={user?.username} />

//       <UserProfileLayout page="favorites" username={user?.username} bio={user?.bio}>
//         {(isLoading || isLoadingTemplates) && <CircularProgress color="secondary" />}

//         <Grid container spacing={2}>
//           {!isLoadingTemplates && favoriteTemplates?.length === 0 && (
//             <Box sx={{ padding: "1rem" }}>
//               <Typography variant="body2">No template favorites.</Typography>
//             </Box>
//           )}

//           {favoriteTemplates?.map(t => (
//             <TemplateGridButton
//               key={t.id}
//               template={t}
//               onClick={() => {
//                 event(AnalyticsEvents.USER_PROFILE_CLICK_TEMPLATE, {
//                   category: "settings",
//                   label: "Click on template from template favorites"
//                 });
//               }}
//             />
//           ))}
//         </Grid>
//       </UserProfileLayout>
//     </Layout>
//   );
// };

// export default UserFavoritesPage;

// export const getServerSideProps = withCustomPageAuthRequired({
//   async getServerSideProps({ params, req, res }) {
//     return {
//       props: {}
//     };
//   }
// });
