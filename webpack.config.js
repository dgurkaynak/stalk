const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin;
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackInlineSVGPlugin = require('html-webpack-inline-svg-plugin');
const uglifycss = require('uglifycss');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = {
  target: 'web',
  entry: {
    index: './src/index.ts',
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              experimentalWatchApi: true,
            },
          },
        ],
      },
      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'source-map-loader',
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttf$/,
        use: ['file-loader'],
      },
    ],
  },
  plugins: [
    new HardSourceWebpackPlugin(),
    new MonacoWebpackPlugin({
      // typescriptServices.js causes a warning in webpack
      // Module not found: Error: Can't resolve '@microsoft/typescript-etw'
      // https://github.com/microsoft/monaco-editor/issues/1623
      languages: ['typescript'],
    }),
    new CleanWebpackPlugin(),
    new ForkTsCheckerWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/index.html'),
      templateParameters: {
        title: 'Stalk Studio',
        indexCssInlineStyleTag: `<style>${uglifycss.processString(
          fs.readFileSync('./src/index.css').toString(),
          {}
        )}</style>`,
      },
    }),
    new HtmlWebpackInlineSVGPlugin(),
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
    }),
  ],
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'build'),
  },
  stats: {
    warningsFilter: ['node_modules/phosphor'],
  },
};
