import i18n = require('i18n-json-react');
import core = require('i18n-json-react/core');
import webpack = require('i18n-json-react/webpack');
import vite = require('i18n-json-react/vite');

const instance = i18n.createI18n({ supportedLanguages: ['en'], fallbackLanguage: 'en' });
i18n.default.configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'UK' });
i18n.configure({ supportedLanguages: ['en'], fallbackLanguage: 'en' });
i18n.createTypoGetter({ en: { hello: 'Hello' } })('hello');
i18n.createTypo({ en: { hello: 'Hello' } })({ id: 'hello' });
instance.createTypoGetter({ en: { hello: 'Hello' } })('hello');
core.createI18nStore({ supportedLanguages: ['en'], fallbackLanguage: 'en' });
const configured = core.createI18nStore({
  supportedLanguages: ['en'],
  fallbackLanguage: 'en',
  interpolation: { prefix: '${', suffix: '}' },
});
configured.interpolateTypo('Hello, ${name}', { name: 'Alex' });
i18n.interpolateTypo('Hello, {{name}}', { name: 'Alex' }, { prefix: '{{', suffix: '}}' });
webpack.i18nLoaderRule();
vite.i18nJsonPlugin();
