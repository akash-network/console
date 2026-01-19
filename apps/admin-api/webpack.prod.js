const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const hq = require("alias-hq");

const { NODE_ENV = "production" } = process.env;

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: "./src/server.ts",
  mode: NODE_ENV,
  target: "node",
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "server.js"
  },
  resolve: {
    extensions: [".ts", ".js"],
    extensionAlias: {
      ".js": [".ts", ".js"]
    },
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
  ignoreWarnings: [/Critical dependency: the request of a dependency is an expression/]
};
