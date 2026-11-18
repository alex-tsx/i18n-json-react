import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import webpack from 'webpack';
import { I18nCollectPlugin, i18nLoaderRule } from 'i18n-json-react/webpack';
import { createI18nStore } from 'i18n-json-react/core';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'i18n-json-react-test-'));
after(() => rm(temporary, { recursive: true, force: true }));

async function compile(context, pluginOptions = {}, loaderOptions = {}) {
  const compiler = webpack({
    mode: 'production',
    context,
    entry: './index.js',
    target: 'node',
    output: { path: path.join(context, 'output'), filename: 'main.cjs', library: { type: 'commonjs2' } },
    module: { rules: [i18nLoaderRule(loaderOptions)] },
    plugins: [new I18nCollectPlugin(pluginOptions)],
  });
  return new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        if (error || closeError) return reject(error ?? closeError);
        if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
        resolve(stats);
      });
    });
  });
}

test('real Webpack compilation extracts arbitrary languages, strips text and loads through runtime IDs', async () => {
  const context = path.join(temporary, 'app');
  const linkedPackage = path.join(temporary, 'linked-package');
  await mkdir(path.join(context, 'feature'), { recursive: true });
  await mkdir(path.join(context, 'ignored'), { recursive: true });
  await mkdir(path.join(context, 'node_modules', '@example'), { recursive: true });
  await mkdir(linkedPackage);
  await symlink(linkedPackage, path.join(context, 'node_modules', '@example', 'linked'));
  await writeFile(
    path.join(context, 'feature', 'i18n.json'),
    JSON.stringify({
      en: { save: 'UNIQUE English text' },
      'pt-BR': { save: 'Salvar' },
      'zh-Hant': { save: '儲存' },
    }),
  );
  await writeFile(path.join(context, 'ignored', 'i18n.json'), JSON.stringify({ en: { ignored: 'IGNORE ME' } }));
  await writeFile(
    path.join(linkedPackage, 'button.i18n.json'),
    JSON.stringify({ en: { cancel: 'Cancel' }, 'pt-BR': { cancel: 'Cancelar' } }),
  );
  await writeFile(
    path.join(context, 'index.js'),
    `import feature from './feature/i18n.json';\nimport linked from './node_modules/@example/linked/button.i18n.json';\nexport { feature, linked };\n`,
  );
  const config = {
    dirs: ['.', 'node_modules/@example/*', 'node_modules/@example/linked'],
    exclude: ['ignored/**'],
    outputDir: 'locales',
  };
  await compile(context, config);
  const bundle = await readFile(path.join(context, 'output', 'main.cjs'), 'utf8');
  assert.equal(bundle.includes('UNIQUE English text'), false);
  const require = createRequire(import.meta.url);
  const { feature, linked } = require(path.join(context, 'output', 'main.cjs'));
  assert.deepEqual(Object.keys(feature), ['__id']);
  const en = JSON.parse(await readFile(path.join(context, 'output', 'locales', 'en.json'), 'utf8'));
  const pt = JSON.parse(await readFile(path.join(context, 'output', 'locales', 'pt-BR.json'), 'utf8'));
  assert.equal(Object.keys(en).length, 2);
  assert.deepEqual(en[feature.__id], { save: 'UNIQUE English text' });
  assert.deepEqual(en[linked.__id], { cancel: 'Cancel' });
  const store = createI18nStore({
    supportedLanguages: ['en', 'pt-BR'],
    fallbackLanguage: 'en',
    initialLanguage: 'pt-BR',
    storage: false,
    dictionaries: { en, 'pt-BR': pt },
  });
  assert.equal(store.createTypoGetter(feature)('save'), 'Salvar');
  assert.equal(store.createTypoGetter(linked)('cancel'), 'Cancelar');
  const oldId = feature.__id;
  await writeFile(path.join(context, 'feature', 'i18n.json'), JSON.stringify({ en: { save: 'Updated' } }));
  await compile(context, config);
  const updated = JSON.parse(await readFile(path.join(context, 'output', 'locales', 'en.json'), 'utf8'));
  assert.equal(updated[oldId].save, 'Updated');
});

test('collector reports invalid translations and prevents unsafe locale asset paths', async () => {
  const context = path.join(temporary, 'invalid');
  await mkdir(context);
  await writeFile(path.join(context, 'index.js'), 'export default 1;');
  await writeFile(path.join(context, 'i18n.json'), JSON.stringify({ en: { nested: { text: 'Wrong' } } }));
  await assert.rejects(compile(context), /Expected a string/);
  await writeFile(path.join(context, 'i18n.json'), JSON.stringify({ '../escape': { text: 'Wrong' } }));
  await assert.rejects(compile(context), /Invalid language identifier/);
});

test('loader and collector support the same custom root', async () => {
  const context = path.join(temporary, 'custom-root');
  await mkdir(path.join(context, 'src'), { recursive: true });
  await writeFile(path.join(context, 'index.js'), `export { default } from './src/i18n.json';`);
  await writeFile(path.join(context, 'src', 'i18n.json'), JSON.stringify({ en: { save: 'Save' } }));
  await compile(context, { root: 'src' }, { root: 'src' });
  const require = createRequire(import.meta.url);
  const { default: reference } = require(path.join(context, 'output', 'main.cjs'));
  const en = JSON.parse(await readFile(path.join(context, 'output', 'i18n', 'en.json'), 'utf8'));
  assert.deepEqual(en[reference.__id], { save: 'Save' });
});

test('watch mode rebuilds when a dictionary changes or a new feature is added', { timeout: 15000 }, async () => {
  const context = path.join(temporary, 'watch');
  await mkdir(path.join(context, 'feature'), { recursive: true });
  await writeFile(path.join(context, 'index.js'), 'export default 1;');
  const file = path.join(context, 'feature', 'i18n.json');
  await writeFile(file, JSON.stringify({ en: { title: 'First' } }));
  const compiler = webpack({
    mode: 'development',
    context,
    entry: './index.js',
    output: { path: path.join(context, 'output') },
    plugins: [new I18nCollectPlugin({ exclude: ['output/**'] })],
  });
  const queued = [];
  let waiting;
  const next = () =>
    queued.length
      ? Promise.resolve(queued.shift())
      : new Promise(resolve => {
          waiting = resolve;
        });
  const watcher = compiler.watch({ aggregateTimeout: 20, poll: 100, ignored: ['**/output/**'] }, (error, stats) => {
    const result = error ?? (stats.hasErrors() ? new Error(stats.toString({ all: false, errors: true })) : stats);
    if (waiting) {
      const resolve = waiting;
      waiting = undefined;
      resolve(result);
    } else queued.push(result);
  });
  const dictionary = async () => JSON.parse(await readFile(path.join(context, 'output', 'i18n', 'en.json'), 'utf8'));
  try {
    assert.equal((await next()) instanceof Error, false);
    await writeFile(file, JSON.stringify({ en: { title: 'Second' } }));
    assert.equal((await next()) instanceof Error, false);
    assert.equal(Object.values(await dictionary())[0].title, 'Second');
    await writeFile(path.join(context, 'feature', 'new.i18n.json'), JSON.stringify({ en: { save: 'Save' } }));
    assert.equal((await next()) instanceof Error, false);
    assert.equal(Object.keys(await dictionary()).length, 2);
  } finally {
    await new Promise((resolve, reject) => watcher.close(error => (error ? reject(error) : resolve())));
    await new Promise((resolve, reject) => compiler.close(error => (error ? reject(error) : resolve())));
  }
});
