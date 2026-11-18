import { createI18n, type DictionaryReference } from 'i18n-json-react';
import { createI18nStore } from 'i18n-json-react/core';
import { I18nCollectPlugin, i18nLoaderRule } from 'i18n-json-react/webpack';
import { i18nJsonPlugin, type I18nViteOptions } from 'i18n-json-react/vite';
import type { Plugin } from 'vite';
import messages from './messages.json' with { type: 'json' };

const i18n = createI18n({ supportedLanguages: ['en', 'uk', 'pt-BR'], fallbackLanguage: 'en' });
i18n.setCurrentLang('pt-BR');
// @ts-expect-error Unsupported locale must not widen the supported language union.
i18n.setCurrentLang('fr');
// @ts-expect-error The fallback must belong to supportedLanguages.
createI18n({ supportedLanguages: ['en', 'uk'], fallbackLanguage: 'fr' });
// @ts-expect-error The initial language must belong to supportedLanguages.
createI18n({ supportedLanguages: ['en', 'uk'], fallbackLanguage: 'en', initialLanguage: 'fr' });

const getText = i18n.createTypoGetter(messages);
getText('hello', { name: 'Alex' });
getText('onlyUk');
// @ts-expect-error Unknown translation key.
getText('missing');
// @ts-expect-error Unsupported fixed locale.
i18n.createTypoGetter(messages, { language: 'fr' });

const useText = i18n.createUseTypo(messages);
const t = useText();
t('hello');
t.t('hello');
// @ts-expect-error Unknown translation key.
t('missing');
const buttons = useText({ keyPrefix: 'buttons.' });
buttons('save');
buttons.t('save');
// @ts-expect-error Prefix is removed from callable keys.
buttons('buttons.save');
// @ts-expect-error A prefix restricts keys.
buttons('hello');
const object = i18n.useTypoAsObject(messages);
const text: string | undefined = object.onlyUk;
void text;
// @ts-expect-error Unknown object key.
object.missing;

const Text = i18n.createTypo(messages, 'buttons.');
Text({ id: 'save' });
// @ts-expect-error Component keys respect prefixes.
Text({ id: 'hello' });
const ref: DictionaryReference<'hello'> = { __id: 'test' };
i18n.createTypoGetter(ref)('hello');
// @ts-expect-error Custom loader references preserve keys.
i18n.createTypoGetter(ref)('bad');
createI18nStore({ supportedLanguages: ['en'], fallbackLanguage: 'en' });
new I18nCollectPlugin({ dirs: ['.'], outputDir: 'assets/i18n' });
i18nLoaderRule();
const viteOptions: I18nViteOptions = { root: '.', dirs: ['.'], exclude: ['scripts/**'], outputDir: 'locales' };
const vitePlugin: Plugin = i18nJsonPlugin(viteOptions);
void vitePlugin;
// @ts-expect-error Invalid Vite option type.
i18nJsonPlugin({ dirs: 'src' });
// @ts-expect-error Deprecated proxy API is deliberately absent.
i18n.createUseTypoHook(messages);
