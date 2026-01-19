"use client";
import React from "react";
import { cn } from "@akashnetwork/ui/utils";
import { Group, StatsUpSquare } from "iconoir-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  {
    title: "Users",
    href: "/users",
    icon: Group
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: StatsUpSquare
  }
];

export const Sidebar: React.FunctionComponent = () => {
  const router = useRouter();

  return (
    <aside className="border-border bg-card flex w-64 flex-col border-r">
      <div className="border-border flex h-16 items-center border-b px-6">
        <Link href="/users" className="flex items-center gap-2">
          <Image src="/images/akash-logo.svg" alt="Akash Logo" width={28} height={28} />
          <span className="text-lg font-semibold">Admin</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map(item => {
          const isActive = router.pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="border-border border-t p-4">
        <p className="text-muted-foreground text-xs">Version {process.env.NEXT_PUBLIC_APP_VERSION || "dev"}</p>
      </div>
    </aside>
  );
};

export default Sidebar;
