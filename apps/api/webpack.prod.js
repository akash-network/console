const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const CopyPlugin = require("copy-webpack-plugin");
const hq = require("alias-hq");

const { NODE_ENV = "production" } = process.env;

module.exports = {
  entry: "./src/index.ts",
  mode: NODE_ENV,
  target: "node",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "server.js"
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: hq.get("webpack")
  },
  externals: [nodeExternals(), { "winston-transport": "commonjs winston-transport" }],
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        exclude: /node_modules/,
        loader: "ts-loader"
      }
    ]
  },
  optimization: {
    minimize: false
  },
  plugins: [
    new webpack.IgnorePlugin({ resourceRegExp: /^pg-native$/ }),
    new CopyPlugin({
      patterns: [{ from: "drizzle", to: "drizzle" }]
    })
  ],
  node: {
    __dirname: true
  },
  ignoreWarnings: [
    // TODO: Fix this warning at some point. Essentially webpack is warning that it is not able to resolve the dependency because it's an expression and not a string literal. This is a known issue with webpack and it's safe to ignore it for now.
    /Critical dependency: the request of a dependency is an expression/
  ]
};
