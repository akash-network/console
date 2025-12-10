import { useTheme } from "next-themes";

/**
 * Get the theme from the html class which is set from the cookie
 */
const useCookieTheme = (): string => {
  const { resolvedTheme } = useTheme();
  return resolvedTheme ?? (document.documentElement.classList.contains("dark") ? "dark" : "light");
};

export default useCookieTheme;
