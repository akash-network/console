import createTailwindConfig from "@akashnetwork/ui/tailwind";

const config = createTailwindConfig("deploy-web");

/** The viewport height left to a page under the fixed header and the 4px loading bar the layout reserves. */
const PAGE_VIEWPORT_HEIGHT = "calc(100dvh - var(--app-header-height, 57px) - 4px)";

/** Boot overlay mark pulse (see AkashLoadingMark): each shard chases from dim (border) to lit (foreground). */
config.theme = {
  ...config.theme,
  extend: {
    ...config.theme?.extend,
    height: {
      ...config.theme?.extend?.height,
      "page-viewport": PAGE_VIEWPORT_HEIGHT
    },
    minHeight: {
      ...config.theme?.extend?.minHeight,
      "page-viewport": PAGE_VIEWPORT_HEIGHT
    },
    keyframes: {
      ...config.theme?.extend?.keyframes,
      "akash-loading-shard": {
        "0%, 72%, 100%": { fill: "hsl(var(--border))" },
        "14%, 46%": { fill: "hsl(var(--foreground))" }
      },
      "edit-nudge": {
        "0%, 76%, 88%, 100%": { transform: "translateY(0)" },
        "82%": { transform: "translateY(-3px)" },
        "94%": { transform: "translateY(-1px)" }
      },
      "terminal-cursor-blink": {
        "50%": { opacity: "0" }
      }
    },
    animation: {
      ...config.theme?.extend?.animation,
      "akash-loading-shard": "akash-loading-shard 1.8s linear infinite",
      "edit-nudge": "edit-nudge 4s ease-in-out 1s infinite",
      "terminal-cursor-blink": "terminal-cursor-blink 1.1s steps(1) infinite"
    }
  }
};

export default config;
