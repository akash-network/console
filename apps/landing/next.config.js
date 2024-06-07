const { version } = require("./package.json");
const withPWA = require("next-pwa");
const { withSentryConfig } = require("@sentry/nextjs");

const isDev = process.env.NODE_ENV === "development";

const moduleExports = {
  reactStrictMode: false,
  compiler: {
    styledComponents: true
  },
  images: {
    remotePatterns: [
      {
        hostname: "raw.githubusercontent.com"
      }
    ]
  },
  output: "standalone",
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
  redirects: async () => {
    return [
      {
        source: "/deploy",
        destination: "/cloud-deploy",
        permanent: true
      },
      {
        source: "/blocks/:height",
        destination: "/akash/blocks/:height",
        permanent: false
      },
      {
        source: "/blocks",
        destination: "/akash/blocks",
        permanent: false
      },
      {
        source: "/transactions/:hash",
        destination: "/akash/transactions/:hash",
        permanent: false
      },
      {
        source: "/transactions",
        destination: "/akash/transactions",
        permanent: false
      },
      {
        source: "/cloud-deploy",
        destination: "/",
        permanent: false
      },

      // Redirects to deploy.cloudmos.io
      {
        source: "/terms-of-service",
        destination: "https://deploy.cloudmos.io/terms-of-service",
        permanent: false
      },
      {
        source: "/privacy-policy",
        destination: "https://deploy.cloudmos.io/privacy-policy",
        permanent: false
      },
      {
        source: "/cloud-deploy",
        destination: "https://deploy.cloudmos.io",
        permanent: false
      },
      {
        source: "/sdl-builder",
        destination: "https://deploy.cloudmos.io/sdl-builder",
        permanent: false
      },
      {
        source: "/graph/:id",
        destination: "https://deploy.cloudmos.io/graph/:id",
        permanent: false
      },
      {
        source: "/template/:templateId",
        destination: "https://deploy.cloudmos.io/template/:templateId",
        permanent: false
      },
      {
        source: "/akash/dashboard",
        destination: "https://deploy.cloudmos.io/analytics",
        permanent: false
      },
      {
        source: "/price-compare",
        destination: "https://deploy.cloudmos.io/price-compare",
        permanent: false
      },
      {
        source: "/deployments",
        destination: "/",
        permanent: false
      },
      {
        source: "/providers",
        destination: "https://deploy.cloudmos.io/providers",
        permanent: false
      },
      {
        source: "/akash/blocks/:height",
        destination: "https://deploy.cloudmos.io/blocks/:height",
        permanent: false
      },
      {
        source: "/akash/blocks",
        destination: "https://deploy.cloudmos.io/blocks",
        permanent: false
      },
      {
        source: "/akash/transactions/:hash",
        destination: "https://deploy.cloudmos.io/transactions/:hash",
        permanent: false
      },
      {
        source: "/akash/transactions",
        destination: "https://deploy.cloudmos.io/transactions",
        permanent: false
      },
      {
        source: "/validators",
        destination: "https://deploy.cloudmos.io/validators",
        permanent: false
      },
      {
        source: "/validators/:address",
        destination: "https://deploy.cloudmos.io/validators/:address",
        permanent: false
      },
      {
        source: "/addresses/:address",
        destination: "https://deploy.cloudmos.io/addresses/:address",
        permanent: false
      },
      {
        source: "/proposals",
        destination: "https://deploy.cloudmos.io/proposals",
        permanent: false
      },
      {
        source: "/proposals/:id",
        destination: "https://deploy.cloudmos.io/proposals/:id",
        permanent: false
      },
      {
        source: "/profile/:username",
        destination: "https://deploy.cloudmos.io/profile/:username",
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
module.exports = withSentryConfig(
  withPWA({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: isDev
  })(moduleExports),
  sentryWebpackPluginOptions
);
