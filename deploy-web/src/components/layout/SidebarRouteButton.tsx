import Button from "@mui/material/Button";
import { SxProps, Theme, useTheme } from "@mui/material/styles";
import { ReactNode } from "react";
import Link from "next/link";
import { cx } from "@emotion/css";
import { useRouter } from "next/router";
import { makeStyles } from "tss-react/mui";
import { UrlService } from "@src/utils/urlUtils";
import { ISidebarRoute } from "@src/types";
import { Chip, ListItem, ListItemIcon, ListItemText } from "@mui/material";

const useStyles = makeStyles()(theme => ({
  notSelected: {
    color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[700],
    fontWeight: 500
  },
  selected: {
    fontWeight: "bold"
  }
}));

type Props = {
  children?: ReactNode;
  sx?: SxProps<Theme>;
  route: ISidebarRoute;
  isNavOpen?: boolean;
};

export const SidebarRouteButton: React.FunctionComponent<Props> = ({ route, sx = {}, isNavOpen = true }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const isSelected = route.url === UrlService.home() ? router.asPath === "/" : route.activeRoutes.some(x => router.asPath.startsWith(x));

  return (
    <ListItem sx={{ padding: "4px 0" }}>
      <Button
        fullWidth
        href={route.url}
        component={Link}
        color="inherit"
        className={cx({
          [classes.selected]: isSelected,
          [classes.notSelected]: !isSelected
        })}
        sx={{
          justifyContent: "flex-start",
          textTransform: "initial",
          fontSize: "1rem",
          height: "40px",
          padding: isNavOpen ? ".2rem 1rem" : ".5rem",
          minWidth: isNavOpen ? "initial" : 0,
          ...sx
        }}
        target={route.target ?? "_self"}
      >
        <ListItemIcon sx={{ minWidth: 0, zIndex: 100, margin: isNavOpen ? "initial" : "0 auto" }}>
          {route.icon({ color: isSelected ? "secondary" : "disabled" })}
        </ListItemIcon>

        {isNavOpen && (
          <ListItemText
            sx={{ marginLeft: "1rem", whiteSpace: "nowrap" }}
            primaryTypographyProps={{
              className: cx({ [classes.selected]: isSelected, [classes.notSelected]: !isSelected }),
              style: { opacity: isNavOpen ? 1 : 0 }
            }}
            primary={
              <>
                {route.title}
                {route.isNew && <Chip variant="outlined" sx={{ marginLeft: 2, cursor: "pointer" }} label="NEW" size="small" color="secondary" />}
              </>
            }
          />
        )}
      </Button>
    </ListItem>
  );
};
