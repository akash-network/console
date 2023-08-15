import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";
import { Divider, Typography } from "@mui/material";
import { ISidebarGroupMenu } from "@src/types";
import { SidebarRouteButton } from "./SidebarRouteButton";

const useStyles = makeStyles()(theme => ({
  root: {},
  list: {
    padding: 0,
    overflow: "hidden",
    width: "100%"
  }
}));

type Props = {
  children?: ReactNode;
  hasDivider?: boolean;
  isNavOpen: boolean;
  group: ISidebarGroupMenu;
};

export const SidebarGroupMenu: React.FunctionComponent<Props> = ({ group, hasDivider = true, isNavOpen }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <Box sx={{ marginTop: "1rem", width: "100%" }}>
      {hasDivider && <Divider sx={{ marginBottom: ".5rem" }} />}
      <List className={classes.list}>
        {!!group.title && isNavOpen && (
          <ListItem sx={{ padding: ".5rem 0 .75rem", color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[800] }}>
            <Typography variant="body2" sx={{ fontWeight: "light", fontSize: "1rem" }}>
              {group.title}
            </Typography>
          </ListItem>
        )}

        {group.routes.map(route => {
          return (
              <SidebarRouteButton key={route.title} route={route} isNavOpen={isNavOpen} />
          );
        })}
      </List>
    </Box>
  );
};
