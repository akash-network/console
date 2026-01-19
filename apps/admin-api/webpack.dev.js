const path = require("path");
const NodemonPlugin = require("nodemon-webpack-plugin");
const nodeExternals = require("webpack-node-externals");
const hq = require("alias-hq");
const webpack = require("webpack");

const { NODE_ENV = "development" } = process.env;

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
  plugins: [new NodemonPlugin(), new webpack.IgnorePlugin({ resourceRegExp: /^pg-native$/ })],
  node: {
    __dirname: true
  },
  ignoreWarnings: [/Critical dependency: the request of a dependency is an expression/]
};
