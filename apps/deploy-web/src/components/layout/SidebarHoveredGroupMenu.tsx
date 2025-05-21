"use client";
import type { ReactNode } from "react";
import { Separator } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { ISidebarGroupMenu } from "@src/types";
import { SidebarRouteButton } from "./SidebarRouteButton";

type Props = {
  children?: ReactNode;
  hasDivider?: boolean;
  isNavOpen: boolean;
  group: ISidebarGroupMenu;
};

export const SidebarHoveredGroupMenu: React.FunctionComponent<Props> = ({ group, hasDivider = true, isNavOpen }) => {
  return (
    <div className="p-1">
      {hasDivider && <Separator className="mb-2" />}

      <nav className={cn("flex flex-1 flex-col", { ["items-center"]: !isNavOpen })} aria-label="Sidebar">
        <ul role="list" className="w-full space-y-1">
          {!!group.title && isNavOpen && (
            <li>
              <span className="text-sm font-light">{group.title}</span>
            </li>
          )}

          {group.routes.map((route, i) => {
            return route.customComponent ? <li key={i}>{route.customComponent}</li> : <SidebarRouteButton key={i} route={route} isHovered />;
          })}
        </ul>
      </nav>
    </div>
  );
};
