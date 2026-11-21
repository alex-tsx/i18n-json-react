import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, mkdir, readFile, writeFile, readdir, rm, stat, symlink, realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {promisify} from 'node:util';
import {test, after} from 'node:test';
import vm from 'node:vm';
import {generateAndroidResources, generateAndroidResourcesFromConfig} from 'i18n-json-react/native/android/resources';

const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), 'i18n-android-resources-')));
after(() => rm(temporary, {recursive: true, force: true}));
const root = fileURLToPath(new URL('..', import.meta.url));
const exec = promisify(execFile);
async function fixture(name) {
  const projectRoot = path.join(temporary, name), source = path.join(projectRoot, 'src');
  await mkdir(source, {recursive: true});
  const messages = {
    EN: {title: 'Health & <records>', hello: 'Hello, %1$s: %2$d', empty: '', literal: '100% complete', spacing: '  two  spaces\nnext\tline  ', symbols: '@literal \\n "double" and \'single\''},
    UK: {title: 'Здоров’я & <записи>', hello: '%2$d — вітаю, %1$s', empty: ''},
  };
  const shared = {EN: {shared: 'Shared fallback', title: 'Shared title'}, UK: {shared: 'Спільний текст', title: 'Спільна назва'}};
  await writeFile(path.join(source, 'i18n.json'), JSON.stringify(messages));
  await writeFile(path.join(source, 'common.i18n.json'), JSON.stringify(shared));
  const target = {outputDir: 'res', dictionaries: ['src/i18n.json', 'src/common.i18n.json'], strings: {title: 'title', hello: 'hello', shared: 'shared', empty: 'empty', literal: 'literal', spacing: 'spacing', symbols: 'symbols'}};
  const options = {projectRoot, defaultLanguage: 'EN', languages: ['EN', 'UK'], resources: [target]};
  return {projectRoot, messages, target, options};
}
const output = (fixture, locale = 'values') => path.join(fixture.projectRoot, 'res', locale, 'i18n_json_react.xml');

test('Android resources use ordered feature dictionaries, per-key default fallback, native formatting, and UTF-8', async () => {
  const f = await fixture('generation');
  const result = await generateAndroidResources(f.options);
  assert.deepEqual(result.languages, ['EN', 'UK']);
  const en = await readFile(output(f), 'utf8'), uk = await readFile(output(f, 'values-uk'), 'utf8');
  assert.match(en, /name="title" formatted="false">"Health &amp; &lt;records&gt;"/);
  assert.match(uk, /Здоров’я &amp; &lt;записи&gt;/);
  assert.match(uk, /Спільний текст/);
  assert.match(en, /name="empty" formatted="false">""/);
  assert.match(uk, /name="hello" formatted="true">"%2\$d — вітаю, %1\$s"/);
  assert.match(uk, /name="literal" formatted="false">"100% complete"/);
  assert.match(en, /"  two  spaces\\nnext\\tline  "/);
  assert.ok(en.includes(String.raw`\@literal \\n \"double\" and \'single\'`));
  const modified = (await stat(output(f))).mtimeMs;
  await generateAndroidResources(f.options);
  assert.equal((await stat(output(f))).mtimeMs, modified);
});

test('locale mappings support uppercase IDs, regions, scripts, and a non-English default', async () => {
  const f = await fixture('locales');
  const dictionary = {EN: {title: 'English'}, UK: {title: 'Українська'}, PT: {title: 'Português'}, SR: {title: 'Српски'}};
  await writeFile(path.join(f.projectRoot, 'src/i18n.json'), JSON.stringify(dictionary));
  const result = await generateAndroidResources({...f.options, defaultLanguage: 'UK', languages: ['EN', 'UK', 'PT', 'SR'], locales: {PT: 'pt-BR', SR: 'sr-Latn-RS'}, resources: [{...f.target, strings: {title: 'title'}}]});
  assert.equal(result.files.length, 4);
  assert.match(await readFile(output(f), 'utf8'), /Українська/);
  assert.match(await readFile(output(f, 'values-en'), 'utf8'), /English/);
  assert.match(await readFile(output(f, 'values-b+pt+BR'), 'utf8'), /Português/);
  assert.match(await readFile(output(f, 'values-b+sr+Latn+RS'), 'utf8'), /Српски/);
});

