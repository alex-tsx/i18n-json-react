import I18N, {
  configure,
  createI18n,
  createTypo,
  createTypoGetter,
  createUseTypo,
  interpolateTypo,
  useTypoAsObject,
  type DictionaryReference,
  type InterpolationDelimiters,
} from 'i18n-json-react';
import { createI18nStore, interpolateTypo as interpolateCore } from 'i18n-json-react/core';
import { I18nCollectPlugin, i18nLoaderRule } from 'i18n-json-react/webpack';
import { i18nJsonPlugin, type I18nViteOptions } from 'i18n-json-react/vite';
import type { Plugin } from 'vite';
import { createAndroidDictionaryLoader, type AndroidLanguageAssets } from 'i18n-json-react/native/android';
import { createExpoDictionaryLoader } from 'i18n-json-react/native/android/expo';
import { prepareAndroidI18n, withI18nMetro } from 'i18n-json-react/native/android/metro';
import type { ConfigT } from 'metro-config';
import { createNativeDictionaryLoader, type NativeLanguageAssets } from 'i18n-json-react/native';
import { createIOSDictionaryLoader, type IOSLanguageAssets } from 'i18n-json-react/native/ios';
import { createExpoDictionaryLoader as createIOSExpoLoader } from 'i18n-json-react/native/ios/expo';
import { createExpoDictionaryLoader as createNativeExpoLoader } from 'i18n-json-react/native/expo';
import { prepareNativeI18n, withI18nMetro as withNativeMetro } from 'i18n-json-react/native/metro';
import { prepareIOSI18n, withI18nMetro as withIOSMetro } from 'i18n-json-react/native/ios/metro';
import messages from './messages.json' with { type: 'json' };

const i18n = createI18n({ supportedLanguages: ['en', 'uk', 'pt-BR'], fallbackLanguage: 'en' });
I18N.configure({
  supportedLanguages: ['EN', 'UK'],
  fallbackLanguage: 'UK',
  interpolation: { prefix: '${', suffix: '}' },
  loadDictionary: async language => {
    const supported: 'EN' | 'UK' = language;
    void supported;
    return {};
  },
});
configure({ supportedLanguages: ['en', 'uk'], fallbackLanguage: 'en' });
// @ts-expect-error The default instance also validates the configured fallback type.
I18N.configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'FR' });
// @ts-expect-error The initial language must be supported.
configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'UK', initialLanguage: 'FR' });
const useDefault = createUseTypo(messages);
useDefault()('hello', { name: 'Alex' });
useDefault({ keyPrefix: 'buttons.' })('save');
createTypoGetter(messages)('onlyUk');
createTypo(messages, 'buttons.')({ id: 'save' });
const defaultText: string | undefined = useTypoAsObject(messages).hello;
void defaultText;
// @ts-expect-error Default hooks retain translation key inference.
useDefault()('missing');
// @ts-expect-error Default components retain prefix inference.
createTypo(messages, 'buttons.')({ id: 'hello' });
// @ts-expect-error Default getters retain translation key inference.
createTypoGetter(messages)('missing');
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
const unsupportedMessages = { en: { hello: 'Hello' }, fr: { hello: 'Bonjour' } };
// @ts-expect-error Isolated instances reject unsupported dictionary locales, including variables.
i18n.createTypo(unsupportedMessages);
// @ts-expect-error Isolated hook factories reject unsupported locales.
i18n.createUseTypo(unsupportedMessages);
// @ts-expect-error Isolated getters reject unsupported locales.
i18n.createTypoGetter(unsupportedMessages);
// @ts-expect-error Isolated object hooks reject unsupported locales.
i18n.useTypoAsObject(unsupportedMessages);
const coreInstance = createI18nStore({ supportedLanguages: ['en', 'uk'], fallbackLanguage: 'en' });
// @ts-expect-error React-independent dictionaries use their store's language union.
coreInstance.createTypoGetter(unsupportedMessages);
coreInstance.createTypoGetter({ en: { hello: 'Hello' } })('hello');
const ref: DictionaryReference<'hello'> = { __id: 'test' };
i18n.createTypoGetter(ref)('hello');
// @ts-expect-error Custom loader references preserve keys.
i18n.createTypoGetter(ref)('bad');
createI18nStore({ supportedLanguages: ['en'], fallbackLanguage: 'en' });
const interpolation: InterpolationDelimiters = { prefix: '{{', suffix: '}}' };
const custom = createI18n({ supportedLanguages: ['en'], fallbackLanguage: 'en', interpolation });
custom.interpolateTypo('Hello, {{name}}', { name: 'Alex' });
createI18nStore({ supportedLanguages: ['en'], fallbackLanguage: 'en', interpolation });
interpolateTypo('Hello, {{name}}', { name: 'Alex' }, interpolation);
interpolateCore('Hello, {{name}}', { name: 'Alex' }, interpolation);
// @ts-expect-error Custom delimiters must include both sides.
createI18n({ supportedLanguages: ['en'], fallbackLanguage: 'en', interpolation: { prefix: '{{' } });
// @ts-expect-error Delimiters must be strings.
interpolateTypo('Hello', {}, { prefix: 1, suffix: '}' });
new I18nCollectPlugin({ dirs: ['.'], outputDir: 'assets/i18n' });
i18nLoaderRule();
const viteOptions: I18nViteOptions = { root: '.', dirs: ['.'], exclude: ['scripts/**'], outputDir: 'locales' };
const vitePlugin: Plugin = i18nJsonPlugin(viteOptions);
void vitePlugin;
// @ts-expect-error Invalid Vite option type.
i18nJsonPlugin({ dirs: 'src' });
// @ts-expect-error Deprecated proxy API is deliberately absent.
i18n.createUseTypoHook(messages);

