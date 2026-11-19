import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const shortRoot = String.raw`C:\Users\RUNNER~1\AppData\Local\Temp\app`;
const canonicalRoot = String.raw`C:\Users\runneradmin\AppData\Local\Temp\app`;
const feature = String.raw`feature\i18n.json`;
const content = '{"EN":{"save":"Save"}}';

test('Windows short and long paths produce the same root-relative ID in collectors and loaders', async () => {
  const shared = await loadModule('../bundlers/shared.cjs', { 'node:fs': windowsFs, 'node:path': path.win32 });
  const expected = createHash('sha256').update('feature/i18n.json').digest('hex').slice(0, 16);
  const resolvedRoot = shared.resolveRoot(shortRoot);
  for (const root of [shortRoot, canonicalRoot, resolvedRoot]) {
    for (const fileRoot of [shortRoot, canonicalRoot]) {
      assert.equal(shared.computeId(path.win32.join(fileRoot, feature), root), expected);
    }
  }
  assert.equal(resolvedRoot, canonicalRoot);
});

test('Metro resolves Windows aliases to the same feature identity used by asynchronous collection', async () => {
  const canonicalFile = path.win32.join(canonicalRoot, feature);
  const reference = path.win32.join(canonicalRoot, '.i18n-json-react', 'references', 'feature.js');
  const metro = await loadModule('../native/metro.cjs', {
    'node:fs': { ...windowsFs, readFileSync: () => content },
    './prepare.cjs': {
      ASSET_EXTENSION: 'i18npack',
      prepareNativeI18n: async () => ({
        references: new Map([[canonicalFile, reference]]),
        fingerprints: new Map([[canonicalFile, createHash('sha256').update(content).digest('hex')]]),
        watchFolders: [canonicalRoot],
      }),
    },
  });
  const config = await metro.withI18nMetro({
    projectRoot: shortRoot,
    resolver: { resolveRequest: () => ({ type: 'sourceFile', filePath: path.win32.join(shortRoot, feature) }) },
  });
  for (const platform of ['android', 'ios']) {
    assert.equal(config.resolver.resolveRequest({}, './i18n.json', platform).filePath, reference);
  }
});

// The JavaScript resolver preserves short aliases; the native resolver used by
// fs/promises.realpath expands them. Simulate that Windows behavior on every OS.
const windowsFs = {
  realpathSync: Object.assign(file => path.win32.normalize(file), {
    native: file => path.win32.normalize(file).replace(shortRoot, canonicalRoot),
  }),
};

async function loadModule(file, dependencies) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: name => dependencies[name] ?? require(name) }, { filename: file });
  return module.exports;
}
