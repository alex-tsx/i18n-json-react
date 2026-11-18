import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createI18nStore, createFetchDictionaryLoader, interpolateTypo } from 'i18n-json-react/core';

const messages = {
  en: { hello: 'Hello, {name}', empty: '', 'buttons.save': 'Save', fallback: 'Fallback' },
  uk: { hello: 'Вітаю, {name}', 'buttons.save': 'Зберегти' },
};
const options = {
  supportedLanguages: ['en', 'uk', 'pt-BR', 'zh-Hant'],
  fallbackLanguage: 'en',
  storage: false,
  getBrowserLanguages: () => [],
};

test('detects browser preferences using exact, script, regional and base matches', () => {
  const store = createI18nStore({ ...options, getBrowserLanguages: () => ['fr-FR', 'pt_br'] });
  assert.equal(store.getCurrentLang(), 'pt-BR');
  assert.equal(store.resolveLanguage('ZH-hant-TW'), 'zh-Hant');
  assert.equal(store.resolveLanguage('UK_ua'), 'uk');
  assert.equal(store.resolveLanguage('pt-PT'), undefined);
  assert.equal(createI18nStore(options).getCurrentLang(), 'en');
  assert.equal(
    createI18nStore({
      ...options,
      supportedLanguages: ['EN', 'UK'],
      fallbackLanguage: 'UK',
      getBrowserLanguages: () => ['en-US'],
    }).getCurrentLang(),
    'EN',
  );
});

