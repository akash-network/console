"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Get the theme from the html class which is set from the cookie
 */
const useCookieTheme = (): string => {
  const [_theme, _setTheme] = useState<string>("light");
  const { theme } = useTheme();

  useEffect(() => {
    if (!!theme) {
      _setTheme(theme);
    } else {
      _setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
  }, [theme]);

  return _theme;
};

export default useCookieTheme;
