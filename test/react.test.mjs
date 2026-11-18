import assert from 'node:assert/strict';
import { test } from 'node:test';
import React, { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import { createI18n } from 'i18n-json-react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const messages = {
  en: { hello: 'Hello, {name}', 'buttons.save': 'Save', fallback: 'Fallback' },
  uk: { hello: 'Вітаю, {name}', 'buttons.save': 'Зберегти' },
};
const options = {
  supportedLanguages: ['en', 'uk'],
  fallbackLanguage: 'en',
  storage: false,
  getBrowserLanguages: () => [],
};
const h = React.createElement;

test('hooks update multiple roots, memoize translators, support prefixes, objects and components', async () => {
  const i18n = createI18n(options);
  const useText = i18n.createUseTypo(messages);
  const Text = i18n.createTypo(messages, 'buttons.');
  const translators = new Map();
  function View({ id }) {
    const t = useText();
    const buttons = useText({ keyPrefix: 'buttons.' });
    const object = i18n.useTypoAsObject(messages);
    translators.set(id, t);
    assert.equal(t.t, t);
    return h(
      'p',
      null,
      t('hello', { name: 'A' }),
      '|',
      buttons('save'),
      '|',
      object.fallback,
      '|',
      h(Text, { id: 'save' }),
    );
  }
  let first, second;
  await act(async () => {
    first = create(h(View, { id: 'first' }));
    second = create(h(View, { id: 'second' }));
  });
  const stable = translators.get('first');
  await act(async () => first.update(h(View, { id: 'first' })));
  assert.equal(translators.get('first'), stable);
  assert.equal(first.toJSON().children.join(''), 'Hello, A|Save|Fallback|Save');
  await act(async () => i18n.setCurrentLang('uk'));
  assert.notEqual(translators.get('first'), stable);
  assert.deepEqual(first.toJSON(), second.toJSON());
  assert.equal(first.toJSON().children.join(''), 'Вітаю, A|Зберегти|Fallback|Зберегти');
  await act(async () => {
    first.unmount();
    second.unmount();
  });
});

test('changing inline dictionaries or options does not leave stale translations', async () => {
  const i18n = createI18n(options);
  const useText = i18n.createUseTypo(messages);
  function View({ dictionary, prefix, placehold }) {
    const t = useText({ keyPrefix: prefix, placehold });
    const object = i18n.useTypoAsObject(dictionary);
    return h('p', null, t('save'), '|', object.title);
  }
  let root;
  await act(async () => {
    root = create(h(View, { dictionary: { en: { title: 'First' } }, prefix: 'buttons.' }));
  });
  assert.equal(root.toJSON().children.join(''), 'Save|First');
  await act(async () =>
    root.update(h(View, { dictionary: { en: { title: 'Second' } }, prefix: '', placehold: false })),
  );
  assert.equal(root.toJSON().children.join(''), '|Second');
  await act(async () => root.unmount());
});

test('extracted hooks suspend automatically and share cached language files with the loader', async () => {
  const pending = new Map();
  const calls = [];
  const i18n = createI18n({
    ...options,
    initialLanguage: 'uk',
    loadDictionary: language => {
      calls.push(language);
      return new Promise(resolve => pending.set(language, resolve));
    },
  });
  const useText = i18n.createUseTypo({ __id: 'feature' });
  function View() {
    return h('p', null, useText()('buttons.save'));
  }
  let root;
  await act(async () => {
    root = create(h(Suspense, { fallback: 'Loading' }, h(i18n.LoaderForI18N), h(View)));
  });
  assert.equal(root.toJSON(), 'Loading');
  assert.deepEqual(calls, ['en', 'uk']);
  await act(async () => {
    pending.get('en')({ feature: messages.en });
    pending.get('uk')({ feature: messages.uk });
    await i18n.loadLanguage();
  });
  assert.equal(root.toJSON().children.join(''), 'Зберегти');
  await act(async () => i18n.setCurrentLang('en'));
  assert.equal(root.toJSON().children.join(''), 'Save');
  assert.deepEqual(calls, ['en', 'uk']);
  await act(async () => root.unmount());
});

test('SSR uses a stable language snapshot and supports preloaded extracted dictionaries', () => {
  const first = createI18n({
    ...options,
    initialLanguage: 'uk',
    dictionaries: { en: { feature: messages.en }, uk: { feature: messages.uk } },
  });
  const second = createI18n(options);
  const useFirst = first.createUseTypo({ __id: 'feature' });
  const useSecond = second.createUseTypo(messages);
  function First() {
    return useFirst()('buttons.save');
  }
  function Second() {
    return useSecond()('buttons.save');
  }
  assert.equal(renderToString(h(First)), 'Зберегти');
  assert.equal(renderToString(h(Second)), 'Save');
});
