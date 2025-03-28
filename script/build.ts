import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import HtmlInlineScriptPlugin from 'html-inline-script-webpack-plugin';
import baseConfig from './base.config';

const prodConfig: Configuration = {
  mode: 'production',
  output: {
    publicPath: './',
    clean: true,
  },
  plugins: [new HtmlInlineScriptPlugin()],
};

export default merge(baseConfig('production'), prodConfig);
