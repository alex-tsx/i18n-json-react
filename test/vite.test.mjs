import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { build, createServer } from 'vite';
import { i18nJsonPlugin } from 'i18n-json-react/vite';
import { createI18nStore } from 'i18n-json-react/core';

const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), 'i18n-json-react-vite-')));
after(() => rm(temporary, { recursive: true, force: true }));
const english = { title: 'UNIQUE English text', fallback: 'Fallback' };
const portuguese = { title: 'Salvar' };

async function buildFixture(root, options = {}, config = {}) {
  return build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [i18nJsonPlugin(options)],
    build: { lib: { entry: path.join(root, 'index.js'), formats: ['es'], fileName: () => 'main.mjs' }, minify: false },
    ...config,
  });
}

test('Vite build extracts arbitrary locales and linked packages with IDs usable by the runtime', async () => {
  const root = path.join(temporary, 'build');
  const linked = path.join(temporary, 'linked');
  await mkdir(path.join(root, 'feature'), { recursive: true });
  await mkdir(path.join(root, 'ignored'));
  await mkdir(path.join(root, 'node_modules', '@example'), { recursive: true });
  await mkdir(linked);
  await symlink(linked, path.join(root, 'node_modules', '@example', 'linked'));
  await writeFile(
    path.join(root, 'feature', 'i18n.json'),
    JSON.stringify({ en: english, 'pt-BR': portuguese, 'zh-Hant': { title: '儲存' } }),
  );
  await writeFile(path.join(linked, 'shared.i18n.json'), JSON.stringify({ en: { cancel: 'Cancel' } }));
  await writeFile(path.join(root, 'ignored', 'i18n.json'), JSON.stringify({ en: { ignored: 'Ignore' } }));
  await writeFile(
    path.join(root, 'index.js'),
    `export { default as feature } from './feature/i18n.json';\nexport { default as linked } from './node_modules/@example/linked/shared.i18n.json';`,
  );
  await buildFixture(
    root,
    { dirs: ['.', 'node_modules/@example/*'], exclude: ['ignored/**'], outputDir: 'locales' },
    { base: '/app/' },
  );
  const bundle = await readFile(path.join(root, 'dist', 'main.mjs'), 'utf8');
  assert.equal(bundle.includes('UNIQUE English text'), false);
  const { feature, linked: reference } = await import(pathToFileURL(path.join(root, 'dist', 'main.mjs')));
  assert.deepEqual(Object.keys(feature), ['__id']);
  const en = JSON.parse(await readFile(path.join(root, 'dist', 'locales', 'en.json'), 'utf8'));
  const pt = JSON.parse(await readFile(path.join(root, 'dist', 'locales', 'pt-BR.json'), 'utf8'));
  assert.equal(Object.keys(en).length, 2);
  assert.deepEqual(en[feature.__id], english);
  assert.deepEqual(en[reference.__id], { cancel: 'Cancel' });
  assert.deepEqual(
    JSON.parse(await readFile(path.join(root, 'dist', 'locales', 'zh-Hant.json'), 'utf8'))[feature.__id],
    { title: '儲存' },
  );
  const store = createI18nStore({
    supportedLanguages: ['en', 'pt-BR'],
    fallbackLanguage: 'en',
    initialLanguage: 'pt-BR',
    storage: false,
    dictionaries: { en, 'pt-BR': pt },
  });
  const t = store.createTypoGetter(feature);
  assert.equal(t('title'), 'Salvar');
  assert.equal(t('fallback'), 'Fallback');
});

test('Vite supports custom collection roots, exclusions and raw/URL imports', async () => {
  const root = path.join(temporary, 'custom');
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'i18n.json'), JSON.stringify({ en: english }));
  await writeFile(path.join(root, 'src', 'inline.i18n.json'), JSON.stringify({ en: { title: 'Inline' } }));
  await writeFile(
    path.join(root, 'index.js'),
    `export { default as feature } from './src/i18n.json';\nexport { default as raw } from './src/i18n.json?raw';\nexport { default as url } from './src/i18n.json?url';\nexport { default as inline } from './src/inline.i18n.json';`,
  );
  await buildFixture(root, { root: 'src', exclude: ['inline.i18n.json'] });
  const result = await import(pathToFileURL(path.join(root, 'dist', 'main.mjs')));
  assert.equal(JSON.parse(result.raw).en.title, english.title);
  assert.ok(result.url.startsWith('data:') || result.url.endsWith('.json'));
  assert.deepEqual(result.inline, { en: { title: 'Inline' } });
  const en = JSON.parse(await readFile(path.join(root, 'dist', 'i18n', 'en.json'), 'utf8'));
  assert.deepEqual(en[result.feature.__id], english);
  assert.equal(Object.keys(en).length, 1);
});

