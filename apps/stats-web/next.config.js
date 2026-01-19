require("@akashnetwork/env-loader");
const { version, repository } = require("./package.json");
const { withSentryConfig } = require("@sentry/nextjs");

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
  transpilePackages: ["geist", "@akashnetwork/ui"],
  experimental: {
    instrumentationHook: true
  }
};

const REPOSITORY_URL = new URL(repository.url);

/**
 * For all available options, see:
 * https://github.com/getsentry/sentry-webpack-plugin#options.
 * @type {import('@sentry/nextjs').SentryBuildOptions}
 */
const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, org, project, authToken, configFile, stripPrefix,
  //   urlPrefix, include, ignore

  // silent: !process.env.CI, // Suppresses all logs,
  // dryRun: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  release: {
    name: version,
    setCommits: {
      repo: REPOSITORY_URL.pathname.slice(1).replace(/\.git$/, ""),
      commit: process.env.GIT_COMMIT_HASH
    }
  },
  sourcemaps: {
    deleteSourcemapsAfterUpload: false
  },
  widenClientFileUpload: true,
  debug: !process.env.CI,
  reactComponentAnnotation: {
    enabled: true
  },
  unstable_sentryWebpackPluginOptions: {
    applicationKey: process.env.NEXT_PUBLIC_SENTRY_APPLICATION_KEY
  }
};

// Make sure adding Sentry options is the last code to run before exporting, to
// ensure that your source maps include changes from all other Webpack plugins
module.exports = sentryWebpackPluginOptions.authToken ? withSentryConfig(nextConfig, sentryWebpackPluginOptions) : nextConfig;
