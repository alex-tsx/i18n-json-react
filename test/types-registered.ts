import I18N, {
  configure,
  createI18n,
  createTypo,
  createTypoGetter,
  createUseTypo,
  getCurrentLang,
  loadLanguage,
  setCurrentLang,
  useI18nLanguage,
  useTypoAsObject,
  type DictionaryReference,
  type SupportedLanguage,
} from 'i18n-json-react';
import { createI18nStore } from 'i18n-json-react/core';
import messages from './registered-messages.json' with { type: 'json' };
import unsupported from './unsupported-messages.json' with { type: 'json' };
import missingFallback from './missing-fallback.json' with { type: 'json' };
import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from './app-languages.js';

I18N.configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'UK' });
I18N.configure({ supportedLanguages: SUPPORTED_LANGUAGES, fallbackLanguage: FALLBACK_LANGUAGE });
configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'UK' });
// @ts-expect-error Unsupported configured language.
I18N.configure({ supportedLanguages: ['EN', 'UK', 'FR'], fallbackLanguage: 'UK' });
// @ts-expect-error Runtime fallback must agree with the application declaration.
I18N.configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'EN' });
// @ts-expect-error The runtime language set must include all registered languages.
I18N.configure({ supportedLanguages: ['UK'], fallbackLanguage: 'UK' });

const language: SupportedLanguage = getCurrentLang();
const hookLanguage: 'EN' | 'UK' = useI18nLanguage();
void language;
void hookLanguage;
setCurrentLang('EN');
loadLanguage('UK');
// @ts-expect-error Global language choices use the declaration.
setCurrentLang('FR');
// @ts-expect-error Global language loading uses the declaration.
loadLanguage('FR');

const Text = createTypo(messages, 'buttons.');
Text({ id: 'save' });
const t = createUseTypo(messages)();
t('hello', { name: 'Alex' });
t('fallback');
const buttons = createUseTypo(messages)({ keyPrefix: 'buttons.' });
buttons('save');
createTypoGetter(messages, { language: 'EN' })('hello');
const fallback: string | undefined = useTypoAsObject(messages).fallback;
void fallback;
// @ts-expect-error Translation keys remain inferred after locale validation.
t('missing');
// @ts-expect-error Prefix inference remains intact.
buttons('hello');
// @ts-expect-error Component keys remain inferred.
Text({ id: 'missing' });
// @ts-expect-error Object keys remain inferred.
useTypoAsObject(messages).missing;
// @ts-expect-error Fixed locale must be registered.
createTypoGetter(messages, { language: 'FR' });

// @ts-expect-error Unsupported locale in an imported JSON variable.
createTypo(unsupported);
// @ts-expect-error Hooks reject unsupported locales too.
createUseTypo(unsupported);
// @ts-expect-error Getters reject unsupported locales too.
createTypoGetter(unsupported);
// @ts-expect-error Object hooks reject unsupported locales too.
useTypoAsObject(unsupported);
// @ts-expect-error Object getters reject unsupported locales too.
I18N.getTypoAsObject(unsupported);
// @ts-expect-error Registered fallback entry is required.
createTypo(missingFallback);
// @ts-expect-error Hooks require the registered fallback entry.
createUseTypo(missingFallback);
// @ts-expect-error Getters require the registered fallback entry.
createTypoGetter(missingFallback);
// @ts-expect-error Locale spellings match the configured identifiers.
createTypo({ UK: { hello: 'Вітаю' }, en: { hello: 'Hello' } });
createTypo({ UK: { hello: 'Вітаю' } });

const reference: DictionaryReference<'hello'> = { __id: 'feature' };
createUseTypo(reference)()('hello');
// @ts-expect-error Extracted references retain their declared translation keys.
createTypoGetter(reference)('missing');

// Isolated stores use their own configured union, independently of application registration.
const isolated = createI18n({ supportedLanguages: ['de'], fallbackLanguage: 'de' });
isolated.createTypo({ de: { hello: 'Hallo' } });
// @ts-expect-error Isolated feature dictionaries use their instance's languages.
isolated.createTypo({ UK: { hello: 'Вітаю' } });
const core = createI18nStore({ supportedLanguages: ['de'], fallbackLanguage: 'de' });
core.createTypoGetter({ de: { hello: 'Hallo' } })('hello');
// @ts-expect-error Core getter dictionaries use their instance's languages.
core.createTypoGetter(messages);
