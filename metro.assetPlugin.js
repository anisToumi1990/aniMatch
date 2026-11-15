/**
 * Metro asset plugin: keeps package assets out of folders named "node_modules"
 * in exported builds.
 *
 * `npx expo export --platform web` writes assets from packages (icon fonts from
 * @expo/vector-icons, react-navigation images, ...) to
 * `dist/assets/node_modules/...`, and the bundle loads them from that URL.
 * Some static hosts drop every folder named `node_modules` (Netlify's
 * drag-and-drop deploy does), so those files 404 in production and all icons
 * render as empty squares.
 *
 * `httpServerLocation` decides both the exported file path and the URL in the
 * bundle, so renaming the segment here keeps the two in sync. It looks like
 * `/assets/?unstable_path=./node_modules/...` both in dev and during export,
 * so the dev server maps the new name back (see metro.config.js).
 */
const NODE_MODULES_SEGMENT = '/node_modules/';
// Must not be a folder name that appears inside packages ("vendor" does in
// @expo/vector-icons), so that metro.config.js can map it back unambiguously.
const EXPORTED_SEGMENT = '/npm-packages/';

function rewriteNodeModulesAssetPath(assetData) {
  const location = assetData.httpServerLocation;
  if (typeof location !== 'string' || !location.includes(NODE_MODULES_SEGMENT)) {
    return assetData;
  }
  return {
    ...assetData,
    httpServerLocation: location.split(NODE_MODULES_SEGMENT).join(EXPORTED_SEGMENT),
  };
}

module.exports = rewriteNodeModulesAssetPath;
module.exports.NODE_MODULES_SEGMENT = NODE_MODULES_SEGMENT;
module.exports.EXPORTED_SEGMENT = EXPORTED_SEGMENT;
