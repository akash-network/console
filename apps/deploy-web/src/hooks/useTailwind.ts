import { useMemo } from "react";
import resolveConfig from "tailwindcss/resolveConfig";

import tailwindConfig from "../../tailwind.config";

/** Semantic colors declared in the shared UI tailwind preset that Tailwind's built-in DefaultColors type does not describe. */
type CustomThemeColors = {
  primary: { DEFAULT: string; foreground: string; visited: string };
};

export default function useTailwind() {
  return useMemo(() => {
    const resolvedConfig = resolveConfig(tailwindConfig);
    const colors = resolvedConfig.theme.colors as typeof resolvedConfig.theme.colors & CustomThemeColors;

    return { ...resolvedConfig, theme: { ...resolvedConfig.theme, colors } };
  }, []);
}
