const { getDefaultConfig } = require('expo/metro-config');
const { toNodeModulesUrl } = require('./metro.assetPlugin');

const config = getDefaultConfig(__dirname);

// Export package assets (icon fonts, navigation images) under
// assets/npm-packages/<hex>/ instead of assets/node_modules/<package path>/,
// because Netlify drag-and-drop deploys skip some of those folders.
// See metro.assetPlugin.js.
config.transformer.assetPlugins = [
  ...(config.transformer.assetPlugins ?? []),
  require.resolve('./metro.assetPlugin'),
];

// The dev server serves assets from the real files, so decode the rewritten
// asset URLs back to node_modules before Expo's own rewrite.
const expoRewriteRequestUrl = config.server.rewriteRequestUrl;
config.server.rewriteRequestUrl = url => {
  const mappedUrl = url.startsWith('/assets') ? toNodeModulesUrl(url) : url;
  return expoRewriteRequestUrl ? expoRewriteRequestUrl(mappedUrl) : mappedUrl;
};

module.exports = config;
