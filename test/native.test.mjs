import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import vm from 'node:vm';
import Metro from 'metro';
import { getDefaultConfig } from 'metro-config';
import { createI18nStore } from 'i18n-json-react/core';
import { createNativeDictionaryLoader } from 'i18n-json-react/native';
import { createAndroidDictionaryLoader } from 'i18n-json-react/native/android';
import { createIOSDictionaryLoader } from 'i18n-json-react/native/ios';
import { prepareNativeI18n, withI18nMetro } from 'i18n-json-react/native/metro';
import { prepareAndroidI18n } from 'i18n-json-react/native/android/metro';
import { prepareIOSI18n, withI18nMetro as iosMetro } from 'i18n-json-react/native/ios/metro';

const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), 'i18n-json-react-native-')));
after(() => rm(temporary, { recursive: true, force: true }));
const exec = promisify(execFile);
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const { computeId } = require('../bundlers/shared.cjs');
const texts = {
  EN: { hello: 'UNIQUE English translation', fallback: 'English fallback' },
  UK: { hello: 'Унікальний український переклад', fallback: 'Резервний переклад' },
  FR: { hello: 'UNIQUE French translation' },
};

async function fixture(name) {
  const workspace = path.join(temporary, name);
  const native = path.join(workspace, 'native');
  const shared = path.join(workspace, 'src', 'profile');
  await mkdir(native, { recursive: true });
  await mkdir(shared, { recursive: true });
  const file = path.join(shared, 'i18n.json');
  await writeFile(file, JSON.stringify(texts));
  return { workspace, native, file };
}

test('Android, iOS and shared native entry points use the same preparation and loader', () => {
  assert.equal(createAndroidDictionaryLoader, createNativeDictionaryLoader);
  assert.equal(createIOSDictionaryLoader, createNativeDictionaryLoader);
  assert.equal(prepareAndroidI18n, prepareNativeI18n);
  assert.equal(prepareIOSI18n, prepareNativeI18n);
  assert.equal(iosMetro, withI18nMetro);
});

test('native generation collects shared feature JSON as separate assets and lazy module providers', async () => {
  const { workspace, native, file } = await fixture('generation');
  const prepared = await prepareNativeI18n({ projectRoot: native, root: '..', dirs: ['src'] });
  assert.deepEqual(prepared.languages, ['EN', 'FR', 'UK']);
  const id = computeId(file, workspace);
  const stub = await readFile(prepared.references.get(file), 'utf8');
  assert.equal(stub.includes('UNIQUE English translation'), false);
  assert.ok(stub.includes(id));
  const en = JSON.parse(await readFile(path.join(prepared.outputDir, 'assets', 'EN.i18npack'), 'utf8'));
  assert.deepEqual(en[id], texts.EN);
  const code = await readFile(prepared.manifestPath, 'utf8');
  const loads = [];
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    require: file => {
      loads.push(file);
      return loads.length;
    },
  });
  assert.deepEqual(loads, []);
  assert.equal(module.exports.EN(), 1);
  assert.deepEqual(loads, ['./assets/EN.i18npack']);
  const type = await readFile(path.join(prepared.outputDir, 'manifest.d.cts'), 'utf8');
  assert.ok(type.includes('readonly "EN": () => number'));
  const modified = (await stat(prepared.manifestPath)).mtimeMs;
  await prepareNativeI18n({ projectRoot: native, root: '..', dirs: ['src'] });
  assert.equal((await stat(prepared.manifestPath)).mtimeMs, modified);
});

test('native language selection and regeneration remove stale generated files safely', async () => {
  const { native, file } = await fixture('subset');
  const options = { projectRoot: native, root: '..', dirs: ['src'] };
  const first = await prepareNativeI18n(options);
  await writeFile(path.join(first.outputDir, 'assets', 'notes.txt'), 'Keep this file');
  const next = await prepareNativeI18n({ ...options, languages: ['UK', 'EN'] });
  assert.deepEqual((await readdir(path.join(next.outputDir, 'assets'))).sort(), [
    'EN.i18npack',
    'UK.i18npack',
    'notes.txt',
  ]);
  assert.equal((await readFile(next.manifestPath, 'utf8')).includes('"FR"'), false);
  await rm(file);
  await prepareNativeI18n(options);
  assert.deepEqual(await readdir(path.join(next.outputDir, 'references')), []);
  const manual = path.join(native, 'manual');
  await mkdir(manual);
  await writeFile(path.join(manual, 'keep.txt'), 'Do not overwrite');
  await assert.rejects(prepareNativeI18n({ ...options, outputDir: 'manual' }), /non-generated/);
  await assert.rejects(prepareNativeI18n({ ...options, outputDir: '.' }), /dedicated/);
  await assert.rejects(prepareNativeI18n({ ...options, languages: [] }), /nonempty/);
  await assert.rejects(prepareNativeI18n({ ...options, languages: ['EN', 'EN'] }), /duplicates/);
});