const assets: AndroidLanguageAssets<'EN' | 'UK'> = { EN: () => 1, UK: () => 2 };
const iosAssets: IOSLanguageAssets<'EN' | 'UK'> = assets;
const sharedAssets: NativeLanguageAssets<'EN' | 'UK'> = iosAssets;
const iosLoader = createIOSDictionaryLoader(iosAssets, { readAssetText: async () => '{}' });
createNativeDictionaryLoader(sharedAssets, { readAssetText: async () => '{}' })('EN');
createIOSExpoLoader(iosAssets)('UK');
createNativeExpoLoader(sharedAssets)('EN');
createI18n({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'UK', loadDictionary: iosLoader });
// @ts-expect-error iOS loader preserves exact manifest language keys.
iosLoader('FR');
// @ts-expect-error iOS loaders require a native reader just like the shared adapter.
createIOSDictionaryLoader(iosAssets);
const nativeLoader = createAndroidDictionaryLoader(assets, { readAssetText: async () => '{}' });
nativeLoader('EN');
createExpoDictionaryLoader(assets)('UK');
createI18n({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'UK', loadDictionary: nativeLoader });
// @ts-expect-error Native loader only accepts languages in the generated manifest.
nativeLoader('FR');
// @ts-expect-error The generic adapter needs a native asset reader.
createAndroidDictionaryLoader(assets);
// @ts-expect-error The loader must support every configured language.
createI18n({ supportedLanguages: ['EN', 'UK', 'FR'], fallbackLanguage: 'UK', loadDictionary: nativeLoader });
prepareAndroidI18n({ projectRoot: 'native', root: '..', dirs: ['src', 'native'], languages: ['EN', 'UK'] });
prepareNativeI18n({ projectRoot: 'native', root: '..', dirs: ['src', 'native'] });
prepareIOSI18n({ projectRoot: 'native', root: '..', dirs: ['src', 'native'] });
function checkMetro(config: ConfigT) {
  withNativeMetro(config, { root: '..' });
  withIOSMetro(config, { root: '..' });
  return withI18nMetro(config, { root: '..', dirs: ['src', 'native'] });
}
void checkMetro;
