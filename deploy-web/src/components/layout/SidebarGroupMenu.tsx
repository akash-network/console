"use client";
import { ReactNode } from "react";
import { ISidebarGroupMenu } from "@src/types";
import { SidebarRouteButton } from "./SidebarRouteButton";
import { Separator } from "../ui/separator";

// const useStyles = makeStyles()(theme => ({
//   root: {},
//   list: {
//     padding: 0,
//     overflow: "hidden",
//     width: "100%"
//   }
// }));

type Props = {
  children?: ReactNode;
  hasDivider?: boolean;
  isNavOpen: boolean;
  group: ISidebarGroupMenu;
};

export const SidebarGroupMenu: React.FunctionComponent<Props> = ({ group, hasDivider = true, isNavOpen }) => {
  return (
    <div
      className="mt-4 w-full"
      // sx={{ marginTop: "1rem", width: "100%" }}
    >
      {hasDivider && (
        <Separator
          className="mb-2"
          // sx={{ marginBottom: ".5rem" }}
        />
      )}
      {/* <List className={classes.list}> */}

      <nav className="flex flex-1 flex-col" aria-label="Sidebar">
        <ul role="list" className="-mx-2 space-y-1">
          {!!group.title && isNavOpen && (
            <li
            // sx={{ padding: ".5rem 0 .75rem", color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[800] }}
            >
              <span
                className="text-sm font-light"
                // variant="body2" sx={{ fontWeight: "light", fontSize: "1rem" }}
              >
                {group.title}
              </span>
            </li>
          )}

          {group.routes.map(route => {
            return <SidebarRouteButton key={route.title} route={route} isNavOpen={isNavOpen} />;
          })}
        </ul>
      </nav>
    </div>
  );
};
