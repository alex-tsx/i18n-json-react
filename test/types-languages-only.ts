import I18N, { createTypo, createTypoGetter, createUseTypo } from 'i18n-json-react';

I18N.configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'EN' });
// No fallback declaration: a feature can contain any subset of the supported locales.
createTypo({ EN: { hello: 'Hello' } });
createTypo({ UK: { hello: 'Вітаю' } });
createUseTypo({ EN: { hello: 'Hello' } })()('hello');
// @ts-expect-error Language checking still applies without a declared fallback.
createTypoGetter({ FR: { hello: 'Bonjour' } });
