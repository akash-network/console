"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { SunLight, HalfMoon } from "iconoir-react";
import { cn } from "@/lib/utils";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const onThemeClick = (theme: string) => {
    setTheme(theme);
    document.cookie = `theme=${theme}; path=/`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <SunLight className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" width="1.2rem" height="1.2rem" />
          <HalfMoon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" width="1.2rem" height="1.2rem" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className={cn({ "text-primary": theme === "light" })} onClick={() => onThemeClick("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem className={cn({ "text-primary": theme === "dark" })} onClick={() => onThemeClick("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem className={cn({ "text-primary": theme === "system" })} onClick={() => onThemeClick("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
