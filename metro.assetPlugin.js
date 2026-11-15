/**
 * Metro asset plugin: exports package assets under a flat, neutral path.
 *
 * `npx expo export --platform web` writes assets from packages to
 * `dist/assets/node_modules/<package path>/...` and the bundle loads them from
 * that URL. Netlify's drag-and-drop deploy does not upload some of those
 * folders. `node_modules` itself is dropped, and so is something inside
 * `@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts` (likely
 * the `build` or `vendor` folder): on the live site the react-navigation and
 * expo-router assets load while every vector-icons font 404s, so all icons
 * render as empty squares.
 *
 * Netlify does not document which folder names it skips, so instead of
 * renaming one segment, the whole directory after `node_modules/` becomes a
 * single hex-encoded folder:
 *
 *   node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts
 *   -> npm-packages/40657870…466f6e7473
 *
 * The folder name only contains [0-9a-f], so no package folder name survives
 * and case-insensitive hosts can't mix names up. `httpServerLocation` decides both
 * the exported file path and the URL in the bundle, so they stay in sync.
 * The encoding is reversible: metro.config.js decodes it for the dev server,
 * which serves assets from the real files.
 */
const NODE_MODULES_SEGMENT = '/node_modules/';
const EXPORT_ROOT = 'npm-packages';

function encodePackageDir(packageDir) {
  return Buffer.from(packageDir, 'utf8').toString('hex');
}

function decodePackageDir(encodedDir) {
  return Buffer.from(encodedDir, 'hex').toString('utf8');
}

/** `/assets/?unstable_path=./node_modules/a/b` -> `/assets/?unstable_path=./npm-packages/<hex of "a/b">` */
function toExportLocation(location) {
  const index = location.indexOf(NODE_MODULES_SEGMENT);
  if (index === -1) return location;
  const prefix = location.slice(0, index + 1);
  const packageDir = location.slice(index + NODE_MODULES_SEGMENT.length).replace(/\/+$/, '');
  return `${prefix}${EXPORT_ROOT}/${encodePackageDir(packageDir)}`;
}

/**
 * Maps rewritten asset URLs back to node_modules for the dev server. Handles
 * plain (`./npm-packages/<hex>/x.ttf`) and URL-encoded
 * (`.%2Fnpm-packages%2F<hex>%2Fx.ttf`) query values.
 */
function toNodeModulesUrl(url) {
  return url.replace(
    new RegExp(`${EXPORT_ROOT}(/|%2F)([0-9a-f]+)(?=/|%2F|&|$)`, 'gi'),
    (_match, separator, encodedDir) => {
      const packageDir = decodePackageDir(encodedDir.toLowerCase());
      const isEncoded = separator !== '/';
      return `node_modules${separator}${isEncoded ? encodeURIComponent(packageDir) : packageDir}`;
    },
  );
}

function rewriteNodeModulesAssetPath(assetData) {
  const location = assetData.httpServerLocation;
  if (typeof location !== 'string' || !location.includes(NODE_MODULES_SEGMENT)) {
    return assetData;
  }
  return { ...assetData, httpServerLocation: toExportLocation(location) };
}

module.exports = rewriteNodeModulesAssetPath;
module.exports.toExportLocation = toExportLocation;
module.exports.toNodeModulesUrl = toNodeModulesUrl;
