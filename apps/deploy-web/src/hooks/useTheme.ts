import { useTheme } from "next-themes";

/**
 * Get the theme from the html class which is set from the cookie
 */
const useCookieTheme = (): string => {
  const { resolvedTheme } = useTheme();

  if (resolvedTheme) return resolvedTheme;
  if (typeof document === "undefined") return "system";

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
};

export default useCookieTheme;
