import childProcess from 'child_process';
import path from 'path';

import { CopyRspackPlugin, DefinePlugin } from '@rspack/core';
import type { Configuration } from '@rspack/core';

const root = path.join(__dirname, '..');
const commitHash = childProcess.execSync('git rev-parse --short HEAD').toString().trim();
const builtTime = new Date().toISOString();

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
    clean: true,
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
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          env: {
            targets: 'last 7 Chrome versions, last 7 Firefox versions, last 7 Safari versions',
          },
          jsc: {
            parser: {
              syntax: 'typescript',
            },
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
    alias: {
      '@': path.join(root, 'src'),
    },
  },
  plugins: [
    new CopyRspackPlugin({
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
  ],
});

export default baseConfig;
