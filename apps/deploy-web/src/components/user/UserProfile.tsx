"use client";
import { buttonVariants, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Link from "next/link";

import { TemplateGridButton } from "@src/components/shared/TemplateGridButton";
import { UserProfileLayout } from "@src/components/user/UserProfileLayout";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useUserTemplates } from "@src/queries/useTemplateQuery";
import { analyticsService } from "@src/services/analytics/analytics.service";
import type { IUserSetting } from "@src/types/user";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";

type Props = {
  username: string;
  user: IUserSetting;
};

export const UserProfile: React.FunctionComponent<Props> = ({ username, user }) => {
  const { data: userTemplates, isLoading: isLoadingTemplates } = useUserTemplates(username);
  const { user: _user, isLoading } = useCustomUser();

  return (
    <Layout isLoading={isLoading || isLoadingTemplates}>
      <UserProfileLayout page="templates" username={username} bio={user?.bio}>
        {isLoadingTemplates && (
          <div className="flex items-center justify-center p-8">
            <Spinner size="large" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {!isLoadingTemplates && userTemplates?.length === 0 && (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">No public templates.</p>

              {username === _user?.username && (
                <Link
                  className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-4")}
                  href={UrlService.sdlBuilder()}
                  onClick={() => {
                    analyticsService.track("create_sdl_template_link", {
                      category: "profile",
                      label: "Create SDL template link from profile"
                    });
                  }}
                >
                  Create one!
                </Link>
              )}
            </div>
          )}

          {userTemplates?.map(t => (
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
