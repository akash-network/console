const NodemonPlugin = require("nodemon-webpack-plugin");
const path = require("path");
const nodeExternals = require("webpack-node-externals");

/** @type {import('./webpack.config').Configuration} */
module.exports = env => {
  const plugins = [];

  if (env.development) {
    plugins.push(new NodemonPlugin());
  }

  return {
    mode: env.development ? "development" : "production",
    watch: env.development,
    entry: "./src/index.ts",
    target: "node",
    devtool: "source-map",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "server.js"
    },
    resolve: {
      extensions: [".ts", ".js"],
      alias: {
        "@src": path.resolve(__dirname, "src")
      }
    },
    externals: [
      nodeExternals({
        allowlist: [/^@kubernetes\/client-node/]
      })
    ],
    module: {
      rules: [
        {
          test: /\.(ts|js)x?$/,
          exclude: /node_modules/,
          loader: "ts-loader",
          options: {
            transpileOnly: true
          }
        }
      ]
    },
    optimization: {
      minimize: false
    },
    node: {
      __dirname: true
    },
    plugins
  };
};
