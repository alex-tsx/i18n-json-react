# Android / React Native

Android uses the same feature-local `i18n.json` and `*.i18n.json` files, React helpers, and type registration as the PWA. Keep translated source beside shared features; only platform startup and bundler setup differ.

The integration targets Metro and provides an Expo SDK 54+ asset reader. It also exposes a reader callback for other React Native setups. It contains no custom Kotlin module or Gradle plugin.

## How loading works

During Metro configuration, `withI18nMetro` collects the feature JSON and generates:

```text
.i18n-json-react/
  assets/EN.i18npack
  assets/UK.i18npack
  references/<feature-id>.js
  manifest.cjs
  manifest.d.cts
```

Each feature import resolves to a tiny `{ __id }` module. Language text lives in separate data assets, outside the main JavaScript/Hermes bundle. The manifest contains lazy, static `require` calls so Metro includes the files in the Android asset graph without reading their text into JavaScript on startup.

The runtime reads and parses only the fallback and selected locale. Switching to another language reads that locale on demand. The existing I18N resource cache deduplicates concurrent loads and retains previously loaded locales; retry and Suspense behavior are unchanged.

All generated languages are packaged by default, providing offline availability. They still contribute to APK size. The `languages` build option can restrict the APK to a smaller set. To keep additional locales outside the APK entirely, host the generated language files and use a network loader with an application-owned offline cache instead.

