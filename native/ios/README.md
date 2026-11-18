# iOS / React Native

iOS uses the [shared native integration](../README.md). The same Metro configuration, generated manifest, `I18N.configure` call, and feature-local JSON files serve Android and iOS. Translations stay in separate `.i18npack` resources; only the fallback and selected locale are read and parsed initially.

The recommended entry points for an app targeting both platforms are:

```js
// native/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withI18nMetro } = require('i18n-json-react/native/metro');

module.exports = withI18nMetro(getDefaultConfig(__dirname), {
  root: '..',
  dirs: ['src', 'native'],
  exclude: ['native/android/**', 'native/ios/**', 'native/dist/**', 'native/.expo/**'],
});
```

Keep any existing monorepo resolver/transformer settings before wrapping the configuration. `root` must match the PWA's ID root. See the shared guide for full startup, device locale, AsyncStorage, and type-checking examples.

```ts
// native/i18n.ts — used by both Android and iOS
import I18N from 'i18n-json-react';
import { createExpoDictionaryLoader } from 'i18n-json-react/native/expo';
import assets from './.i18n-json-react/manifest.cjs';

I18N.configure({
  supportedLanguages: ['EN', 'UK'],
  fallbackLanguage: 'UK',
  storage: false,
  loadDictionary: createExpoDictionaryLoader(assets),
});
```

Install `expo-asset` and `expo-file-system` using `npx expo install`, then rebuild the native application if those modules are new. In a bare React Native project using Expo modules, follow Expo's normal native installation/autolinking steps, including CocoaPods. There is no package-specific Pod, Swift module, or `Info.plist` change.

The Expo reader accepts local iOS app-bundle URLs through `Asset.localUri`, or resolves an asset using `downloadAsync` before reading it with `File.text()`. Production resources are copied by the normal Xcode React Native/Expo bundle phase; development assets may be served by Metro. This follows the standard [React Native non-image asset pipeline](https://reactnative.dev/docs/0.81/images#static-non-image-resources) and [Expo asset loading](https://docs.expo.dev/develop/user-interface/assets/).

All packaged languages remain available offline and contribute to the application size. Use Metro's `languages` option to restrict the packaged set. Keep generated packs in any custom asset-copying, asset-selection, or OTA update configuration. The data packs are app resources, so they do not require one `.lproj` folder per locale.

## Platform-specific entry points

For an iOS-only integration, equivalent entry points are available:

- `i18n-json-react/native/ios/metro`: `withI18nMetro`, `prepareIOSI18n`.
- `i18n-json-react/native/ios/expo`: `createExpoDictionaryLoader`.
- `i18n-json-react/native/ios`: `createIOSDictionaryLoader`, `IOSLanguageAssets`, `IOSDictionaryLoaderOptions` for an injected native asset reader.
- `i18n-json-react-ios`: preparation CLI, with the same options as `i18n-json-react-native`.

Existing Android Metro configurations now extract feature JSON on iOS as well, so they can be kept while adopting the shared entry points. Web requests through Metro remain unchanged; PWA extraction continues to use Vite.

## Development and release verification

Restart Metro after editing, adding, or removing translation JSON. Standalone native type checks can generate the manifest first with `i18n-json-react-native --root .. --dir src --dir native` from the native app directory; use the same exclusions and language filter as Metro.

Package tests build minified iOS and Android Metro bundles and verify matching feature IDs, separate asset graphs, lazy reads, and fallback behavior. Both bundles can also run in Hermes via `I18N_JSON_REACT_HERMES`.

When integrating into an application, verify an installed iOS Release build with Metro stopped and networking disabled: the selected and fallback locales must render, and switching to another packaged locale must work. Xcode signing, an IPA build, and device/simulator execution are application-level checks and are not performed by this package's tests.
