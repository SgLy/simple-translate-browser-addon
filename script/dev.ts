/// <reference types="node" />

import webpack, { ProgressPlugin } from 'webpack';
import { merge } from 'webpack-merge';
import baseConfig from './base.config';
import { importESM } from './import-esm';

const devConfig = merge(baseConfig('development'), {
  mode: 'development',
  devtool: 'inline-source-map',
  plugins: [new ProgressPlugin()],
  watch: true,
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__dirname + '/'],
    },
    compression: false,
    profile: true,
  },
});

webpack(devConfig, (err, stats) => {
  if (err || stats?.hasErrors()) {
    console.error(err);
  }
  if (stats) {
    console.log(
      stats.toString({
        colors: true,
        modules: false,
        children: false,
        chunks: false,
        chunkModules: false,
      }),
    );
  }
});

const runWebExt = async () => {
  const webExt = await importESM('web-ext');
  return await webExt.cmd.run(
    {
      target: ['firefox-desktop'],
      sourceDir: './dist',
      startUrl: ['https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Your_second_WebExtension'],
      devtools: true,
      noInput: true,
    },
    { shouldExitProgram: false },
  );
};

runWebExt().catch(console.error);
