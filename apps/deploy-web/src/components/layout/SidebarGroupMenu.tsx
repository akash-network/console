"use client";
import { ReactNode } from "react";
import { ISidebarGroupMenu } from "@src/types";
import { SidebarRouteButton } from "./SidebarRouteButton";
import { Separator } from "../ui/separator";
import { cn } from "@src/utils/styleUtils";

type Props = {
  children?: ReactNode;
  hasDivider?: boolean;
  isNavOpen: boolean;
  group: ISidebarGroupMenu;
};

export const SidebarGroupMenu: React.FunctionComponent<Props> = ({ group, hasDivider = true, isNavOpen }) => {
  return (
    <div className="mt-4 w-full">
      {hasDivider && <Separator className="mb-2" />}

      <nav className={cn("flex flex-1 flex-col", { ["items-center"]: !isNavOpen })} aria-label="Sidebar">
        <ul role="list" className="space-y-1">
          {!!group.title && isNavOpen && (
            <li>
              <span className="text-sm font-light">{group.title}</span>
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
