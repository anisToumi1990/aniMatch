const { getDefaultConfig } = require('expo/metro-config');
const {
  NODE_MODULES_SEGMENT,
  EXPORTED_SEGMENT,
} = require('./metro.assetPlugin');

const config = getDefaultConfig(__dirname);

// Export package assets (icon fonts, navigation images) under
// assets/npm-packages/ instead of assets/node_modules/, which some static
// hosts drop. See metro.assetPlugin.js.
config.transformer.assetPlugins = [
  ...(config.transformer.assetPlugins ?? []),
  require.resolve('./metro.assetPlugin'),
];

// The dev server serves assets from the real files, so map the renamed
// segment back to node_modules in asset URLs (plain or URL-encoded, e.g.
// /assets/?unstable_path=.%2Fnpm-packages%2F...) before Expo's own rewrite.
const encode = segment => segment.split('/').join('%2F');
const encodedExportedSegment = new RegExp(encode(EXPORTED_SEGMENT), 'gi');
const expoRewriteRequestUrl = config.server.rewriteRequestUrl;
config.server.rewriteRequestUrl = url => {
  const mappedUrl = url.startsWith('/assets')
    ? url
        .split(EXPORTED_SEGMENT)
        .join(NODE_MODULES_SEGMENT)
        .replace(encodedExportedSegment, encode(NODE_MODULES_SEGMENT))
    : url;
  return expoRewriteRequestUrl ? expoRewriteRequestUrl(mappedUrl) : mappedUrl;
};

module.exports = config;
