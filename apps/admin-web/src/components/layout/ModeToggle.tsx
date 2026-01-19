"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { HalfMoon, SunLight } from "iconoir-react";
import { useTheme } from "next-themes";

export const ModeToggle: React.FunctionComponent = () => {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const onThemeClick = (newTheme: string) => {
    setTheme(newTheme);
    document.cookie = `theme=${newTheme}; path=/`;
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className={cn("h-8 w-8", { "text-primary": theme === "light" })} onClick={() => onThemeClick("light")}>
        <SunLight className="h-4 w-4" />
        <span className="sr-only">Light theme</span>
      </Button>
      <Button variant="ghost" size="icon" className={cn("h-8 w-8", { "text-primary": theme === "dark" })} onClick={() => onThemeClick("dark")}>
        <HalfMoon className="h-4 w-4" />
        <span className="sr-only">Dark theme</span>
      </Button>
    </div>
  );
};

export default ModeToggle;
