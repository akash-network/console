import React, { ReactNode } from "react";
import PageContainer from "../shared/PageContainer";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { a11yTabProps } from "@src/utils/a11y";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useCustomUser } from "@src/hooks/useCustomUser";

type UserProfileTab = "templates" | "favorites" | "address-book" | "settings";
type Props = {
  username: string;
  bio: string;
  children?: ReactNode;
  page: UserProfileTab;
};

const useStyles = makeStyles()(theme => ({
  title: {
    fontSize: "2rem",
    fontWeight: "bold",
    marginBottom: "1rem"
  },
  titleSmall: {
    fontSize: "1.1rem"
  },
  selectedTab: {
    fontWeight: "bold"
  }
}));

export const UserProfileLayout: React.FunctionComponent<Props> = ({ page, children, username, bio }) => {
  const { classes } = useStyles();
  const router = useRouter();
  const { user } = useCustomUser();

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    switch (newValue) {
      case "templates":
        router.push(UrlService.userProfile(username));
        break;
      case "favorites":
        router.push(UrlService.userFavorites());
        break;
      case "address-book":
        router.push(UrlService.userAddressBook());
        break;
      case "settings":
        router.push(UrlService.userSettings());
        break;
    }
  };

  return (
    <PageContainer>
      <Box sx={{ padding: "1rem 0" }}>
        <Typography variant="h1" sx={{ fontSize: "2rem", marginBottom: ".5rem" }}>
          {username}
        </Typography>

        {bio && (
          <Typography variant="h3" sx={{ fontSize: "1rem" }}>
            {bio}
          </Typography>
        )}
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: "divider", marginBottom: "1rem" }}>
        <Tabs
          value={page}
          onChange={handleTabChange}
          aria-label="user profile tabs"
          textColor="secondary"
          indicatorColor="secondary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            value="templates"
            label="Templates"
            {...a11yTabProps("templates-tab", "templates-tab-panel", 0)}
            classes={{ selected: classes.selectedTab }}
            onClick={() => {
              event(AnalyticsEvents.USER_PROFILE_TEMPLATE_TAB, {
                category: "profile",
                label: "Click on templates tab"
              });
            }}
          />

          {/** Only show favorites/address book/settings for current user */}
          {user?.username === username && [
            <Tab
              key="favorites"
              value="favorites"
              label="Favorites"
              {...a11yTabProps("favorites-tab", "favorites-panel", 1)}
              classes={{ selected: classes.selectedTab }}
              onClick={() => {
                event(AnalyticsEvents.USER_PROFILE_FAVORITES_TAB, {
                  category: "profile",
                  label: "Click on favorites tab"
                });
              }}
            />,
            <Tab
              key="address-book"
              value="address-book"
              label="Address Book"
              {...a11yTabProps("address-book-tab", "address-book-tab-panel", 1)}
              classes={{ selected: classes.selectedTab }}
              onClick={() => {
                event(AnalyticsEvents.USER_PROFILE_ADDRESS_BOOK_TAB, {
                  category: "profile",
                  label: "Click on address book tab"
                });
              }}
            />,
            <Tab
              key="settings"
              value="settings"
              label="Settings"
              {...a11yTabProps("settings-tab", "settings-panel", 1)}
              classes={{ selected: classes.selectedTab }}
              onClick={() => {
                event(AnalyticsEvents.USER_PROFILE_SETTINGS_TAB, {
                  category: "profile",
                  label: "Click on settings tab"
                });
              }}
            />
          ]}
        </Tabs>
      </Box>

      {children}
    </PageContainer>
  );
};