test('storage takes priority, explicit initial language takes priority over storage', () => {
  const values = new Map([['custom-language', 'uk-UA']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = createI18nStore({ ...options, storage, storageKey: 'custom-language' });
  assert.equal(store.getCurrentLang(), 'uk');
  store.setCurrentLang('pt-BR');
  assert.equal(values.get('custom-language'), 'pt-BR');
  assert.equal(
    createI18nStore({ ...options, storage, storageKey: 'custom-language', initialLanguage: 'en' }).getCurrentLang(),
    'en',
  );
});

test('invalid stored values fall through and inaccessible storage is reported without preventing changes', () => {
  const errors = [];
  const broken = new Error('Storage unavailable');
  const store = createI18nStore({
    ...options,
    storage: {
      getItem() {
        throw broken;
      },
      setItem() {
        throw broken;
      },
    },
    onError: error => errors.push(error),
    getBrowserLanguages: () => ['uk-UA'],
  });
  assert.equal(store.getCurrentLang(), 'uk');
  store.setCurrentLang('en');
  assert.equal(store.getCurrentLang(), 'en');
  assert.deepEqual(errors, [broken, broken]);
  assert.equal(createI18nStore({ ...options, storage: { getItem: () => 'fr', setItem() {} } }).getCurrentLang(), 'en');
});

test('validates language configuration and runtime choices', () => {
  assert.throws(() => createI18nStore({ ...options, fallbackLanguage: 'fr' }), /must be supported/);
  assert.throws(() => createI18nStore({ ...options, initialLanguage: 'fr' }), /must be supported/);
  assert.throws(() => createI18nStore({ ...options, supportedLanguages: ['en', 'EN'] }), /Duplicate/);
  assert.throws(() => createI18nStore({ ...options, supportedLanguages: ['en', '../bad'] }), /Invalid language/);
  assert.throws(() => createI18nStore(options).setCurrentLang('fr'), /Unsupported/);
});

test('instances are isolated, subscribe only notifies actual changes, and unsubscribe works', () => {
  const first = createI18nStore(options);
  const second = createI18nStore(options);
  let changes = 0;
  const unsubscribe = first.subscribe(() => changes++);
  first.setCurrentLang('uk');
  first.setCurrentLang('uk');
  assert.equal(changes, 1);
  assert.equal(second.getCurrentLang(), 'en');
  unsubscribe();
  first.setCurrentLang('en');
  assert.equal(changes, 1);
  assert.equal(first.getServerLanguage(), 'en');
});

test('inline getters follow the current language or a fixed language and fall back per key', () => {
  const store = createI18nStore(options);
  const t = store.createTypoGetter(messages);
  const english = store.createTypoGetter(messages, { language: 'en' });
  assert.equal(t('hello', { name: 'Alex' }), 'Hello, Alex');
  store.setCurrentLang('uk');
  assert.equal(t('hello', { name: 'Олексій' }), 'Вітаю, Олексій');
  assert.equal(english('hello', { name: 'Alex' }), 'Hello, Alex');
  assert.equal(t('fallback'), 'Fallback');
  assert.equal(t('empty'), '');
  assert.equal(t('missing'), 'i18n(missing)');
  assert.equal(store.createTypoGetter(messages, { placehold: false })('missing'), '');
  assert.equal(t('constructor'), 'i18n(constructor)');
  assert.equal(t('toString'), 'i18n(toString)');
  const partial = { en: { hello: 'Hello' }, uk: { hello: undefined } };
  assert.deepEqual(store.getTypoAsObject(partial), { hello: 'Hello' });
});

test('interpolation handles repeated parameters, null, zero and prototype names safely', () => {
  assert.equal(
    interpolateTypo('{name}/{name}: {zero}/{missing}/{nil}/{user.name}/{constructor}', {
      name: 'A',
      zero: 0,
      nil: null,
      'user.name': 'B',
    }),
    'A/A: 0///B/',
  );
});

test('extracted dictionaries load fallback and current concurrently, deduplicate and update getters', async () => {
  const calls = [];
  const resolvers = new Map();
  const store = createI18nStore({
    ...options,
    initialLanguage: 'uk',
    loadDictionary: lang => {
      calls.push(lang);
      return new Promise(resolve => resolvers.set(lang, resolve));
    },
  });
  const t = store.createTypoGetter({ __id: 'feature' });
  const first = store.loadLanguage();
  const second = store.loadLanguage();
  let suspended;
  try {
    store.readLanguage();
  } catch (promise) {
    suspended = promise;
  }
  assert.ok(suspended instanceof Promise);
  await Promise.resolve();
  assert.deepEqual(calls, ['en', 'uk']);
  resolvers.get('en')({ feature: messages.en });
  resolvers.get('uk')({ feature: messages.uk });
  await Promise.all([first, second, suspended]);
  store.readLanguage();
  assert.equal(t('hello', { name: 'А' }), 'Вітаю, А');
  assert.equal(t('fallback'), 'Fallback');
  await store.loadLanguage();
  assert.deepEqual(calls, ['en', 'uk']);
});

test('failed resources throw their error and explicitly retry without reloading successful fallback', async () => {
  const failure = new Error('Offline');
  let attempts = 0;
  const calls = [];
  const store = createI18nStore({
    ...options,
    loadDictionary: async lang => {
      calls.push(lang);
      if (lang === 'uk' && attempts++ === 0) throw failure;
      return { feature: messages[lang] };
    },
  });
  await assert.rejects(store.loadLanguage('uk'), error => error === failure);
  assert.throws(
    () => store.readLanguage('uk'),
    error => error === failure,
  );
  await assert.rejects(store.loadLanguage('uk'), error => error === failure);
  await store.loadLanguage('uk', { retry: true });
  assert.deepEqual(calls, ['en', 'uk', 'uk']);
  assert.equal(store.createTypoGetter({ __id: 'feature' }, { language: 'uk' })('buttons.save'), 'Зберегти');
});

test('preloaded dictionaries need no loader, and malformed loaded payloads reject', async () => {
  const store = createI18nStore({ ...options, dictionaries: { en: { feature: messages.en } } });
  await store.loadLanguage('en');
  assert.equal(store.createTypoGetter({ __id: 'feature' })('buttons.save'), 'Save');
  await assert.rejects(store.loadLanguage('uk'), /Configure loadDictionary/);
  assert.throws(() => createI18nStore({ ...options, dictionaries: { en: [] } }), /dictionary object/);
  const malformed = createI18nStore({ ...options, loadDictionary: async () => ({ feature: { hello: 42 } }) });
  await assert.rejects(malformed.loadLanguage(), /Expected a string/);
});

test('HTTP loader builds configurable paths, forwards options and checks HTTP and payload errors', async () => {
  const requestInit = { credentials: 'include' };
  const calls = [];
  const load = createFetchDictionaryLoader({
    baseUrl: '/app/i18n/',
    requestInit,
    fetch: async (...args) => {
      calls.push(args);
      return new Response(JSON.stringify({ feature: messages.en }));
    },
  });
  assert.deepEqual(await load('pt-BR'), { feature: messages.en });
  assert.deepEqual(calls, [['/app/i18n/pt-BR.json', requestInit]]);
  await assert.rejects(
    createFetchDictionaryLoader({ fetch: async () => new Response('', { status: 404 }) })('en'),
    /HTTP 404/,
  );
  await assert.rejects(
    createFetchDictionaryLoader({ fetch: async () => new Response('[]') })('en'),
    /dictionary object/,
  );
});

test('CommonJS core and React entry points work, and deprecated exports are absent', () => {
  const require = createRequire(import.meta.url);
  const core = require('i18n-json-react/core');
  const react = require('i18n-json-react');
  const store = core.createI18nStore(options);
  assert.equal(store.createTypoGetter(messages)('buttons.save'), 'Save');
  assert.equal(typeof react.createI18n, 'function');
  assert.equal('createUseTypoHook' in react.createI18n(options), false);
});
