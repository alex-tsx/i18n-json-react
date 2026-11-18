const path = require('node:path');
const { resolveRoot, resolveOutputDir, collectDictionaries } = require('../bundlers/shared.cjs');

const PLUGIN_NAME = 'I18nCollectPlugin';

/** Rule that substitutes imported i18n.json and *.i18n.json files with { __id }. */
function i18nLoaderRule(options = {}) {
  return {
    test: [/\.i18n\.json$/, /[\\/]i18n\.json$/],
    type: 'javascript/auto',
    loader: require.resolve('./loader.cjs'),
    options,
  };
}

/** Collects feature-local dictionaries into one JSON asset per language. */
class I18nCollectPlugin {
  constructor(options = {}) {
    this.options = options;
  }

  apply(compiler) {
    const { Compilation, sources } = compiler.webpack;
    const outputDir = resolveOutputDir(this.options.outputDir);
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, compilation => {
      compilation.hooks.processAssets.tapPromise(
        { name: PLUGIN_NAME, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS },
        async () => {
          const root = resolveRoot(compiler.context, this.options.root);
          const { files, perLanguage } = await collectDictionaries(root, this.options, dir => {
            compilation.contextDependencies.add(dir);
          });
          for (const file of files) compilation.fileDependencies.add(file);
          for (const [language, dictionary] of perLanguage) {
            compilation.emitAsset(
              path.posix.join(outputDir, `${language}.json`),
              new sources.RawSource(JSON.stringify(dictionary, null, compiler.options.mode === 'production' ? 0 : 2)),
            );
          }
        },
      );
    });
  }
}

module.exports = { i18nLoaderRule, I18nCollectPlugin };