This uses Metro's normal asset pipeline. Expo's automatic production code splitting is documented for web; its native production route imports remain synchronous. Separating translation data from JavaScript avoids relying on native code splitting. See [Expo Metro assets and bundle splitting](https://docs.expo.dev/versions/latest/config/metro/) and [Expo async routes caveats](https://docs.expo.dev/router/web/async-routes/).

## Expo setup

Install the optional native dependencies in the Expo app, using Expo to choose SDK-compatible versions:

```sh
npx expo install expo-asset expo-file-system
```

Compose your existing Metro configuration:

```js
// native/metro.config.js
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withI18nMetro } = require('i18n-json-react/native/android/metro');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '..')];

module.exports = withI18nMetro(config, {
  root: '..',
  dirs: ['src', 'native'],
  exclude: ['native/android/**', 'native/ios/**', 'native/dist/**', 'native/.expo/**'],
});
```

Metro accepts the returned promise. The helper preserves your existing transformer, asset plugins, resolver settings, and custom resolver, then adds the generated asset extension and feature-import resolution. Keep your existing monorepo `nodeModulesPaths`, SVG transformer, or other custom configuration before this call.

`projectRoot` is the Expo app folder (`native/` here); `root: '..'` sets the shared workspace as the source and ID root. Generated files default to `native/.i18n-json-react/`. Add that directory to `.gitignore`.

In the Android startup module:

```ts
// native/i18n.ts
import I18N from 'i18n-json-react';
import { createExpoDictionaryLoader } from 'i18n-json-react/native/android/expo';
import assets from './.i18n-json-react/manifest.cjs';

I18N.configure({
  supportedLanguages: ['EN', 'UK'],
  fallbackLanguage: 'UK',
  storage: false,
  loadDictionary: createExpoDictionaryLoader(assets),
});
```

Load this setup before rendering translated content. You can await `I18N.loadLanguage()` before showing the app, or put translated UI and `LoaderForI18N` inside a `Suspense` boundary with an error boundary for I/O failures. The generated manifest's declarations preserve its exact locale names for the loader type.

The Expo adapter calls `Asset.fromModule` only for a requested locale, resolves a local asset with `downloadAsync` when necessary, then uses `File.text()` to read it. In an Android release build this resolves the bundled resource locally; in development Expo may obtain the requested asset from Metro. It does not load every language via `Asset.loadAsync`. See [Expo Asset](https://docs.expo.dev/versions/latest/sdk/asset/) and [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/).

### Device language and saved choices

React Native does not provide browser `localStorage` or reliable `navigator.languages`. Use `storage: false`. For device locale detection, install `expo-localization` and pass its tags explicitly:

```ts
import { getLocales } from 'expo-localization';

// In the same configure call:
getBrowserLanguages: () => getLocales().map(locale => locale.languageTag),
```

To persist choices with AsyncStorage, read the saved string asynchronously during startup, normalize it with `I18N.resolveLanguage`, then call `I18N.setCurrentLang` before rendering/loading. Persist subsequent language changes from a subscription. AsyncStorage cannot be passed as the synchronous `storage` adapter.

```ts
const saved = await AsyncStorage.getItem('ui-language');
const language = saved ? I18N.resolveLanguage(saved) : undefined;
if (language) I18N.setCurrentLang(language);

let previous = I18N.getCurrentLang();
I18N.subscribe(() => {
  const current = I18N.getCurrentLang();
  if (current === previous) return;
  previous = current;
  void AsyncStorage.setItem('ui-language', current).catch(console.error);
});
await I18N.loadLanguage();
```

`EN` / `UK`, regional identifiers, custom interpolation, and `CustomTypeOptions` all work exactly as in the PWA. Case must match the JSON locale keys.

## Shared PWA / Android source

For Health Ledger's layout, the intended setup is:

| Location                     | Responsibility                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `src/features/.../i18n.json` | Shared feature translations                                                               |
| `src/features/.../i18n.ts`   | Shared hooks importing `createUseTypo` from the package                                   |
| `pwa/i18n.ts`                | Browser configuration with `createFetchDictionaryLoader`                                  |
| `native/i18n.ts`             | Native configuration with `createExpoDictionaryLoader`                                    |
| Root `vite.config.ts`        | `i18nJsonPlugin({ root: '..', dirs: ['src', 'pwa'] })` when Vite's project root is `pwa/` |
| `native/metro.config.js`     | `withI18nMetro(config, { root: '..', dirs: ['src', 'native'] })`                          |

Use the **same absolute ID root** (the workspace) for both bundlers. Both integrations use the same collection, validation, and file-ID algorithm. Shared feature code imports neither `pwa/` nor `native/` setup modules. Each platform's entry point initializes its own default I18N instance before rendering.

PWA files remain ordinary emitted JSON at `i18n/<locale>.json`; Android uses bundled data assets. No translation source files need to be duplicated or moved. If the PWA must work offline, include its emitted language files in the application's service-worker caching strategy too.

This package change does not migrate Health Ledger or modify its platform configuration. Its existing native shared-source Gradle inputs can continue to trigger rebundling when `src/` changes. Other bare Gradle projects should ensure shared source directories are inputs to the JavaScript bundle task.

## Preparation, development, and CI

`withI18nMetro` regenerates the packs every time Metro configuration loads, including production bundling. The first version intentionally performs preparation at startup rather than maintaining a second file watcher alongside Metro.

**Restart Metro after editing, adding, or removing translation JSON.** A regular app reload alone does not rerun preparation. If a changed or uncollected source is resolved during a session, the helper reports an actionable restart/collection error instead of bundling all its languages inline. Other source-code Fast Refresh behavior is unchanged; this restriction is specific to translation preparation.

For a fresh checkout, prepare the generated manifest before running a standalone native type check:

```sh
# Run from the native/ application directory.
npx i18n-json-react-android --root .. --dir src --dir native \
  --exclude 'native/android/**' --exclude 'native/ios/**' \
  --exclude 'native/dist/**' --exclude 'native/.expo/**'
```

Alternatively call `prepareAndroidI18n` from a build script. The CLI supports `--project-root`, `--root`, `--out`, repeated `--dir` / `--exclude`, and repeated `--language` options. Use the same options as Metro.

### Build options

| Option        | Default / meaning                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `root`        | Metro project root; absolute or relative to `projectRoot`; shared ID/source root                                                   |
| `dirs`        | `['.']`; directories/globs relative to `root`                                                                                      |
| `exclude`     | File/directory globs relative to `root`                                                                                            |
| `languages`   | All locales found in the collected files; an optional nonempty subset for the build                                                |
| `outputDir`   | `.i18n-json-react`; dedicated generated folder, relative to Metro project root or absolute                                         |
| `projectRoot` | For `prepareAndroidI18n` / CLI only; defaults to the current directory; inferred from the provided Metro config by `withI18nMetro` |

Include the runtime fallback in `languages` when filtering. The runtime loader rejects a locale absent from the manifest. The generated directory is marked as package-owned; preparation refuses to overwrite a nonempty unmarked directory and only removes recognized stale generated files.

## Other React Native asset readers

The generic adapter has no Expo dependency:

```ts
import { createAndroidDictionaryLoader } from 'i18n-json-react/native/android';

const loadDictionary = createAndroidDictionaryLoader(assets, {
  readAssetText: async moduleId => nativeAssetReader.readUtf8(moduleId),
});
```

Your reader must resolve a Metro asset module ID to UTF-8 text on the native platform, handling bundled resources and development-server assets as appropriate. Only the `/native/android/expo` entry imports Expo modules. The package root, `/core`, and web build plugins do not import them.

## Verification

Tests generate shared-workspace assets and build an actual minified Android Metro bundle. They check that language text is absent from JavaScript, assets remain discoverable for packaging, provider calls are lazy, and only selected/fallback files are read. The loader, Expo adapter contract, caching/retry behavior, CLI, safe regeneration, and TypeScript exports are covered.

To also execute the generated production bundle in an available Hermes CLI, set `I18N_JSON_REACT_HERMES=/absolute/path/to/hermes` when running tests. This was checked against the Hermes binary installed with React Native 0.81.5. An APK installation/device test is still required when integrating into an application; these package tests do not claim to run Android native modules on a device.
