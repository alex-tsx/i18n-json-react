const { createHash } = require('node:crypto');
const { realpathSync } = require('node:fs');
const path = require('node:path');

function resolveRoot(context, root) {
  return realpathSync(path.resolve(context, root ?? '.'));
}

function computeId(file, root) {
  // Webpack resolves symlinked packages to their real paths by default. Use the same identity when collecting.
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

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { resolveRoot, computeId, parseFeature };
