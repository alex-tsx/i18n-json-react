const { validateLanguageDictionary } = require('../../dist/cjs/dictionaries.js');

/** Reads only a requested language's data asset. The existing I18N store handles caching and retries. */
function createAndroidDictionaryLoader(assets, options) {
  if (typeof options?.readAssetText !== 'function') throw new TypeError('readAssetText must be provided');
  return async language => {
    const provider = Object.prototype.hasOwnProperty.call(assets, language) ? assets[language] : undefined;
    if (typeof provider !== 'function') throw new Error(`No bundled dictionary asset for language: ${language}`);
    const moduleId = provider();
    if (!Number.isInteger(moduleId) || moduleId <= 0)
      throw new TypeError(`Invalid native asset module for language: ${language}`);
    const dictionary = JSON.parse(await options.readAssetText(moduleId));
    validateLanguageDictionary(dictionary);
    return dictionary;
  };
}

module.exports = { createAndroidDictionaryLoader };
