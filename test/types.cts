import i18n = require('i18n-json-react');
import core = require('i18n-json-react/core');
import webpack = require('i18n-json-react/webpack');
import vite = require('i18n-json-react/vite');
import native = require('i18n-json-react/native/android');
import expo = require('i18n-json-react/native/android/expo');
import sharedNative = require('i18n-json-react/native');
import ios = require('i18n-json-react/native/ios');
import iosExpo = require('i18n-json-react/native/ios/expo');
import sharedExpo = require('i18n-json-react/native/expo');

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
native.createAndroidDictionaryLoader({ UK: () => 1 }, { readAssetText: async () => '{}' })('UK');
expo.createExpoDictionaryLoader({ UK: () => 1 })('UK');
sharedNative.createNativeDictionaryLoader({ UK: () => 1 }, { readAssetText: async () => '{}' })('UK');
ios.createIOSDictionaryLoader({ UK: () => 1 }, { readAssetText: async () => '{}' })('UK');
iosExpo.createExpoDictionaryLoader({ UK: () => 1 })('UK');
sharedExpo.createExpoDictionaryLoader({ UK: () => 1 })('UK');
import androidResources = require('i18n-json-react/native/android/resources');
import withAndroidResources = require('i18n-json-react/native/android/plugin');
androidResources.generateAndroidResources({defaultLanguage: 'EN', resources: [{outputDir: 'res', dictionaries: ['i18n.json'], strings: {hello: 'hello'}}]});
withAndroidResources({name: 'Example', slug: 'example'}, {config: './i18n.resources.json'});
