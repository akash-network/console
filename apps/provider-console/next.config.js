/** @type {import('next').NextConfig} */

const { withSentryConfig } = require("@sentry/nextjs");
const nextConfig = {
  reactStrictMode: false,
  compiler: {
    // Enables the styled-components SWC transform
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
    // Fixes npm packages that depend on `node:crypto` module
    config.externals.push({
      "node:crypto": "crypto"
    });
    config.externals.push("pino-pretty");
    return config;
  }
};

module.exports = withSentryConfig(nextConfig);
