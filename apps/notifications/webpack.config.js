const nodeExternals = require("webpack-node-externals");
const CopyPlugin = require("copy-webpack-plugin");
const packageDetails = require("./package.json");
const { dirname, join } = require("path");

/**
 * @param {import('webpack').Configuration} options
 * @param {import('webpack')} webpack
 * @returns {import('webpack').Configuration}
 */
module.exports = options => ({
  ...options,
  devtool: "source-map",
  externals: [
    nodeExternals({
      allowlist: Object.keys(packageDetails.dependencies).filter(name => name.startsWith("@akashnetwork/") && packageDetails.dependencies[name] === "*"),
      additionalModuleDirs: [join(__dirname, "..", "..", "node_modules")]
    })
  ],
  plugins: [
    ...(options.plugins || []),
    new CopyPlugin({
      patterns: [
        {
          from: dirname(require.resolve("swagger-ui-dist/package.json")),
          to: "swagger-ui-dist"
        },
        { from: "drizzle", to: "drizzle" },
        { from: "drizzle.config.js", to: "drizzle/drizzle.config.js" }
      ]
    })
  ]
});
