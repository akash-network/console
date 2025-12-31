require("@akashnetwork/env-loader");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true"
});
const { version, repository } = require("./package.json");
const isDev = process.env.NODE_ENV === "development";
const defaultCache = require("next-pwa/cache");
const withPWA = require("next-pwa")({
  dest: "public",
  disable: isDev,
  runtimeCaching: [
    {
      urlPattern: ({ url }) => {
        const isSameOrigin = self.origin === url.origin; // eslint-disable-line no-undef
        return !isSameOrigin;
      },
      handler: "NetworkOnly",
      options: { cacheName: "third-party-network-only" }
    },
    ...defaultCache
  ]
});
const { withSentryConfig } = require("@sentry/nextjs");
const path = require("path");

let browserEnv;
try {
  const { browserEnvSchema } = require("./env-config.schema");

  browserEnv = browserEnvSchema.parse(process.env);
} catch (error) {
  if (error.message.includes("Cannot find module")) {
    console.warn("No env-config.schema.js found, skipping env validation");
  }
}

const transpilePackages = ["geist", "@akashnetwork/ui", "@auth0/nextjs-auth0"];

if (process.env.NODE_ENV === "test") {
  transpilePackages.push("nanoid", "uint8arrays", "multiformats", "@marsidev/react-turnstile", "@panva/hkdf", "jose");
}

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
    // Enables the styled-components SWC transform
    styledComponents: true
  },
  images: {
    domains: ["raw.githubusercontent.com", "avatars.githubusercontent.com"]
  },
  output: "standalone",
  typescript: {
    tsconfigPath: "./tsconfig.build.json"
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages,
  experimental: {
    instrumentationHook: true
  },
  i18n: {
    locales: ["en-US"],
    defaultLocale: "en-US"
  },
  /**
   *
   * @param {import('webpack').Configuration} config
   * @param {import('next').NextConfig} nextConfig
   * @returns
   */
  webpack: (config, options) => {
    // Fixes npm packages that depend on `node:crypto` module
    config.externals.push({
      "node:crypto": "crypto"
    });
    config.externals.push("pino-pretty");

    if (options.isServer) {
      // see ./src/lib/auth0/setSession/setSession.ts for more details
      config.resolve.alias["@auth0/nextjs-auth0/session"] = path.join(require.resolve("@auth0/nextjs-auth0"), "..", "session", "index.js");
      config.resolve.alias["@auth0/nextjs-auth0/update-session"] = path.join(require.resolve("@auth0/nextjs-auth0"), "..", "session", "update-session.js");
    }

    return config;
  },
  redirects: async () => {
    return [
      {
        source: "/deploy",
        destination: "/cloud-deploy",
        permanent: true
      },
      {
        source: "/price-compare",
        destination: "https://akash.network/about/pricing/custom/",
        permanent: false
      },
      {
        source: "/analytics",
        destination: "https://stats.akash.network",
        permanent: false
      },
      {
        source: "/graph/active-deployment",
        destination: "https://stats.akash.network/graph/active-leases",
        permanent: false
      },
      {
        source: "/graph/:path*",
        destination: "https://stats.akash.network/graph/:path*",
        permanent: false
      },
      {
        source: "/validators",
        destination: "https://stats.akash.network/validators",
        permanent: false
      },
      {
        source: "/validators/:address*",
        destination: "https://stats.akash.network/validators/:address*",
        permanent: false
      },
      {
        source: "/addresses/:address*",
        destination: "https://stats.akash.network/addresses/:address*",
        permanent: false
      },
      {
        source: "/addresses/:address/transactions",
        destination: "https://stats.akash.network/addresses/:address/transactions",
        permanent: false
      },
      {
        source: "/addresses/:address/deployments",
        destination: "https://stats.akash.network/addresses/:address/deployments",
        permanent: false
      },
      {
        source: "/deployment/:address/:dseq*",
        destination: "https://stats.akash.network/addresses/:address/deployments/:dseq*",
        permanent: false
      },
      {
        source: "/blocks",
        destination: "https://stats.akash.network/blocks",
        permanent: false
      },
      {
        source: "/blocks/:height*",
        destination: "https://stats.akash.network/blocks/:height*",
        permanent: false
      },
      {
        source: "/transactions",
        destination: "https://stats.akash.network/transactions",
        permanent: false
      },
      {
        source: "/transactions/:hash*",
        destination: "https://stats.akash.network/transactions/:hash*",
        permanent: false
      }
    ];
  },
  rewrites: async () =>
    browserEnv.NEXT_PUBLIC_AMPLITUDE_PROXY_URL
      ? [
          {
            source: browserEnv.NEXT_PUBLIC_AMPLITUDE_PROXY_URL,
            destination: "https://api2.amplitude.com/2/httpapi"
          }
        ]
      : []
};

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
      repo: repository.url,
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
module.exports = withBundleAnalyzer(withPWA(sentryWebpackPluginOptions.authToken ? withSentryConfig(nextConfig, sentryWebpackPluginOptions) : nextConfig));
