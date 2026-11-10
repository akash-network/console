import createTailwindConfig from "@akashnetwork/ui/tailwind";
import type { Config } from "tailwindcss";

const baseConfig = createTailwindConfig("stats-web");

const config: Config = {
  ...baseConfig,
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme?.extend,
      colors: {
        ...baseConfig.theme?.extend?.colors,
        nested: "hsl(var(--nested))",
        faint: "hsl(var(--faint))",
        "border-strong": "hsl(var(--border-strong))"
      },
      maxWidth: {
        page: "1440px"
      },
      animation: {
        ...baseConfig.theme?.extend?.animation,
        "live-pulse": "live-pulse 2s ease infinite"
      }
    }
  }
};

export default config;
