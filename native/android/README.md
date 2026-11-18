# Android / React Native

Android and iOS now use the [shared native integration](../README.md). One Metro configuration and native startup module work for both platforms, using the same feature-local JSON files as the PWA.

Existing Android imports and commands remain supported:

- `i18n-json-react/native/android/metro`: `withI18nMetro`, `prepareAndroidI18n`.
- `i18n-json-react/native/android/expo`: `createExpoDictionaryLoader`.
- `i18n-json-react/native/android`: `createAndroidDictionaryLoader`, `AndroidLanguageAssets`, `AndroidDictionaryLoaderOptions`.
- `i18n-json-react-android`: preparation CLI.

For new shared setup code, use `/native/metro`, `/native/expo`, and `i18n-json-react-native`. The platform-specific entry points delegate to that implementation.

Language text remains outside JavaScript in separate offline data assets. Only fallback and selected locale assets are read initially; a build language filter can reduce APK size. Restart Metro after translation JSON changes. See the shared guide for the complete setup, native storage and locale options, Health Ledger source layout, and release verification limits.
