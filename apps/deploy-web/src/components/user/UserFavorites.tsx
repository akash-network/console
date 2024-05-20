import { useUserFavoriteTemplates } from "@src/queries/useTemplateQuery";
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