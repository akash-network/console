const { version } = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  publicRuntimeConfig: {
    version
  }
};

module.exports = nextConfig;
