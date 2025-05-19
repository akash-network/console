"use client";
import type { ReactNode } from "react";
import React from "react";
import { Badge, buttonVariants, Separator, Tooltip, TooltipContent, TooltipTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ISidebarRoute } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  children?: ReactNode;
  route: ISidebarRoute;
  isNavOpen?: boolean;
  className?: string;
  useNextLinkTag?: boolean;
  isHovered?: boolean;
};

export const SidebarRouteButton: React.FunctionComponent<Props> = ({ route, className = "", isNavOpen = true, useNextLinkTag = true, isHovered = false }) => {
  const pathname = usePathname();
  const isSelected = route.url === UrlService.home() ? pathname === "/" : route.activeRoutes?.some(x => pathname?.startsWith(x));

  const linkProps: React.ComponentProps<typeof Link> & React.ComponentProps<"a"> & { "data-testid": string | undefined } = {
    target: route.target ?? "_self",
    rel: route.rel ? route.rel : "",
    href: route.url ?? "",
    className: cn(
      buttonVariants({ variant: isSelected ? "secondary" : "ghost", size: "sm" }),
      "flex w-full items-center justify-start text-current hover:no-underline",
      {
        ["font-bold"]: isSelected,
        ["min-w-[initial] px-4 py-1"]: isNavOpen,
        ["w-[45px] min-w-0 p-2"]: !isNavOpen
      }
    ),
    "data-testid": route.testId
  };

  const innerContent = (
    <>
      {!!route.icon && (
        <span className={cn("z-[100] min-w-0", { ["m-[initial]"]: isNavOpen, ["mx-auto"]: !isNavOpen })}>
          {route.icon({ className: cn({ ["text-primary font-bold"]: isSelected, ["mx-auto"]: !isNavOpen }, "text-xs") })}
        </span>
      )}
      {isNavOpen && <span className={cn("mb-1 mt-1 min-w-0 flex-auto whitespace-nowrap", { ["ml-4"]: !!route.icon })}>{route.title}</span>}
      {route.isNew && (
        <Badge className={cn("absolute right-3 top-1/2 h-4 -translate-y-1/2 pl-1 pr-1 text-[.5rem] leading-3", { ["hidden"]: !isNavOpen })}>New</Badge>
      )}
    </>
  );

  const content = route.url && useNextLinkTag ? <Link {...linkProps}>{innerContent}</Link> : <a {...linkProps}>{innerContent}</a>;

  return (
    <li className={className}>
      {route.hasDivider && <Separator className="my-1" />}
      {!isNavOpen && !isHovered ? (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{route.title}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        content
      )}
    </li>
  );
};
