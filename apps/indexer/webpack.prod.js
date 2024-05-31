const path = require("path");
const { NODE_ENV = "production" } = process.env;
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const hq = require("alias-hq");

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
  externals: [nodeExternals()],
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
  plugins: [new webpack.IgnorePlugin({ resourceRegExp: /^pg-native$/ })],
  node: {
    __dirname: true
  },
  ignoreWarnings: [
    // TODO: Fix this warning at some point. Essentially webpack is warning that it is not able to resolve the dependency because it's an expression and not a string literal. This is a known issue with webpack and it's safe to ignore it for now.
    /Critical dependency: the request of a dependency is an expression/
  ]
};
