/** @type {import('next').NextConfig} */

const { withSentryConfig } = require("@sentry/nextjs");
const nextConfig = {
  reactStrictMode: false,
  compiler: {
    styledComponents: true
  },
  images: {
    domains: ["raw.githubusercontent.com"]
  },
  output: "standalone",
  typescript: {
    tsconfigPath: "./tsconfig.json"
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["geist", "@akashnetwork/ui"],
  // experimental: {
  //   // outputStandalone: true,
  //   externalDir: true // to make the import from shared parent folder work https://github.com/vercel/next.js/issues/9474#issuecomment-810212174
  // },
  i18n: {
    locales: ["en-US"],
    defaultLocale: "en-US"
  },
  webpack: config => {
    config.externals.push({
      "node:crypto": "crypto"
    });
    config.externals.push("pino-pretty");
    return config;
  }
};

const sentryWebpackPluginOptions = {
  silent: true,
  dryRun: process.env.NODE_ENV !== "production",
  release: require("./package.json").version,
  authToken: process.env.NODE_ENV === "production" ? process.env.SENTRY_AUTH_TOKEN : undefined
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
