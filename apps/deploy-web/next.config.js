const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true"
});
const { version } = require("./package.json");
const isDev = process.env.NODE_ENV === "development";
const withPWA = require("next-pwa")({
  dest: "public",
  disable: isDev
});
const { withSentryConfig } = require("@sentry/nextjs");

/**
 * @type {import('next').NextConfig}
 */
const moduleExports = {
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
  transpilePackages: ["geist"],
  // experimental: {
  //   // outputStandalone: true,
  //   externalDir: true // to make the import from shared parent folder work https://github.com/vercel/next.js/issues/9474#issuecomment-810212174
  // },
  publicRuntimeConfig: {
    version
  },
  i18n: {
    locales: ["en-US"],
    defaultLocale: "en-US"
  },
  sentry: {
    hideSourceMaps: true
  },
  webpack: config => {
    // Fixes npm packages that depend on `node:crypto` module
    config.externals.push({
      "node:crypto": "crypto"
    });
    config.externals.push("pino-pretty");
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
  }
};

const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, org, project, authToken, configFile, stripPrefix,
  //   urlPrefix, include, ignore

  silent: true, // Suppresses all logs,
  dryRun: true,
  release: require("./package.json").version

  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options.
};

// Make sure adding Sentry options is the last code to run before exporting, to
// ensure that your source maps include changes from all other Webpack plugins
module.exports = withBundleAnalyzer(withPWA(withSentryConfig(moduleExports, sentryWebpackPluginOptions)));
// module.exports = moduleExports
