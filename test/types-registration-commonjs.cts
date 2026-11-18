import i18n = require('i18n-json-react');

i18n.default.configure({ supportedLanguages: ['de', 'fr'], fallbackLanguage: 'de' });
const language: 'de' | 'fr' = i18n.getCurrentLang();
void language;
i18n.createTypoGetter({ de: { hello: 'Hallo' } })('hello');
// @ts-expect-error A CommonJS application declaration constrains language operations.
i18n.setCurrentLang('EN');
// @ts-expect-error A CommonJS application declaration checks imported dictionary variables.
i18n.createTypo({ de: { hello: 'Hallo' }, EN: { hello: 'Hello' } });
// @ts-expect-error A CommonJS application declaration requires the fallback locale entry.
i18n.createTypoGetter({ fr: { hello: 'Bonjour' } });
