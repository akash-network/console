import { Spinner } from "@akashnetwork/ui/components";
import { NextSeo } from "next-seo";

import { TemplateGridButton } from "@src/components/shared/TemplateGridButton";
import { UserProfileLayout } from "@src/components/user/UserProfileLayout";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useUserFavoriteTemplates } from "@src/queries/useTemplateQuery";
import { analyticsService } from "@src/services/analytics/analytics.service";
import Layout from "../layout/Layout";

export const UserFavorites: React.FunctionComponent = () => {
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
                analyticsService.track("user_profile_click_template", {
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
