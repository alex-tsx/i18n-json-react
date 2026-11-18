const { readFile, realpath } = require('node:fs/promises');
const path = require('node:path');
const {
  resolveRoot,
  computeId,
  parseFeature,
  resolveOutputDir,
  collectDictionaries,
} = require('../bundlers/shared.cjs');

const VIRTUAL_PREFIX = '\0i18n-json-react:';
const FEATURE_FILE = /(?:^|[/\\])(?:i18n|[^/\\]+\.i18n)\.json$/;

/** Extracts feature JSON for Vite builds and serves language dictionaries during development. */
function i18nJsonPlugin(options = {}) {
  const outputDir = resolveOutputDir(options.outputDir);
  let config;
  let root;
  let collected;
  let collection;
  let server;
  const virtualFiles = new Map();

  async function collect() {
    const directories = new Set();
    const outDir = path.relative(root, path.resolve(config.root, config.build.outDir)).split(path.sep).join('/');
    const result = await collectDictionaries(
      root,
      {
        ...options,
        exclude: [...(options.exclude ?? []), ...(outDir && !outDir.startsWith('..') ? [`${outDir}/**`] : [])],
      },
      directory => directories.add(directory),
    );
    collected = { ...result, files: new Set(result.files), directories };
    server?.watcher.add([...directories, ...result.files]);
    return collected;
  }

  function refresh() {
    // Serialize scans so requests cannot observe an older scan finishing after a newer edit.
    collection = (collection ?? Promise.resolve()).then(collect, collect);
    return collection;
  }

  return {
    name: 'vite-plugin-i18n-json-react',
    enforce: 'pre',
    configResolved(resolved) {
      config = resolved;
      root = resolveRoot(config.root, options.root);
    },
    async buildStart() {
      const current = await refresh();
      for (const file of [...current.directories, ...current.files]) this.addWatchFile(file);
    },
    async resolveId(source, importer) {
      const [file, query = ''] = source.split('?', 2);
      if (!FEATURE_FILE.test(file) || source.startsWith(VIRTUAL_PREFIX)) return null;
      // Explicit asset/raw imports retain Vite's usual semantics.
      if ([...new URLSearchParams(query).keys()].some(key => !['import', 't', 'v'].includes(key))) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved || resolved.external) return null;
      const absolute = await realpath(resolved.id.split('?', 1)[0]);
      const current = await (collection ?? refresh());
      if (!current.files.has(absolute)) return null;
      // A virtual ID avoids Vite's built-in JSON transform parsing the generated JavaScript.
      const id = `${VIRTUAL_PREFIX}${Buffer.from(absolute).toString('base64url')}`;
      virtualFiles.set(id, absolute);
      return { id, moduleSideEffects: false };
    },
    async load(id) {
      const file = virtualFiles.get(id);
      if (!file) return null;
      const content = await readFile(file, 'utf8');
      parseFeature(content, file);
      this.addWatchFile(file);
      return {
        code: `export default ${JSON.stringify({ __id: computeId(file, root) })};`,
        map: { version: 3, names: [], sources: [file], sourcesContent: [content], mappings: 'AAAA' },
      };
    },
    async generateBundle() {
      const current = await collection;
      for (const [language, dictionary] of current.perLanguage) {
        this.emitFile({
          type: 'asset',
          fileName: path.posix.join(outputDir, `${language}.json`),
          source: JSON.stringify(dictionary, null, config.isProduction ? 0 : 2),
        });
      }
    },
    async configureServer(devServer) {
      server = devServer;
      await refresh();
      const base = new URL(config.base, 'http://vite.local/').pathname.replace(/\/?$/, '/');
      const prefix = `${base}${outputDir ? `${outputDir}/` : ''}`;
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url, 'http://vite.local/');
        const pathname = url.pathname;
        if (['raw', 'url', 'import'].some(key => url.searchParams.has(key))) return next();
        if (!pathname.startsWith(prefix) || !pathname.endsWith('.json')) return next();
        if (request.method !== 'GET' && request.method !== 'HEAD') return next();
        void (async () => {
          const language = decodeURIComponent(pathname.slice(prefix.length, -5));
          const current = await collection;
          const dictionary = current.perLanguage.get(language);
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.statusCode = dictionary ? 200 : 404;
          response.end(
            request.method === 'HEAD' ? undefined : JSON.stringify(dictionary ?? { error: 'Unknown language' }),
          );
        })().catch(next);
      });

      const onChange = (event, file) => {
        if (!['add', 'change', 'unlink'].includes(event) || !FEATURE_FILE.test(file)) return;
        file = path.resolve(file);
        const wasIncluded = collected.files.has(file);
        void refresh()
          .then(current => {
            if (!wasIncluded && !current.files.has(file)) return;
            for (const id of virtualFiles.keys()) {
              const module = server.moduleGraph.getModuleById(id);
              if (module) server.moduleGraph.invalidateModule(module);
            }
            // The runtime intentionally caches loaded languages. A reload creates fresh resources.
            server.ws.send({ type: 'full-reload', path: '*' });
          })
          .catch(error => {
            server.config.logger.error(error.stack ?? String(error));
            server.ws.send({
              type: 'error',
              err: { message: error.message ?? String(error), stack: error.stack ?? '' },
            });
          });
      };
      server.watcher.on('all', onChange);
      server.watcher.once('close', () => server.watcher.off('all', onChange));
    },
  };
}

module.exports = { i18nJsonPlugin };
