// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add TypeScript extensions to assetExts
config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'json'];

// This handles typescript files in node_modules
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'ts' && ext !== 'tsx');

module.exports = config; 