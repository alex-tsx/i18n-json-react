import i18n = require('i18n-json-react');
import core = require('i18n-json-react/core');
import webpack = require('i18n-json-react/webpack');

const instance = i18n.createI18n({ supportedLanguages: ['en'], fallbackLanguage: 'en' });
instance.createTypoGetter({ en: { hello: 'Hello' } })('hello');
core.createI18nStore({ supportedLanguages: ['en'], fallbackLanguage: 'en' });
webpack.i18nLoaderRule();