test('generation validates all inputs before writing and preserves manual resources and stale manual locales', async () => {
  const f = await fixture('ownership');
  await generateAndroidResources(f.options);
  const original = await readFile(output(f), 'utf8');
  const bad = {...f.target, outputDir: 'other', strings: {missing: 'unknown'}};
  await assert.rejects(generateAndroidResources({...f.options, resources: [f.target, bad]}), /Missing EN/);
  assert.equal(await readFile(output(f), 'utf8'), original);
  await mkdir(path.join(f.projectRoot, 'res/values-fr'), {recursive: true});
  const manualLocale = path.join(f.projectRoot, 'res/values-fr/i18n_json_react.xml');
  await writeFile(manualLocale, '<resources><string name="manual">Keep me</string></resources>');
  const manualSibling = path.join(f.projectRoot, 'res/values/manual.xml');
  await writeFile(manualSibling, 'manual sibling');
  await generateAndroidResources({...f.options, languages: ['EN']});
  await assert.rejects(readFile(output(f, 'values-uk')), {code: 'ENOENT'});
  assert.match(await readFile(manualLocale, 'utf8'), /Keep me/);
  assert.equal(await readFile(manualSibling, 'utf8'), 'manual sibling');
  await writeFile(output(f), 'user-authored resources');
  await assert.rejects(generateAndroidResources(f.options), /non-generated/);
  assert.equal(await readFile(output(f), 'utf8'), 'user-authored resources');
});

test('symlink resource files are never overwritten', async t => {
  const f = await fixture('symlink');
  await mkdir(path.dirname(output(f)), {recursive: true});
  const manual = path.join(f.projectRoot, 'manual.xml');
  await writeFile(manual, 'keep');
  try {await symlink(manual, output(f));} catch (error) {if (error.code === 'EPERM') {t.skip('Symlinks unavailable'); return;} throw error;}
  await assert.rejects(generateAndroidResources(f.options), /non-file/);
  assert.equal(await readFile(manual, 'utf8'), 'keep');
});

test('invalid locales, resource names, output names, dictionary shapes, and unknown options fail clearly', async () => {
  const f = await fixture('validation');
  for (const [patch, pattern] of [
    [{languages: []}, /nonempty/], [{languages: ['UK']}, /include defaultLanguage/], [{languages: ['EN', 'EN']}, /duplicates/],
    [{languages: ['EN', 'FR']}, /No translations/], [{locales: {UK: 'en'}}, /same Android locale/],
    [{locales: {UK: 'uk-u-nu-latn'}}, /extensions/], [{locales: {UK: '../bad'}}, /Invalid Android locale/],
    [{locales: {FR: 'fr'}}, /unselected/], [{resources: []}, /nonempty/], [{unexpected: true}, /Unknown/],
    [{resources: [{...f.target, strings: {'bad-name': 'title'}}]}, /Invalid Android resource name/],
    [{resources: [{...f.target, fileName: '../strings.xml'}]}, /fileName/],
    [{resources: [f.target, f.target]}, /Duplicate/], [{resources: [{...f.target, dictionaries: []}]}, /nonempty/],
    [{resources: [{...f.target, strings: {bad: {key: 'title', formatted: 'yes'}}}]}, /boolean/],
  ]) await assert.rejects(generateAndroidResources({...f.options, ...patch}), pattern);
  await writeFile(path.join(f.projectRoot, 'src/i18n.json'), '{"EN":{"title":5}}');
  await assert.rejects(generateAndroidResources(f.options), /Expected a string/);
});

