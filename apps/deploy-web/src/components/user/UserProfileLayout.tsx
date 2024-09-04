import React, { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";
import { event } from "nextjs-google-analytics";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { AnalyticsEvents } from "@src/utils/analytics";
import { UrlService } from "@src/utils/urlUtils";

type UserProfileTab = "templates" | "favorites" | "settings";
type Props = {
  username?: string;
  bio?: string;
  children?: ReactNode;
  page: UserProfileTab;
};

export const UserProfileLayout: React.FunctionComponent<Props> = ({ page, children, username = "", bio }) => {
  const router = useRouter();
  const { user } = useCustomUser();

  const handleTabChange = (newValue: string) => {
    event(AnalyticsEvents.USER_PROFILE_TEMPLATE_TAB, {
      category: "profile",
      label: `Click on ${newValue} tab`
    });

    switch (newValue) {
      case "templates":
        router.push(UrlService.userProfile(username));
        break;
      case "favorites":
        router.push(UrlService.userFavorites());
        break;
      case "settings":
        router.push(UrlService.userSettings());
        break;
    }
  };

  return (
    <>
      <div className="py-4">
        <h1 className="mb-2 text-3xl">{username}</h1>

        {bio && <h3 className="text-lg">{bio}</h3>}
      </div>

      <Tabs value={page} onValueChange={handleTabChange}>
        <TabsList className="mb-4 grid w-full grid-cols-3 border-b">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          {user?.username === username && (
            <>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </>
          )}
        </TabsList>

        <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
      </Tabs>
    </>
  );
};