test('Metro integration preserves prior config/resolver behavior and rejects unprepared or changed sources', async () => {
  const { native, file } = await fixture('resolver');
  const transformer = { custom: true };
  let calls = 0;
  const config = await withI18nMetro(
    {
      projectRoot: native,
      transformer,
      watchFolders: [native],
      resolver: {
        assetExts: ['png'],
        sourceExts: ['js', 'json'],
        resolveRequest: () => {
          calls++;
          return { type: 'sourceFile', filePath: file };
        },
      },
    },
    { root: '..', dirs: ['src'] },
  );
  assert.equal(config.transformer, transformer);
  assert.ok(config.resolver.assetExts.includes('i18npack'));
  assert.ok(config.resolver.sourceExts.includes('json'));
  assert.equal(config.resolver.resolveRequest({}, './i18n.json', 'web').filePath, file);
  assert.ok(config.resolver.resolveRequest({}, './i18n.json', 'ios').filePath.includes('references'));
  assert.ok(config.resolver.resolveRequest({}, './i18n.json', 'android').filePath.includes('references'));
  assert.equal(calls, 3);
  await writeFile(file, JSON.stringify({ EN: { hello: 'Edited' } }));
  for (const platform of ['android', 'ios']) {
    assert.throws(() => config.resolver.resolveRequest({}, './i18n.json', platform), /Restart Metro/);
  }
});

test('native loader and the I18N store read only the fallback and selected assets, caching their contents', async () => {
  const reads = [];
  const requires = [];
  const assets = Object.fromEntries(
    ['UK', 'EN', 'FR'].map((language, index) => [
      language,
      () => {
        requires.push(language);
        return index + 1;
      },
    ]),
  );
  const loader = createNativeDictionaryLoader(assets, {
    readAssetText: async id => {
      const language = ['UK', 'EN', 'FR'][id - 1];
      reads.push(language);
      return JSON.stringify({ feature: texts[language] });
    },
  });
  const store = createI18nStore({
    supportedLanguages: ['UK', 'EN', 'FR'],
    fallbackLanguage: 'UK',
    initialLanguage: 'EN',
    storage: false,
    loadDictionary: loader,
  });
  await Promise.all([store.loadLanguage(), store.loadLanguage()]);
  assert.deepEqual(reads.sort(), ['EN', 'UK']);
  assert.deepEqual(requires.sort(), ['EN', 'UK']);
  assert.equal(store.createTypoGetter({ __id: 'feature' })('hello'), texts.EN.hello);
  await store.loadLanguage();
  assert.equal(reads.length, 2);
  await store.loadLanguage('FR');
  store.setCurrentLang('FR');
  assert.equal(store.createTypoGetter({ __id: 'feature' })('hello'), texts.FR.hello);
  assert.equal(store.createTypoGetter({ __id: 'feature' })('fallback'), texts.UK.fallback);
  assert.equal(reads.length, 3);
});

test('native asset errors reject clearly and use the core retry behavior', async () => {
  assert.throws(() => createNativeDictionaryLoader({ EN: () => 1 }), /readAssetText/);
  await assert.rejects(createNativeDictionaryLoader({}, { readAssetText: async () => '{}' })('EN'), /No bundled/);
  await assert.rejects(
    createNativeDictionaryLoader({ EN: () => 'bad' }, { readAssetText: async () => '{}' })('EN'),
    /Invalid native/,
  );
  await assert.rejects(
    createNativeDictionaryLoader({ EN: () => 1 }, { readAssetText: async () => '[]' })('EN'),
    /dictionary object/,
  );
  let attempts = 0;
  const loader = createNativeDictionaryLoader(
    { EN: () => 1 },
    {
      readAssetText: async () => {
        if (attempts++ === 0) throw new Error('Temporary I/O error');
        return '{"feature":{"hello":"Recovered"}}';
      },
    },
  );
  const store = createI18nStore({
    supportedLanguages: ['EN'],
    fallbackLanguage: 'EN',
    storage: false,
    loadDictionary: loader,
  });
  await assert.rejects(store.loadLanguage(), /Temporary I\/O/);
  await store.loadLanguage('EN', { retry: true });
  assert.equal(store.createTypoGetter({ __id: 'feature' })('hello'), 'Recovered');
});

