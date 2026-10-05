"use client";
import { useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { useTheme } from "next-themes";

export const DEPENDENCIES = { useTheme };

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
];

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
      {THEME_OPTIONS.map(option => (
        <Button
          key={option.value}
          variant="ghost"
          size="sm"
          aria-pressed={theme === option.value}
          className="h-6 rounded-sm px-2 text-xs aria-pressed:bg-accent aria-pressed:font-medium"
          onClick={() => onThemeClick(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
