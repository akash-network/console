const nodeExternals = require('webpack-node-externals');
const packageDetails = require('./package.json');

/**
 * @param {import('webpack').Configuration} options
 * @param {import('webpack')} webpack
 * @returns {import('webpack').Configuration}
 */
module.exports = (options, webpack) => ({
  ...options,
  devtool: 'source-map',
  externals: [
    nodeExternals({
      allowlist: Object.keys(packageDetails.dependencies).filter(
        (name) =>
          name.startsWith('@akashnetwork/') &&
          packageDetails.dependencies[name] === '*',
      ),
    }),
  ],
  plugins: [
    ...(options.plugins || []),
    new webpack.IgnorePlugin({
      // @nestjs/swagger is optional dependency of nestjs-zod
      resourceRegExp: /^@nestjs\/swagger/,
    }),
  ],
});