test('Expo adapter uses cached local files or resolves only the requested asset before reading', async () => {
  const source = await readFile(path.join(root, 'native/expo.cjs'), 'utf8');
  const reads = [];
  const downloads = [];
  const records = new Map([
    [1, { localUri: 'file:///var/containers/Bundle/Application/APP/HealthLedger.app/assets/UK.i18npack' }],
    [
      2,
      {
        uri: 'http://127.0.0.1:8081/assets/EN.i18npack',
        localUri: null,
        async downloadAsync() {
          downloads.push(2);
          this.localUri = 'file:///EN.i18npack';
        },
      },
    ],
    [
      3,
      {
        uri: 'file:///var/containers/Bundle/Application/APP/HealthLedger.app/assets/FR.i18npack',
        localUri: null,
        async downloadAsync() {
          downloads.push(3);
          this.localUri = this.uri;
        },
      },
    ],
  ]);
  const module = { exports: {} };
  const dependencies = {
    'expo-asset': { Asset: { fromModule: id => records.get(id) } },
    'expo-file-system': {
      File: class {
        constructor(uri) {
          this.uri = uri;
        }
        async text() {
          reads.push(this.uri);
          return '{"feature":{"hello":"Hi"}}';
        }
      },
    },
    './index.cjs': { createNativeDictionaryLoader },
  };
  vm.runInNewContext(source, { module, require: name => dependencies[name] });
  const loader = module.exports.createExpoDictionaryLoader({ UK: () => 1, EN: () => 2, FR: () => 3 });
  await loader('UK');
  assert.deepEqual(downloads, []);
  await loader('EN');
  assert.deepEqual(downloads, [2]);
  assert.deepEqual(reads, [
    'file:///var/containers/Bundle/Application/APP/HealthLedger.app/assets/UK.i18npack',
    'file:///EN.i18npack',
  ]);
  await loader('FR');
  assert.deepEqual(downloads, [2, 3]);
  assert.equal(reads[2], records.get(3).uri);
});

test('shared and platform CLIs prepare a workspace and report generation errors', async () => {
  const { native } = await fixture('cli');
  const command = path.join(root, 'native/cli.cjs');
  const result = await exec(process.execPath, [
    command,
    '--project-root',
    native,
    '--root',
    '..',
    '--dir',
    'src',
    '--language',
    'EN',
  ]);
  assert.match(result.stdout, /Prepared 1 feature dictionaries for EN/);
  assert.equal((await readFile(path.join(native, '.i18n-json-react', 'manifest.cjs'), 'utf8')).includes('"UK"'), false);
  await assert.rejects(
    exec(process.execPath, [command, '--unknown']),
    error => error.code === 1 && error.stderr.includes('Invalid option'),
  );
  for (const platform of ['android', 'ios']) {
    const platformCommand = path.join(root, `native/${platform}/cli.cjs`);
    const prepared = await exec(process.execPath, [
      platformCommand,
      '--project-root',
      native,
      '--root',
      '..',
      '--dir',
      'src',
    ]);
    assert.match(prepared.stdout, /Prepared 1 feature dictionaries for EN, FR, UK/);
    const help = await exec(process.execPath, [platformCommand, '--help']);
    assert.ok(help.stdout.startsWith(`i18n-json-react-${platform} `));
  }
});

