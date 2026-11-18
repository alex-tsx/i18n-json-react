import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createI18nStore, interpolateTypo } from 'i18n-json-react/core';

const options = {
  supportedLanguages: ['en', 'uk'],
  fallbackLanguage: 'en',
  storage: false,
  getBrowserLanguages: () => [],
};
const delimiters = [
  { prefix: '{', suffix: '}' },
  { prefix: '{{', suffix: '}}' },
  { prefix: '${', suffix: '}' },
  { prefix: '$${', suffix: '}' },
  { prefix: '"', suffix: '"' },
  { prefix: "'", suffix: "'" },
  { prefix: '`', suffix: '`' },
];

for (const interpolation of delimiters) {
  test(`interpolates ${JSON.stringify(interpolation)} in standalone, inline and extracted translations`, () => {
    const token = key => `${interpolation.prefix}${key}${interpolation.suffix}`;
    const template = `${token('name')}/${token('name')}: ${token('zero')}/${token('missing')}/${token('nil')}/${token('user.name')}/${token('user-id')}/${token('constructor')}`;
    const values = { name: 'A', zero: 0, nil: null, 'user.name': 'B', 'user-id': 'C' };
    const expected = 'A/A: 0///B/C/';
    const messages = { en: { hello: template } };
    const inline = createI18nStore({ ...options, interpolation });
    const extracted = createI18nStore({ ...options, interpolation, dictionaries: { en: { feature: messages.en } } });
    assert.equal(interpolateTypo(template, values, interpolation), expected);
    assert.equal(inline.interpolateTypo(template, values), expected);
    assert.equal(inline.createTypoGetter(messages)('hello', values), expected);
    assert.equal(extracted.createTypoGetter({ __id: 'feature' })('hello', values), expected);
    // A compiled global matcher must also work on consecutive calls.
    assert.equal(inline.interpolateTypo(template, values), expected);
    assert.equal(inline.createTypoGetter(messages)('hello'), template);
  });
}

test('custom delimiters are literal, including regex metacharacters and backslashes', () => {
  const interpolation = { prefix: '.*+?^${}()|[\\', suffix: ']\\$' };
  const token = `${interpolation.prefix}name${interpolation.suffix}`;
  const template = `${token} ${token} {name}`;
  assert.equal(interpolateTypo(template, { name: '$&$1$$' }, interpolation), '$&$1$$ $&$1$$ {name}');
  assert.equal(interpolateTypo('.name..name.', { name: 'A' }, { prefix: '.', suffix: '.' }), 'AA');
  assert.equal(interpolateTypo('startnameendstartnameend', { name: 'A' }, { prefix: 'start', suffix: 'end' }), 'AA');
});

test('instance delimiters are isolated, snapshotted and default to braces', () => {
  const interpolation = { prefix: '{{', suffix: '}}' };
  const custom = createI18nStore({ ...options, interpolation });
  const defaultInstance = createI18nStore(options);
  interpolation.prefix = '${';
  assert.equal(custom.interpolateTypo('{{name}} {name}', { name: 'A' }), 'A {name}');
  assert.equal(defaultInstance.interpolateTypo('{name}', { name: 'B' }), 'B');
  assert.equal(interpolateTypo('{name}', { name: 'C' }), 'C');
  assert.equal(custom.interpolateTypo('{{name}}', Object.create({ name: 'Inherited' })), '');
});

test('custom delimiters apply to fallback messages and fixed-language getters', () => {
  const store = createI18nStore({ ...options, initialLanguage: 'uk', interpolation: { prefix: '${', suffix: '}' } });
  const messages = { en: { hello: 'Hello, ${name}', fallback: 'Fallback ${name}' }, uk: { hello: 'Вітаю, ${name}' } };
  const t = store.createTypoGetter(messages);
  assert.equal(t('hello', { name: 'A' }), 'Вітаю, A');
  assert.equal(t('fallback', { name: 'A' }), 'Fallback A');
  assert.equal(store.createTypoGetter(messages, { language: 'en' })('hello', { name: 'B' }), 'Hello, B');
});

test('invalid or empty delimiters fail at configuration time', () => {
  for (const interpolation of [
    { prefix: '', suffix: '}' },
    { prefix: '{', suffix: '' },
    { prefix: 1, suffix: '}' },
    { prefix: '{' },
  ]) {
    assert.throws(() => createI18nStore({ ...options, interpolation }), /nonempty strings/);
    assert.throws(() => interpolateTypo('Hello', {}, interpolation), /nonempty strings/);
  }
});
