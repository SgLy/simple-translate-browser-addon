import * as fs from 'fs';
import { ProgressPlugin, webpack } from 'webpack';
import { merge } from 'webpack-merge';
import baseConfig from './base.config';
import { importESM } from './import-esm';

const prodConfig = merge(baseConfig('production'), {
  mode: 'production',
  output: {
    publicPath: './',
    clean: true,
  },
  plugins: [new ProgressPlugin()],
});

webpack(prodConfig, async (err, stats) => {
  if (err || stats?.hasErrors()) {
    console.error(err);
  }
  if (stats) {
    console.log(
      stats.toString({
        colors: true,
        all: true,
      }),
    );
  }

  const webExt = await importESM('web-ext');
  const ret = await webExt.cmd.build({
    sourceDir: './dist',
    artifactsDir: './extension-dist',
    overwriteDest: true,
  });
  await fs.promises.rename(ret.extensionPath, ret.extensionPath.replace(/\.zip$/, '.xpi'));
});
