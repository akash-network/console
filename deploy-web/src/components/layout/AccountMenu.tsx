import React from "react";
import { Avatar, Box, CircularProgress, Divider, IconButton, ListItemIcon, MenuItem, useTheme } from "@mui/material";
import CollectionsIcon from "@mui/icons-material/Collections";
import Settings from "@mui/icons-material/Settings";
import Logout from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import HoverMenu from "material-ui-popup-state/HoverMenu";
import { usePopupState } from "material-ui-popup-state/hooks";
import { bindHover, bindMenu } from "material-ui-popup-state";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { useCustomUser } from "@src/hooks/useCustomUser";
import StarIcon from "@mui/icons-material/Star";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";

type Props = {};

export const AccountMenu: React.FunctionComponent<Props> = () => {
  const theme = useTheme();
  const popupState = usePopupState({
    variant: "popover",
    popupId: "userPopup"
  });
  const { user, error, isLoading } = useCustomUser();
  const username = user?.username;
  const router = useRouter();

  return (
    <React.Fragment>
      <Box sx={{ display: "flex", alignItems: "center", textAlign: "center" }}>
        {isLoading ? (
          <Box sx={{ padding: "0 .5rem" }}>
            <CircularProgress size="1.5rem" color="secondary" />
          </Box>
        ) : (
          <Box sx={{ padding: "0 .5rem" }} {...bindHover(popupState)}>
            <IconButton size="small" onClick={() => (username ? router.push(UrlService.userProfile(username)) : null)}>
              <Avatar sx={{ width: 32, height: 32 }}>{username ? username[0].toUpperCase() : <PersonIcon />}</Avatar>
            </IconButton>
          </Box>
        )}
      </Box>

      <HoverMenu
        {...bindMenu(popupState)}
        disableScrollLock
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: "visible",
            filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
            minWidth: "200px",
            "& .MuiAvatar-root": {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1
            },
            "&:before": {
              content: '""',
              display: "block",
              position: "absolute",
              top: 0,
              right: 24,
              width: 10,
              height: 10,
              bgcolor: "background.paper",
              transform: "translateY(-50%) rotate(45deg)",
              zIndex: 0
            }
          }
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        {!isLoading && user ? (
          <div>
            <MenuItem onClick={() => router.push(UrlService.userProfile(username))}>
              <Avatar>{username && username[0].toUpperCase()}</Avatar> {username}
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => router.push(UrlService.userSettings())}>
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <MenuItem onClick={() => router.push(UrlService.userProfile(username))}>
              <ListItemIcon>
                <CollectionsIcon fontSize="small" />
              </ListItemIcon>
              Templates
            </MenuItem>
            <MenuItem onClick={() => router.push(UrlService.userFavorites())}>
              <ListItemIcon>
                <StarIcon fontSize="small" />
              </ListItemIcon>
              Favorites
            </MenuItem>
            <MenuItem component="a" target="_blank" href={"https://blockspy.io"}>
              <ListItemIcon>
                <NotificationsActiveIcon fontSize="small" />
              </ListItemIcon>
              My Alerts
            </MenuItem>
            <MenuItem onClick={() => router.push(UrlService.userAddressBook())}>
              <ListItemIcon>
                <MenuBookIcon fontSize="small" />
              </ListItemIcon>
              Addresses
            </MenuItem>
            <MenuItem component="a" href={UrlService.logout()}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </div>
        ) : (
          <div>
            <MenuItem
              component="a"
              href={UrlService.signup()}
              sx={{
                justifyContent: "center",
                backgroundColor: theme.palette.secondary.main,
                "&:hover": {
                  backgroundColor: theme.palette.secondary.dark
                }
              }}
            >
              Sign up
            </MenuItem>
            <MenuItem component="a" href={UrlService.login()} sx={{ justifyContent: "center" }}>
              Sign in
            </MenuItem>
          </div>
        )}
      </HoverMenu>
    </React.Fragment>
  );
};
