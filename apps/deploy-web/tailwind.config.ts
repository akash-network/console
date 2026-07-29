import createTailwindConfig from "@akashnetwork/ui/tailwind";

const config = createTailwindConfig("deploy-web");

/** Boot overlay mark pulse (see AkashLoadingMark): each shard chases from dim (border) to lit (foreground). */
config.theme = {
  ...config.theme,
  extend: {
    ...config.theme?.extend,
    keyframes: {
      ...config.theme?.extend?.keyframes,
      "akash-loading-shard": {
        "0%, 72%, 100%": { fill: "hsl(var(--border))" },
        "14%, 46%": { fill: "hsl(var(--foreground))" }
      }
    },
    animation: {
      ...config.theme?.extend?.animation,
      "akash-loading-shard": "akash-loading-shard 1.8s linear infinite"
    }
  }
};

export default config;
