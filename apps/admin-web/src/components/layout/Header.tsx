"use client";
import React from "react";
import { Button } from "@akashnetwork/ui/components";
import { useUser } from "@auth0/nextjs-auth0/client";
import { LogOut } from "iconoir-react";

import { ModeToggle } from "./ModeToggle";

export const Header: React.FunctionComponent = () => {
  const { user } = useUser();

  return (
    <header className="border-border bg-card flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Admin Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        <ModeToggle />

        {user && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">{user.email}</span>
            <Button variant="ghost" size="sm" asChild>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/auth/logout" className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </a>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