test('a production HTML app keeps language files under its configured public base', async () => {
  const root = path.join(temporary, 'html-app');
  await mkdir(root);
  await writeFile(path.join(root, 'i18n.json'), JSON.stringify({ en: english }));
  await writeFile(path.join(root, 'index.html'), '<script type="module" src="/index.js"></script>');
  await writeFile(
    path.join(root, 'index.js'),
    `import info from './i18n.json';\nwindow.translations = { info, url: import.meta.env.BASE_URL + 'i18n/en.json' };`,
  );
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    base: '/dashboard/',
    plugins: [i18nJsonPlugin()],
    build: { minify: false },
  });
  const script = result.output.find(file => file.type === 'chunk');
  assert.ok(script.code.includes('/dashboard/i18n/en.json'));
  assert.equal(script.code.includes('UNIQUE English text'), false);
  assert.ok((await readFile(path.join(root, 'dist', 'index.html'), 'utf8')).includes('/dashboard/assets/'));
  assert.ok(
    Object.values(JSON.parse(await readFile(path.join(root, 'dist', 'i18n', 'en.json'), 'utf8'))).some(
      messages => messages.title === english.title,
    ),
  );
});

test('Vite rejects invalid translations and unsafe output paths', async () => {
  const root = path.join(temporary, 'invalid');
  await mkdir(root);
  await writeFile(path.join(root, 'index.js'), 'export default 1;');
  await writeFile(path.join(root, 'i18n.json'), JSON.stringify({ en: { invalid: 42 } }));
  await assert.rejects(buildFixture(root), /Expected a string/);
  assert.throws(() => i18nJsonPlugin({ outputDir: '../outside' }), /relative POSIX/);
  assert.equal(typeof createRequire(import.meta.url)('i18n-json-react/vite').i18nJsonPlugin, 'function');
});

test(
  'Vite dev serves dictionaries under base, transforms imports and reloads after edits, additions and deletions',
  { timeout: 20000 },
  async () => {
    const root = path.join(temporary, 'dev');
    await mkdir(path.join(root, 'feature'), { recursive: true });
    const file = path.join(root, 'feature', 'i18n.json');
    await writeFile(file, JSON.stringify({ en: english, 'pt-BR': portuguese }));
    const server = await createServer({
      root,
      configFile: false,
      base: '/app/',
      logLevel: 'silent',
      plugins: [i18nJsonPlugin({ outputDir: 'locales/' })],
      server: { middlewareMode: true, hmr: false, watch: { usePolling: true, interval: 30 } },
      optimizeDeps: { noDiscovery: true },
    });
    const messages = [];
    const http = createHttpServer(server.middlewares);
    const send = server.ws.send.bind(server.ws);
    server.ws.send = message => {
      messages.push(message);
      send(message);
    };
    try {
      await new Promise((resolve, reject) => {
        http.once('error', reject);
        http.listen(0, '127.0.0.1', resolve);
      });
      const origin = `http://127.0.0.1:${http.address().port}`;
      const request = async (url, method = 'GET') => {
        const response = await fetch(`${origin}${url}`, { method });
        return { status: response.status, headers: response.headers, body: await response.text() };
      };
      // createServer may finish after Chokidar's one-time ready event; allow polling to establish its baseline.
      await new Promise(resolve => setTimeout(resolve, 100));
      const result = await server.transformRequest('/feature/i18n.json');
      assert.ok(result.code.includes('__id'));
      assert.equal(result.code.includes('UNIQUE English text'), false);
      const reference = JSON.parse(result.code.match(/export default (\{[^;]+\})/)[1]);
      const response = await request('/app/locales/en.json?cache=123');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(JSON.parse(response.body)[reference.__id], english);
      assert.equal((await request('/app/locales/en.json', 'HEAD')).body, '');
      assert.equal((await request('/app/locales/fr.json')).status, 404);
      await writeFile(file, JSON.stringify({ en: { title: 'Changed' } }));
      await until(() => messages.some(message => message.type === 'full-reload'));
      assert.equal(JSON.parse((await request('/app/locales/en.json')).body)[reference.__id].title, 'Changed');
      assert.equal((await request('/app/locales/pt-BR.json')).status, 404);
      messages.length = 0;
      const extra = path.join(root, 'feature', 'extra.i18n.json');
      await writeFile(extra, JSON.stringify({ en: { save: 'Save' } }));
      await until(() => messages.some(message => message.type === 'full-reload'));
      assert.equal(Object.keys(JSON.parse((await request('/app/locales/en.json')).body)).length, 2);
      messages.length = 0;
      await rm(extra);
      await until(() => messages.some(message => message.type === 'full-reload'));
      assert.equal(Object.keys(JSON.parse((await request('/app/locales/en.json')).body)).length, 1);
    } finally {
      http.closeAllConnections();
      await new Promise((resolve, reject) =>
        http.close(error => (error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve())),
      );
      await server.close();
    }
  },
);

async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for Vite reload');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
