import { useEffect, useState } from "react";
import { useTheme as useNextTheme } from "next-themes";

/**
 * Get the theme from the html class which is set from the cookie
 */
export const useTheme = (): { theme: string } => {
  const [_theme, _setTheme] = useState<string>("system");
  const { resolvedTheme, theme } = useNextTheme();

  useEffect(() => {
    if (resolvedTheme) {
      _setTheme(resolvedTheme);
    } else if (theme) {
      _setTheme(theme);
    } else {
      _setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
  }, [resolvedTheme, theme]);

  return { theme: _theme };
};

export default useTheme;
