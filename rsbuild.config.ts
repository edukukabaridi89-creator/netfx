import path from 'path';
import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';

loadEnv({ mode: 'production' });

const isStaticBuild = process.env.NEXT_PUBLIC_APP_BUILD === 'true';

const smartchartsDist = path.join(
  path.dirname(require.resolve('@deriv-com/smartcharts-champion/package.json')),
  'dist'
);

const motionDomPath = path.resolve(path.dirname(require.resolve('motion-dom')), '../..');

export default defineConfig({
  plugins: [
    pluginSass({
      sassLoaderOptions: { sourceMap: true },
      exclude: /node_modules/,
    }),
    pluginReact(),
  ],
  source: {
    entry: { index: './src/main.tsx' },
    define: {
      'process.env': {
        NEXT_PUBLIC_DERIV_APP_ID: JSON.stringify(process.env.NEXT_PUBLIC_DERIV_APP_ID ?? ''),
        NEXT_PUBLIC_DERIV_ENV: JSON.stringify(process.env.NEXT_PUBLIC_DERIV_ENV ?? ''),
        NEXT_PUBLIC_DERIV_REFERRAL_LINK: JSON.stringify(process.env.NEXT_PUBLIC_DERIV_REFERRAL_LINK ?? ''),
        NEXT_PUBLIC_DERIV_APP_NAME: JSON.stringify(process.env.NEXT_PUBLIC_DERIV_APP_NAME ?? ''),
        NEXT_PUBLIC_APP_BUILD: JSON.stringify(process.env.NEXT_PUBLIC_APP_BUILD ?? ''),
        GD_CLIENT_ID: JSON.stringify(process.env.GD_CLIENT_ID),
        GD_APP_ID: JSON.stringify(process.env.GD_APP_ID),
        GD_API_KEY: JSON.stringify(process.env.GD_API_KEY),
      },
    },
  },
  resolve: {
    alias: {
      react: path.dirname(require.resolve('react/package.json')),
      'react-dom': path.dirname(require.resolve('react-dom/package.json')),
      'motion-dom': motionDomPath,
      '@/external': path.resolve(__dirname, './src/external'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/constants': path.resolve(__dirname, './src/constants'),
      '@/stores': path.resolve(__dirname, './src/stores'),
    },
  },
  output: {
    assetPrefix: isStaticBuild ? '/bot/preview/' : '/',
    distPath: {
      root: isStaticBuild ? 'out/preview' : 'dist',
    },
    copy: [
      {
        from: path.join(smartchartsDist, '*'),
        to: 'js/smartcharts/[name][ext]',
        globOptions: { ignore: ['**/*.LICENSE.txt'] },
      },
      { from: path.join(smartchartsDist, 'chart'), to: 'js/smartcharts/chart' },
      { from: path.join(smartchartsDist, 'assets'), to: 'js/smartcharts/assets' },
      { from: path.join(smartchartsDist, 'assets/*'), to: 'assets/[name][ext]' },
      { from: path.join(smartchartsDist, 'assets/fonts/*'), to: 'assets/fonts/[name][ext]' },
      { from: path.join(smartchartsDist, 'assets/shaders/*'), to: 'assets/shaders/[name][ext]' },
      { from: path.join(__dirname, 'public') },
    ],
  },
  html: { template: './index.html' },
  server: {
    compress: true,
    host: '0.0.0.0',
    port: 5000,
  },
  dev: {
    hmr: true,
    client: {
      host: process.env.REPLIT_DEV_DOMAIN || 'localhost',
      port: 443,
      protocol: 'wss',
    },
  },
  tools: {
    rspack: {
      module: {
        rules: [
          {
            test: /\.xml$/,
            exclude: /node_modules/,
            use: 'raw-loader',
          },
        ],
      },
    },
  },
});
