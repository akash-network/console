"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";
import React from "react";

interface NavLinksProps {
  links: {
    title: string;
    label?: string;
    icon?: React.ReactNode;
    variant: "default" | "ghost";
    href: string;
    isExternal?: boolean;
    rel?: string;
  }[];
}

export function NavLinks({ links }: NavLinksProps) {
  return (
    <div className="group flex flex-col gap-4 py-2">
      <nav className="grid gap-1 px-2">
        {links.map((link, index) => (
          <Link
            key={link.label}
            target={link.isExternal ? "_blank" : "_self"}
            rel={link.rel ? link.rel : ""}
            href={link.href}
            className={cn(buttonVariants({ variant: link.variant, size: "sm" }), "text-md flex w-full items-center justify-start", {
              ["mt-2"]: index > 0,
              ["text-foreground"]: link.variant === "ghost"
            })}
          >
            {!!link.icon && <span className="mr-2">{link.icon}</span>}
            {link.title}
            {link.label && <span className={cn("ml-auto", link.variant === "default" && "text-background dark:text-white")}>{link.label}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