test('positional formatting is validated across locales and literal percent text can opt out', async () => {
  const f = await fixture('formatting');
  for (const value of ['Hello %2$s %1$d', 'Hello %1$s', 'Hello %1$s %2$q', 'Hello %s %2$d', 'Hello %1$s %2$d %']) {
    f.messages.UK.hello = value;
    await writeFile(path.join(f.projectRoot, 'src/i18n.json'), JSON.stringify(f.messages));
    await assert.rejects(generateAndroidResources(f.options), /Formatting arguments differ|positional format/);
  }
  f.messages.UK.hello = 'Literal %1$s';
  await writeFile(path.join(f.projectRoot, 'src/i18n.json'), JSON.stringify(f.messages));
  await generateAndroidResources({...f.options, resources: [{...f.target, strings: {hello: {key: 'hello', formatted: false}}}]});
  assert.match(await readFile(output(f, 'values-uk'), 'utf8'), /formatted="false">"Literal %1\$s"/);
  f.messages.EN.title = '\u0000';
  await writeFile(path.join(f.projectRoot, 'src/i18n.json'), JSON.stringify(f.messages));
  await assert.rejects(generateAndroidResources({...f.options, resources: [{...f.target, strings: {title: 'title'}}]}), /invalid XML character/);
});

test('config paths resolve from the JSON file and the CLI is independent of its working directory', async () => {
  const f = await fixture('config');
  await mkdir(path.join(f.projectRoot, 'native'));
  const config = path.join(f.projectRoot, 'native/resources.json');
  const {projectRoot: _, ...options} = f.options;
  await writeFile(config, JSON.stringify({...options, root: '..'}));
  const result = await generateAndroidResourcesFromConfig(config);
  assert.equal(result.root, f.projectRoot);
  const cli = path.join(root, 'native/android/resources-cli.cjs');
  const {stdout} = await exec(process.execPath, [cli, '--config', config], {cwd: temporary});
  assert.match(stdout, /Generated 2 Android resource files for EN, UK/);
  assert.match((await exec(process.execPath, [cli, '--help'])).stdout, /--config/);
  await assert.rejects(exec(process.execPath, [cli, '--unknown']), error => /Usage:/.test(error.stderr));
  await writeFile(config, JSON.stringify({...options, projectRoot: 'hidden'}));
  await assert.rejects(generateAndroidResourcesFromConfig(config), /without projectRoot/);
});

test('Expo plugin defers generation to Android prebuild and preserves the config', async () => {
  const f = await fixture('expo');
  const {projectRoot: _, ...options} = f.options;
  await writeFile(path.join(f.projectRoot, 'resources.json'), JSON.stringify(options));
  const pluginPath = path.join(root, 'native/android/plugin.cjs');
  const require = createRequire(import.meta.url);
  let registered;
  const module = {exports: {}};
  vm.runInNewContext(await readFile(pluginPath, 'utf8'), {
    module, require: name => name === '@expo/config-plugins' ? {withDangerousMod: (config, mod) => {registered = mod; return config;}}
      : require(path.resolve(path.dirname(pluginPath), name)),
  });
  const plugin = module.exports, config = {name: 'Example'};
  assert.equal(plugin(config, {config: 'resources.json'}), config);
  assert.equal(registered[0], 'android');
  await assert.rejects(readFile(output(f)), {code: 'ENOENT'});
  const mod = {modRequest: {projectRoot: f.projectRoot}};
  assert.equal(await registered[1](mod), mod);
  assert.match(await readFile(output(f), 'utf8'), /Health &amp;/);
  assert.throws(() => plugin(config), /JSON config path/);
  assert.throws(() => plugin(config, {config: 'resources.json', unknown: true}), /Unknown/);
});

test('generated resources compile with Android AAPT2 when provided', async t => {
  const compiler = process.env.I18N_JSON_REACT_AAPT2;
  if (!compiler) {t.skip('Set I18N_JSON_REACT_AAPT2 to run the Android resource compiler'); return;}
  const f = await fixture('aapt2');
  await generateAndroidResources(f.options);
  const compiled = path.join(f.projectRoot, 'compiled');
  await mkdir(compiled);
  await exec(compiler, ['compile', '--dir', path.join(f.projectRoot, 'res'), '-o', compiled]);
  assert.equal((await readdir(compiled)).filter(file => file.endsWith('.flat')).length, 2);
});
