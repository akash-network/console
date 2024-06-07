const { version } = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  publicRuntimeConfig: {
    version
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;
