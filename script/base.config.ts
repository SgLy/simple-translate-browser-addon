import childProcess from 'child_process';
import path from 'path';

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import type { Configuration } from 'webpack';
import { DefinePlugin } from 'webpack';

const root = path.join(__dirname, '..');
const commitHash = childProcess.execSync('git rev-parse --short HEAD').toString().trim();
const builtTime = new Date().toISOString();

const desktopBrowsers = ['Baidu', 'Chrome', 'Edge', 'Firefox', 'Opera', 'Safari'];
const browserslist = desktopBrowsers.map(b => `last 7 ${b} versions`).join(', ');

const matchExt = (filename: string, ext: string[]) => ext.includes(path.extname(filename));

const baseConfig: (buildMode: 'development' | 'production') => Configuration = buildMode => ({
  entry: {
    background: path.join(root, 'src', 'background.ts'),
    'content-script': path.join(root, 'src', 'content-script.ts'),
    popup: path.join(root, 'src', 'popup.ts'),
  },
  output: {
    filename: '[name].js',
    publicPath: '/',
    path: path.join(root, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test(path) {
          if (path.includes('node_modules')) return false;
          return matchExt(path, ['.ts', '.tsx']);
        },
        use: [
          {
            loader: 'babel-loader',
            options: {
              babelrc: false,
              configFile: false,
              cacheDirectory: true,
              cacheIdentifier: 'babel-ts',
              cacheCompression: false,
              sourceMaps: 'inline',
              presets: [
                [
                  '@babel/preset-env',
                  {
                    modules: 'auto',
                    targets: browserslist,
                  },
                ],
                '@babel/preset-typescript',
              ],
            },
          },
        ],
      },
      {
        test: s => s.endsWith('.module.scss'),
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: buildMode === 'development' ? '[path][name]__[local]' : '[hash:base64:4]',
                namedExport: false,
                exportLocalsConvention: 'as-is',
              },
            },
          },
        ],
      },
      {
        test: /\.(png|jpg|jpeg|gif|eot|ttf|woff|woff2|svgz|webp|ico)(\?.+)?$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 1024,
            },
          },
        ],
      },
      {
        test: s => s.endsWith('.svg'),
        type: 'asset/source',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx', '.json', '.scss'],
    alias: {
      '@': path.join(root, 'src'),
    },
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: path.join(root, 'tsconfig.json'),
      },
    }),
    new CleanWebpackPlugin({
      verbose: false,
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(root, 'static'),
          to: path.join(root, 'dist'),
        },
      ],
    }),
    new DefinePlugin({
      __COMMIT_HASH__: JSON.stringify(commitHash + (buildMode === 'development' ? '-dev' : '')),
      __BUILT_TIME__: JSON.stringify(builtTime),
      __BUILD_MODE__: JSON.stringify(buildMode),
    }),
    // new (require('webpack-bundle-analyzer').BundleAnalyzerPlugin)({
    //   analyzerHost: '0.0.0.0',
    // }),
  ],
});

export default baseConfig;
