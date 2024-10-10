require("@akashnetwork/env-loader");
const { version } = require("./package.json");

try {
  const { browserEnvSchema } = require("./env-config.schema");

  browserEnvSchema.parse(process.env);
} catch (error) {
  if (error.message.includes("Cannot find module")) {
    console.warn("No env-config.schema.js found, skipping env validation");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  publicRuntimeConfig: {
    version
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["geist", "@akashnetwork/ui"]
};

module.exports = nextConfig;
