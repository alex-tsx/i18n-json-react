const { readFileSync, realpathSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { prepareAndroidI18n, ASSET_EXTENSION } = require('./prepare.cjs');

const FEATURE_FILE = /(?:^|[/\\])(?:i18n|[^/\\]+\.i18n)\.json$/;

/** Composes an existing Metro configuration, preserving its resolver, transformer and asset pipeline. */
async function withI18nMetro(baseConfig, options = {}) {
  const config = await baseConfig;
  const prepared = await prepareAndroidI18n({ ...options, projectRoot: config.projectRoot });
  const previous = config.resolver?.resolveRequest;
  return {
    ...config,
    watchFolders: [...new Set([...(config.watchFolders ?? []), ...prepared.watchFolders])],
    resolver: {
      ...config.resolver,
      assetExts: [...new Set([...(config.resolver?.assetExts ?? []), ASSET_EXTENSION])],
      sourceExts: (config.resolver?.sourceExts ?? []).filter(extension => extension !== ASSET_EXTENSION),
      resolveRequest(context, moduleName, platform) {
        const result = previous
          ? previous(context, moduleName, platform)
          : context.resolveRequest(context, moduleName, platform);
        if (platform !== 'android' || result.type !== 'sourceFile' || !FEATURE_FILE.test(result.filePath))
          return result;
        const file = realpathSync(result.filePath);
        const reference = prepared.references.get(file);
        if (!reference)
          throw new Error(
            `i18n file was not collected: ${file}. Adjust dirs/exclude so it is collected, then restart Metro.`,
          );
        const fingerprint = createHash('sha256').update(readFileSync(file, 'utf8')).digest('hex');
        if (prepared.fingerprints.get(file) !== fingerprint) {
          throw new Error(`i18n file changed after preparation: ${file}. Restart Metro to regenerate language assets.`);
        }
        return { type: 'sourceFile', filePath: reference };
      },
    },
  };
}

module.exports = { withI18nMetro, prepareAndroidI18n };
