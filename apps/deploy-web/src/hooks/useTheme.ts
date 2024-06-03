import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Get the theme from the html class which is set from the cookie
 */
const useCookieTheme = (): string => {
  const [_theme, _setTheme] = useState<string>("");
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme) {
      _setTheme(resolvedTheme);
    } else {
      _setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
  }, [resolvedTheme]);

  return _theme;
};

export default useCookieTheme;
