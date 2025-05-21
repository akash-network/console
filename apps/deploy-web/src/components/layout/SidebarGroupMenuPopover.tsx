"use client";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import ClickAwayListener from "@mui/material/ClickAwayListener";

import type { ISidebarRoute } from "@src/types";
import { SidebarHoveredGroupMenu } from "./SidebarHoveredGroupMenu";

type Props = {
  children?: ReactNode;
  route: ISidebarRoute;
  isNavOpen: boolean;
};

export const SidebarGroupMenuPopover: React.FunctionComponent<Props> = ({ route, isNavOpen }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid={route.testId}
          className={cn("flex w-full items-center justify-start text-current hover:no-underline", {
            ["min-w-[initial] px-4 py-1"]: isNavOpen,
            ["w-[45px] min-w-0 p-2"]: !isNavOpen
          })}
          onMouseOver={() => setOpen(true)}
        >
          {!!route.icon && (
            <span className={cn("z-[100] min-w-0", { ["m-[initial]"]: isNavOpen, ["mx-auto"]: !isNavOpen })}>
              {route.icon({ className: cn({ ["mx-auto"]: !isNavOpen }, "text-xs") })}
            </span>
          )}
          {isNavOpen && <span className="mb-1 ml-4 mt-1 min-w-0 flex-auto whitespace-nowrap text-left">{route.title}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        side="right"
        sideOffset={5}
        onMouseLeave={() => {
          setOpen(false);
        }}
      >
        <ClickAwayListener
          onClickAway={() => {
            setOpen(false);
          }}
        >
          <div className="w-full">
            {route.hoveredRoutes?.map((route, i) => <SidebarHoveredGroupMenu key={i} group={route} hasDivider={route.hasDivider} isNavOpen={isNavOpen} />)}
          </div>
        </ClickAwayListener>
      </PopoverContent>
    </Popover>
  );
};
