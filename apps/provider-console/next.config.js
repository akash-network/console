/** @type {import('next').NextConfig} */

const { withSentryConfig } = require("@sentry/nextjs");

try {
  const { browserEnvSchema } = require("./env-config.schema");
  browserEnvSchema.parse(process.env);
} catch (error) {
  if (error.message.includes("Cannot find module")) {
    console.warn("No env-config.schema.js found, skipping env validation");
  }
}

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

// Sentry webpack plugin configuration
const sentryWebpackPluginOptions = {
  silent: true, // Suppresses all logs
  dryRun: process.env.NODE_ENV !== 'production', // Only upload source maps in production
  release: require("./package.json").version,
  authToken: process.env.SENTRY_AUTH_TOKEN
};

// Wrap nextConfig with Sentry configuration
module.exports = withSentryConfig(
  nextConfig,
  sentryWebpackPluginOptions
);
