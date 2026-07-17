"use client";
import { useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useTheme } from "next-themes";

export const DEPENDENCIES = { useTheme };

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function ThemeToggle({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { setTheme, theme } = d.useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const onThemeClick = (nextTheme: string) => {
    setTheme(nextTheme);
    document.cookie = `theme=${nextTheme}; path=/; Max-Age=31536000; SameSite=Lax`;
  };

  return (
    <div className="flex items-center rounded-md border p-0.5">
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-6 rounded-sm px-2 text-xs", { "bg-accent font-medium": theme === "light" })}
        onClick={() => onThemeClick("light")}
      >
        Light
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-6 rounded-sm px-2 text-xs", { "bg-accent font-medium": theme === "dark" })}
        onClick={() => onThemeClick("dark")}
      >
        Dark
      </Button>
    </div>
  );
}
