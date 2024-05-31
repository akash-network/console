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
    <li className={className}>
      <Link
        target={route.target ?? "_self"}
        rel={route.rel ? route.rel : ""}
        href={route.url}
        className={cn(
          buttonVariants({ variant: isSelected ? "secondary" : "ghost", size: "sm" }),
          "flex w-full items-center justify-start text-current hover:no-underline",
          {
            ["font-bold"]: isSelected,
            ["min-w-[initial] px-4 py-1"]: isNavOpen,
            ["w-[45px] min-w-0 p-2"]: !isNavOpen
          }
        )}
      >
        {!!route.icon && (
          <span className={cn("z-[100] min-w-0", { ["m-[initial]"]: isNavOpen, ["mx-auto"]: !isNavOpen })}>
            {route.icon({ className: cn({ ["text-primary font-bold"]: isSelected, ["mx-auto"]: !isNavOpen }, "text-xs") })}
          </span>
        )}
        {isNavOpen && <span className="mb-1 ml-4 mt-1 min-w-0 flex-auto whitespace-nowrap">{route.title}</span>}
      </Link>
    </li>
  );
};
