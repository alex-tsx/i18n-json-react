import i18n = require('i18n-json-react');
import core = require('i18n-json-react/core');

const messages = { UK: { hello: 'Вітаю' }, EN: { hello: 'Hello' } };
i18n.default.configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'UK' });
const language: 'EN' | 'UK' = i18n.getCurrentLang();
void language;
i18n.createTypoGetter(messages)('hello');
// @ts-expect-error The same application registration applies to CommonJS.
i18n.setCurrentLang('FR');
// @ts-expect-error CommonJS imports also validate JSON locale keys.
i18n.createTypo({ UK: { hello: 'Вітаю' }, FR: { hello: 'Bonjour' } });
// @ts-expect-error CommonJS imports also require the fallback entry.
i18n.createTypoGetter({ EN: { hello: 'Hello' } });
// @ts-expect-error The runtime fallback agrees with registration in both module formats.
i18n.configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'EN' });
const isolated = core.createI18nStore({ supportedLanguages: ['de'], fallbackLanguage: 'de' });
isolated.createTypoGetter({ de: { hello: 'Hallo' } })('hello');
