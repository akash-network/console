const { version } = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  publicRuntimeConfig: {
    version
  },
  sentry: {
    hideSourceMaps: true
  },
};

module.exports = nextConfig;
