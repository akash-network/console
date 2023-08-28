import { useTheme } from "@mui/material/styles";
import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import getConfig from "next/config";
import { makeStyles } from "tss-react/mui";
import { UrlService } from "@src/utils/urlUtils";
import { Avatar, Box, Button, CircularProgress, Divider, List, ListItem } from "@mui/material";
import CollectionsIcon from "@mui/icons-material/Collections";
import Logout from "@mui/icons-material/Logout";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { SidebarRouteButton } from "./SidebarRouteButton";
import { KeplrWalletStatus } from "./KeplrWalletStatus";
import Settings from "@mui/icons-material/Settings";

const useStyles = makeStyles()(theme => ({
  list: {
    padding: 0,
    overflow: "hidden",
    width: "100%",
    border: "none"
  },
  listItem: {
    padding: "4px 0"
  }
}));

type Props = {
  children?: ReactNode;
};

export const MobileSidebarUser: React.FunctionComponent<Props> = ({}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { user, error, isLoading } = useCustomUser();

  return (
    <List className={classes.list}>
      <Divider />

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", padding: ".5rem" }}>
        <KeplrWalletStatus />
      </Box>

      <Divider />

      {isLoading ? (
        <Box textAlign={"center"}>
          <CircularProgress size="1.5rem" color="secondary" />
        </Box>
      ) : user ? (
        <Box sx={{ padding: ".5rem" }}>
          <SidebarRouteButton
            route={{
              title: user.username,
              icon: props => (
                <Avatar {...props} sx={{ width: "1.5rem", height: "1.5rem" }}>
                  {user.username && user.username[0].toUpperCase()}
                </Avatar>
              ),
              url: UrlService.userProfile(user.username),
              activeRoutes: [UrlService.userProfile(user.username)]
            }}
          />
          <SidebarRouteButton
            route={{
              title: "Templates",
              icon: props => <CollectionsIcon {...props} />,
              url: UrlService.userProfile(user.username),
              activeRoutes: [UrlService.userProfile(user.username)]
            }}
          />
          <SidebarRouteButton
            route={{
              title: "Addresses",
              icon: props => <MenuBookIcon {...props} />,
              url: UrlService.userAddressBook(),
              activeRoutes: [UrlService.userAddressBook()]
            }}
          />
          <SidebarRouteButton
            route={{
              title: "Settings",
              icon: props => <Settings {...props} />,
              url: UrlService.userSettings(),
              activeRoutes: [UrlService.userSettings()]
            }}
          />
          <SidebarRouteButton
            route={{
              title: "Logout",
              icon: props => <Logout {...props} />,
              url: UrlService.logout(),
              activeRoutes: []
            }}
          />
        </Box>
      ) : (
        <Box sx={{ padding: ".5rem" }}>
          <ListItem className={classes.listItem}>
            <Button component={Link} href={UrlService.signup()} color="secondary" variant="contained" fullWidth>
              Sign up
            </Button>
          </ListItem>
          <ListItem component="a" href={UrlService.login()} sx={{ justifyContent: "center" }}>
            Sign in
          </ListItem>
        </Box>
      )}

      <Divider sx={{ marginBottom: "1rem" }} />
    </List>
  );
};
