require("@akashnetwork/env-loader");
const { version } = require("./package.json");

const transpilePackages = ["geist", "@akashnetwork/ui", "@auth0/nextjs-auth0"];

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: version
  },
  compiler: {
    styledComponents: true
  },
  output: "standalone",
  typescript: {
    tsconfigPath: "./tsconfig.build.json"
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages,
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

module.exports = nextConfig;
