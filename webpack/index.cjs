const { glob, readFile, realpath, stat } = require('node:fs/promises');
const path = require('node:path');
const { resolveRoot, computeId, parseFeature } = require('./utils.cjs');

const PLUGIN_NAME = 'I18nCollectPlugin';
const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/ide_node_modules/**', '**/.git/**'];

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
    const outputDir = this.options.outputDir ?? 'i18n';
    if (path.isAbsolute(outputDir) || outputDir.includes('\\') || outputDir.split('/').includes('..')) {
      throw new Error('I18nCollectPlugin outputDir must be a relative POSIX asset path');
    }
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, compilation => {
      compilation.hooks.processAssets.tapPromise(
        { name: PLUGIN_NAME, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS },
        async () => {
          const root = resolveRoot(compiler.context, this.options.root);
          const files = await findFiles(root, this.options, compilation);
          const perLanguage = new Map();
          const ids = new Map();
          for (const file of files) {
            const id = computeId(file, root);
            if (ids.has(id)) throw new Error(`i18n ID collision: ${file} and ${ids.get(id)}`);
            ids.set(id, file);
            compilation.fileDependencies.add(file);
            const json = parseFeature(await readFile(file, 'utf8'), file);
            for (const [language, messages] of Object.entries(json)) {
              if (!perLanguage.has(language)) perLanguage.set(language, Object.create(null));
              perLanguage.get(language)[id] = messages;
            }
          }
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

async function findFiles(root, options, compilation) {
  const files = new Set();
  const excludes = options.exclude ?? [];
  // Watch the root too, so creating a new feature dictionary triggers a rebuild.
  compilation.contextDependencies.add(root);
  for (const pattern of options.dirs ?? ['.']) {
    const dirs = /[*?[\]{}]/.test(pattern) ? glob(pattern, { cwd: root }) : [pattern];
    for await (const dir of dirs) {
      const absolute = path.resolve(root, dir);
      let stats;
      try {
        stats = await stat(absolute);
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      if (!stats.isDirectory()) continue;
      compilation.contextDependencies.add(absolute);
      for await (const file of glob('**/{i18n,*.i18n}.json', { cwd: absolute, exclude: DEFAULT_EXCLUDE })) {
        const fullPath = path.resolve(absolute, file);
        const relative = path.relative(root, fullPath).split(path.sep).join('/');
        if (excludes.some(exclude => path.matchesGlob(relative, exclude))) continue;
        files.add(await realpath(fullPath));
      }
    }
  }
  return [...files].sort();
}

module.exports = { i18nLoaderRule, I18nCollectPlugin };
