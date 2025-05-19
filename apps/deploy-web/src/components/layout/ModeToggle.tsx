"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { HalfMoon, SunLight } from "iconoir-react";
import { useTheme } from "next-themes";

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
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className={cn("h-8 w-8", { "text-primary": theme === "light" })} onClick={() => onThemeClick("light")}>
        <SunLight className="h-5 w-5" />
        <span className="sr-only">Light theme</span>
      </Button>
      <Button variant="ghost" size="icon" className={cn("h-8 w-8", { "text-primary": theme === "dark" })} onClick={() => onThemeClick("dark")}>
        <HalfMoon className="h-5 w-5" />
        <span className="sr-only">Dark theme</span>
      </Button>
      <Button variant="ghost" size="icon" className={cn("h-8 w-8", { "text-primary": theme === "system" })} onClick={() => onThemeClick("system")}>
        <SunLight className="h-5 w-5" />
        <HalfMoon className="absolute h-5 w-5" />
        <span className="sr-only">System theme</span>
      </Button>
    </div>
  );
}
