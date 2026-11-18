const { createHash } = require('node:crypto');
const { realpathSync } = require('node:fs');
const { glob, readFile, realpath, stat } = require('node:fs/promises');
const path = require('node:path');

function resolveRoot(context, root) {
  return realpathSync(path.resolve(context, root ?? '.'));
}

function computeId(file, root) {
  // Bundlers normally resolve linked packages to real paths. Collection must use the same identity.
  const relative = path.relative(realpathSync(root), realpathSync(file)).split(path.sep).join('/');
  return createHash('sha256').update(relative).digest('hex').slice(0, 16);
}

function parseFeature(content, file) {
  const json = JSON.parse(content);
  if (!isRecord(json)) throw new Error(`Expected a language object in ${file}`);
  for (const [language, messages] of Object.entries(json)) {
    if (!/^[a-zA-Z]{2,8}(?:[-_][a-zA-Z0-9]{1,8})*$/.test(language)) {
      throw new Error(`Invalid language identifier "${language}" in ${file}`);
    }
    if (!isRecord(messages)) throw new Error(`Expected a message object for "${language}" in ${file}`);
    for (const [key, value] of Object.entries(messages)) {
      if (typeof value !== 'string') throw new Error(`Expected a string for "${language}.${key}" in ${file}`);
    }
  }
  return json;
}

function resolveOutputDir(outputDir = 'i18n') {
  if (path.isAbsolute(outputDir) || outputDir.includes('\\') || outputDir.split('/').includes('..')) {
    throw new Error('i18n outputDir must be a relative POSIX asset path');
  }
  return path.posix.normalize(outputDir).replace(/\/+$/, '').replace(/^\.$/, '');
}

async function collectDictionaries(root, options = {}, onDirectory = () => {}) {
  const files = new Set();
  const excludes = options.exclude ?? [];
  // Directory dependencies also detect newly added feature files.
  onDirectory(root);
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
      onDirectory(await realpath(absolute));
      for await (const file of glob('**/{i18n,*.i18n}.json', {
        cwd: absolute,
        exclude: ['**/node_modules/**', '**/ide_node_modules/**', '**/.git/**'],
      })) {
        const fullPath = path.resolve(absolute, file);
        const relative = path.relative(root, fullPath).split(path.sep).join('/');
        if (excludes.some(exclude => path.matchesGlob(relative, exclude))) continue;
        files.add(await realpath(fullPath));
      }
    }
  }

  const sortedFiles = [...files].sort();
  const perLanguage = new Map();
  const ids = new Map();
  for (const file of sortedFiles) {
    const id = computeId(file, root);
    if (ids.has(id)) throw new Error(`i18n ID collision: ${file} and ${ids.get(id)}`);
    ids.set(id, file);
    const json = parseFeature(await readFile(file, 'utf8'), file);
    for (const [language, messages] of Object.entries(json)) {
      if (!perLanguage.has(language)) perLanguage.set(language, Object.create(null));
      perLanguage.get(language)[id] = messages;
    }
  }
  return { files: sortedFiles, perLanguage };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { resolveRoot, computeId, parseFeature, resolveOutputDir, collectDictionaries };
