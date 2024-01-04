"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";

interface NavLinksProps {
  links: {
    title: string;
    label?: string;
    icon?: LucideIcon;
    variant: "default" | "ghost";
    href: string;
    isExternal?: boolean;
  }[];
}

export function NavLinks({ links }: NavLinksProps) {
  return (
    <div className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2">
      <nav className="grid gap-1 px-2">
        {links.map((link, index) =>
          link.isExternal ? (
            <a
              target="_blank"
              rel="noreferrer"
              href={link.href}
              className={cn(
                buttonVariants({ variant: link.variant, size: "sm" }),
                link.variant === "default" && "dark:bg-muted dark:text-white dark:hover:bg-muted dark:hover:text-white",
                "text-md w-full justify-start",
                { ["mt-2"]: index > 0 }
              )}
            >
              {link.icon && <link.icon className="mr-2 h-4 w-4" />}
              {link.title}
              {link.label && <span className={cn("ml-auto", link.variant === "default" && "text-background dark:text-white")}>{link.label}</span>}
            </a>
          ) : (
            <Link
              key={index}
              href={link.href}
              className={cn(
                buttonVariants({ variant: link.variant, size: "sm" }),
                link.variant === "default" && "dark:bg-muted dark:text-white dark:hover:bg-muted dark:hover:text-white",
                "text-md justify-start",
                { ["mt-2"]: index > 0 }
              )}
            >
              {link.icon && <link.icon className="mr-2 h-4 w-4" />}
              {link.title}
              {link.label && <span className={cn("ml-auto", link.variant === "default" && "text-background dark:text-white")}>{link.label}</span>}
            </Link>
          )
        )}
      </nav>
    </div>
  );
}
