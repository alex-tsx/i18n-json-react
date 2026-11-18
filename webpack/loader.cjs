const path = require('node:path');
const { resolveRoot, computeId, parseFeature } = require('./utils.cjs');

/** Replaces a feature dictionary with an opaque ID while TypeScript still sees the original JSON. */
module.exports = function i18nJsonLoader(content) {
  this.cacheable();
  parseFeature(content, this.resourcePath);
  const root = resolveRoot(this.rootContext, this.getOptions().root);
  const code = `export default ${JSON.stringify({ __id: computeId(this.resourcePath, root) })};`;
  const map = this.sourceMap
    ? {
        version: 3,
        file: path.basename(this.resourcePath),
        sources: [this.resourcePath],
        sourcesContent: [content],
        names: [],
        mappings: 'AAAA',
      }
    : undefined;
  this.callback(null, code, map);
};
