const { Asset } = require('expo-asset');
const { File } = require('expo-file-system');
const { createAndroidDictionaryLoader } = require('./index.cjs');

/** Expo SDK 54+ adapter for bundled Android data assets, including offline APK resources. */
function createExpoDictionaryLoader(assets) {
  return createAndroidDictionaryLoader(assets, {
    async readAssetText(moduleId) {
      const asset = Asset.fromModule(moduleId);
      if (!asset.localUri) await asset.downloadAsync();
      if (!asset.localUri) throw new Error(`Could not resolve dictionary asset ${moduleId} to a local file`);
      return new File(asset.localUri).text();
    },
  });
}

module.exports = { createExpoDictionaryLoader };