for (const platform of ['android', 'ios']) {
  test(
    `production ${platform} Metro bundle contains IDs and asset metadata, with translations only in separate data assets`,
    { timeout: 30000 },
    async () => {
      const { workspace, native, file } = await fixture(`metro-${platform}`);
      await writeFile(
        path.join(native, 'babel.config.json'),
        JSON.stringify({ presets: [[require.resolve('@react-native/babel-preset'), { enableBabelRuntime: false }]] }),
      );
      await mkdir(path.join(workspace, 'node_modules'));
      await symlink(root, path.join(workspace, 'node_modules', 'i18n-json-react'));
      await writeFile(
        path.join(native, 'registry.js'),
        'exports.registerAsset = asset => { global.__registeredAssets.push(asset); return global.__registeredAssets.length; };',
      );
      await writeFile(
        path.join(native, 'index.js'),
        `
const assets = require('./.i18n-json-react/manifest.cjs');
const info = require('../src/profile/i18n.json');
const { createI18nStore } = require('i18n-json-react/core');
const { ${platform === 'ios' ? 'createIOSDictionaryLoader' : 'createAndroidDictionaryLoader'}: createNativeDictionaryLoader } = require('i18n-json-react/native/${platform}');
global.__testStore = createI18nStore({ supportedLanguages: ['EN', 'UK', 'FR'], fallbackLanguage: 'UK', initialLanguage: 'EN', storage: false, loadDictionary: createNativeDictionaryLoader(assets, { readAssetText: id => global.__readAssetText(id) }) });
global.__getTestText = global.__testStore.createTypoGetter(info);
global.__testInfo = info;
`,
      );
      const base = await getDefaultConfig(native);
      const metroRequire = createRequire(require.resolve('metro/package.json'));
      const runtimeRoot = path.dirname(metroRequire.resolve('metro-runtime/package.json'));
      const config = await withI18nMetro(
        {
          ...base,
          maxWorkers: 1,
          useWatchman: false,
          watchFolders: [workspace, root, runtimeRoot],
          resolver: {
            ...base.resolver,
            nodeModulesPaths: [path.join(root, 'node_modules'), path.dirname(runtimeRoot)],
          },
          transformer: { ...base.transformer, assetRegistryPath: path.join(native, 'registry.js') },
          reporter: { update() {} },
        },
        { root: '..', dirs: ['src'] },
      );
      const result = await Metro.runBuild(config, {
        entry: 'index.js',
        platform,
        dev: false,
        minify: true,
        assets: true,
        sourceMap: false,
      });
      for (const messages of Object.values(texts)) assert.equal(result.code.includes(messages.hello), false);
      assert.equal(result.assets.length, 3);
      assert.ok(result.assets.every(asset => asset.type === 'i18npack'));
      const readLanguages = [];
      const context = { __registeredAssets: [], console, setTimeout, clearTimeout };
      context.global = context;
      context.__readAssetText = async id => {
        const metadata = context.__registeredAssets[id - 1];
        readLanguages.push(metadata.name);
        const asset = result.assets.find(asset => asset.name === metadata.name);
        return readFile(asset.files[0], 'utf8');
      };
      vm.runInNewContext(result.code, context);
      assert.equal(context.__registeredAssets.length, 0);
      assert.equal(context.__testInfo.__id, computeId(file, workspace));
      await context.__testStore.loadLanguage();
      assert.deepEqual(readLanguages.sort(), ['EN', 'UK']);
      assert.equal(context.__getTestText('hello'), texts.EN.hello);
      const artifact = path.join(native, `index.${platform}.bundle.js`);
      await writeFile(artifact, result.code);
      if (process.env.I18N_JSON_REACT_HERMES) {
        const dictionaries = Object.fromEntries(
          await Promise.all(result.assets.map(async asset => [asset.name, await readFile(asset.files[0], 'utf8')])),
        );
        const harness = `var global = this; global.console = { error: function(error) { print(String(error)); }, log: print, warn: print }; global.__registeredAssets = []; var reads = []; var dictionaries = ${JSON.stringify(dictionaries)};
global.__readAssetText = function(id) { var language = global.__registeredAssets[id - 1].name; reads.push(language); return Promise.resolve(dictionaries[language]); };
${result.code}
global.__testStore.loadLanguage().then(function() { if (reads.sort().join(',') !== 'EN,UK') throw new Error('Unexpected languages read: ' + reads); print(global.__getTestText('hello')); }, function(error) { throw error; });\n`;
        const harnessPath = path.join(native, 'hermes-test.js');
        await writeFile(harnessPath, harness);
        const { stdout } = await exec(process.env.I18N_JSON_REACT_HERMES, [harnessPath]);
        assert.ok(stdout.includes(texts.EN.hello));
      }
    },
  );
}
