const { Asset } = require('expo-asset');
const { File } = require('expo-file-system');
const { createNativeDictionaryLoader } = require('./index.cjs');

/** Expo SDK 54+ adapter for bundled Android and iOS data assets, including offline app resources. */
function createExpoDictionaryLoader(assets) {
  return createNativeDictionaryLoader(assets, {
    async readAssetText(moduleId) {
      const asset = Asset.fromModule(moduleId);
      if (!asset.localUri) await asset.downloadAsync();
      if (!asset.localUri) throw new Error(`Could not resolve dictionary asset ${moduleId} to a local file`);
      return new File(asset.localUri).text();
    },
  });
}

module.exports = { createExpoDictionaryLoader };
