"use client";
import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UrlService } from "@src/utils/urlUtils";
import { ISidebarRoute } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { buttonVariants } from "../ui/button";

type Props = {
  children?: ReactNode;
  route: ISidebarRoute;
  isNavOpen?: boolean;
  className?: string;
};

export const SidebarRouteButton: React.FunctionComponent<Props> = ({ route, className = "", isNavOpen = true }) => {
  const pathname = usePathname();
  const isSelected = route.url === UrlService.home() ? pathname === "/" : route.activeRoutes.some(x => pathname?.startsWith(x));

  return (
    <li>
      <Link
        target={route.target ?? "_self"}
        rel={route.rel ? route.rel : ""}
        href={route.url}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-md flex w-full items-center justify-start text-current hover:text-primary", {
          ["font-bold"]: isSelected
        })}
      >
        {!!route.icon && <span className="mr-4">{route.icon({ className: cn({ ["text-primary font-bold"]: isSelected }, "text-xs") })}</span>}
        {route.title}
      </Link>
    </li>
  );
};
