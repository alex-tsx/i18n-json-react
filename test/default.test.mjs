import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React, { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import I18N, {
  configure,
  createI18n,
  createTypo,
  createTypoGetter,
  createUseTypo,
  getCurrentLang,
  interpolateTypo,
  LoaderForI18N,
  loadLanguage,
  resolveLanguage,
  setCurrentLang,
  subscribe,
  useI18nLanguage,
  useTypoAsObject,
} from 'i18n-json-react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const h = React.createElement;
const options = {
  supportedLanguages: ['EN', 'UK'],
  fallbackLanguage: 'UK',
  storage: false,
  getBrowserLanguages: () => [],
};
const messages = {
  EN: { 'greet.hello': 'Hello, ${name}', label: 'English' },
  UK: { 'greet.hello': 'Вітаю, ${name}', label: 'Українська' },
};

// ESM dependencies normally create these factories before the app's configure call runs.
const Text = createTypo(messages, 'greet.');
const useText = createUseTypo(messages);
const getText = createTypoGetter(messages);
const getEnglish = createTypoGetter(messages, { language: 'EN' });

test('feature factories can be created before configuration; reads give a useful setup error', async () => {
  assert.equal(typeof Text, 'object');
  assert.equal(typeof useText, 'function');
  assert.throws(() => getText('label'), /I18N\.configure/);
  assert.throws(getCurrentLang, /I18N\.configure/);
  assert.throws(() => renderToString(h(Text, { id: 'hello' })), /I18N\.configure/);
  await assert.rejects(loadLanguage(), /I18N\.configure/);
});

test('default and named exports share configuration, uppercase languages and interpolation', () => {
  assert.equal(configure, I18N.configure);
  assert.equal(createTypo, I18N.createTypo);
  assert.equal(createUseTypo, I18N.createUseTypo);
  let changes = 0;
  const unsubscribe = subscribe(() => changes++);
  I18N.configure({ ...options, interpolation: { prefix: '${', suffix: '}' }, getBrowserLanguages: () => ['en-US'] });
  assert.deepEqual(I18N.supportedLanguages, ['EN', 'UK']);
  assert.equal(I18N.fallbackLanguage, 'UK');
  assert.equal(resolveLanguage('uk-UA'), 'UK');
  assert.equal(resolveLanguage('en-US'), 'EN');
  assert.equal(getCurrentLang(), 'EN');
  assert.equal(getText('greet.hello', { name: 'A' }), 'Hello, A');
  assert.equal(I18N.interpolateTypo('${name}', { name: 'B' }), 'B');
  assert.equal(interpolateTypo('{name}', { name: 'C' }), 'C');
  setCurrentLang('UK');
  assert.equal(I18N.getCurrentLang(), 'UK');
  assert.equal(getText('greet.hello', { name: 'A' }), 'Вітаю, A');
  assert.equal(getEnglish('greet.hello', { name: 'A' }), 'Hello, A');
  assert.equal(changes, 2);
  unsubscribe();
});

test('existing React roots, components and getters follow reconfiguration even when the language stays the same', async () => {
  const mixed = {
    EN: { 'greet.hello': '${name} / {{name}}', label: 'English' },
    UK: { 'greet.hello': 'UK ${name} / {{name}}', label: 'Українська' },
  };
  const useMixed = createUseTypo(mixed);
  const MixedText = createTypo(mixed, 'greet.');
  const getMixed = createTypoGetter(mixed);
  configure({ ...options, initialLanguage: 'EN', interpolation: { prefix: '${', suffix: '}' } });
  const translators = new Map();
  function View({ id }) {
    const t = useMixed({ keyPrefix: 'greet.' });
    const language = useI18nLanguage();
    const object = useTypoAsObject(mixed);
    translators.set(id, t);
    return h(
      'p',
      null,
      t('hello', { name: 'A' }),
      '|',
      language,
      '|',
      object.label,
      '|',
      h(MixedText, { id: 'hello', values: { name: 'B' } }),
    );
  }
  let first, second;
  try {
    await act(async () => {
      first = create(h(View, { id: 'first' }));
      second = create(h(View, { id: 'second' }));
    });
    const stable = translators.get('first');
    await act(async () => first.update(h(View, { id: 'first' })));
    assert.equal(translators.get('first'), stable);
    assert.equal(first.toJSON().children.join(''), 'A / {{name}}|EN|English|B / {{name}}');
    await act(async () =>
      configure({ ...options, initialLanguage: 'EN', interpolation: { prefix: '{{', suffix: '}}' } }),
    );
    assert.equal(first.toJSON().children.join(''), '${name} / A|EN|English|${name} / B');
    assert.equal(getMixed('greet.hello', { name: 'C' }), '${name} / C');
    assert.notEqual(translators.get('first'), stable);
    await act(async () => setCurrentLang('UK'));
    assert.equal(first.toJSON().children.join(''), 'UK ${name} / A|UK|Українська|UK ${name} / B');
    assert.deepEqual(first.toJSON(), second.toJSON());
  } finally {
    await act(async () => {
      first?.unmount();
      second?.unmount();
    });
  }
});

test('invalid configuration leaves the active store and its subscriptions intact', () => {
  configure({ ...options, initialLanguage: 'EN', interpolation: { prefix: '${', suffix: '}' } });
  let changes = 0;
  const unsubscribe = subscribe(() => changes++);
  assert.throws(() => configure({ ...options, fallbackLanguage: 'FR' }), /must be supported/);
  assert.throws(() => configure({ ...options, interpolation: { prefix: '', suffix: '}' } }), /nonempty strings/);
  assert.equal(changes, 0);
  assert.equal(getCurrentLang(), 'EN');
  assert.equal(getText('greet.hello', { name: 'A' }), 'Hello, A');
  setCurrentLang('UK');
  assert.equal(changes, 1);
  unsubscribe();
});

test('reconfiguration wakes suspended roots and ignores old dictionary completions', async () => {
  let resolveOld;
  configure({
    ...options,
    fallbackLanguage: 'EN',
    initialLanguage: 'EN',
    loadDictionary: () =>
      new Promise(resolve => {
        resolveOld = resolve;
      }),
  });
  const useExtracted = createUseTypo({ __id: 'feature' });
  function View() {
    return h('p', null, useExtracted()('label'));
  }
  let root;
  try {
    await act(async () => {
      root = create(h(Suspense, { fallback: 'Loading' }, h(LoaderForI18N), h(View)));
    });
    assert.equal(root.toJSON(), 'Loading');
    const oldLoad = loadLanguage('EN');
    await act(async () =>
      configure({
        ...options,
        fallbackLanguage: 'EN',
        initialLanguage: 'EN',
        dictionaries: { EN: { feature: { label: 'New dictionary' } } },
      }),
    );
    assert.equal(root.toJSON().children.join(''), 'New dictionary');
    let changes = 0;
    const unsubscribe = subscribe(() => changes++);
    await act(async () => {
      resolveOld({ feature: { label: 'Stale dictionary' } });
      await oldLoad;
    });
    assert.equal(changes, 0);
    assert.equal(root.toJSON().children.join(''), 'New dictionary');
    unsubscribe();
  } finally {
    await act(async () => root?.unmount());
  }
});

test('LoaderForI18N alone suspends for replacement dictionaries with the same language', async () => {
  configure({ ...options, fallbackLanguage: 'EN', initialLanguage: 'EN', dictionaries: { EN: {} } });
  let root, resolveDictionary;
  try {
    await act(async () => {
      root = create(h(Suspense, { fallback: 'Loading' }, h(LoaderForI18N), h('p', null, 'App')));
    });
    assert.equal(root.toJSON().children.join(''), 'App');
    await act(async () =>
      configure({
        ...options,
        fallbackLanguage: 'EN',
        initialLanguage: 'EN',
        loadDictionary: () =>
          new Promise(resolve => {
            resolveDictionary = resolve;
          }),
      }),
    );
    assert.equal(root.toJSON(), 'Loading');
    await act(async () => {
      resolveDictionary({});
      await loadLanguage();
    });
    assert.equal(root.toJSON().children.join(''), 'App');
  } finally {
    await act(async () => root?.unmount());
  }
});

test('factory instances remain isolated from global configuration', () => {
  const isolated = createI18n({ supportedLanguages: ['fr'], fallbackLanguage: 'fr', storage: false });
  configure({ ...options, initialLanguage: 'EN' });
  setCurrentLang('UK');
  assert.equal(isolated.getCurrentLang(), 'fr');
  assert.equal(isolated.createTypoGetter({ fr: { label: 'Français' } })('label'), 'Français');
});

test('CommonJS default and named exports share a configurable instance', () => {
  const common = createRequire(import.meta.url)('i18n-json-react');
  const getter = common.createTypoGetter(messages);
  assert.equal(common.configure, common.default.configure);
  common.default.configure({ ...options, initialLanguage: 'EN', interpolation: { prefix: '${', suffix: '}' } });
  assert.equal(getter('greet.hello', { name: 'A' }), 'Hello, A');
  common.setCurrentLang('UK');
  assert.equal(common.default.getCurrentLang(), 'UK');
  assert.equal(getter('greet.hello', { name: 'A' }), 'Вітаю, A');
});
