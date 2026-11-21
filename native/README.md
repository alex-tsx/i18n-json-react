# Android and iOS / React Native

Android and iOS use the same feature-local `i18n.json` and `*.i18n.json` files, React helpers, and type registration as the PWA. Keep translated source beside shared features; only platform startup and bundler setup differ.

The integration targets Metro and provides an Expo SDK 54+ asset reader. It also exposes a reader callback for other React Native setups. It contains no custom Kotlin/Swift module or build plugin.

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

Each feature import resolves to a tiny `{ __id }` module. Language text lives in separate data assets, outside the main JavaScript/Hermes bundle. The manifest contains lazy, static `require` calls so Metro includes the files in the Android/iOS asset graph without reading their text into JavaScript on startup.

The runtime reads and parses only the fallback and selected locale. Switching to another language reads that locale on demand. The existing I18N resource cache deduplicates concurrent loads and retains previously loaded locales; retry and Suspense behavior are unchanged.

All generated languages are packaged by default, providing offline availability. They still contribute to application size. The `languages` build option can restrict the app binary to a smaller set. To keep additional locales outside the app binary entirely, host the generated language files and use a network loader with an application-owned offline cache instead.

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
const { withI18nMetro } = require('i18n-json-react/native/metro');

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

In the shared native startup module:

```ts
// native/i18n.ts
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

Load this setup before rendering translated content. You can await `I18N.loadLanguage()` before showing the app, or put translated UI and `LoaderForI18N` inside a `Suspense` boundary with an error boundary for I/O failures. The generated manifest's declarations preserve its exact locale names for the loader type.

The same Metro configuration and startup code work for both `android` and `ios`. Platform entry points under `/native/android` and `/native/ios` are also available; they delegate to this shared implementation. Existing Android imports and CLI commands continue to work.

The Expo adapter calls `Asset.fromModule` only for a requested locale, resolves a local asset with `downloadAsync` when necessary, then uses `File.text()` to read it. In an Android or iOS release build this resolves the bundled resource locally; in development Expo may obtain the requested asset from Metro. It does not load every language via `Asset.loadAsync`. See [Expo Asset](https://docs.expo.dev/versions/latest/sdk/asset/) and [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/).

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

## Shared PWA / Android / iOS source

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

PWA files remain ordinary emitted JSON at `i18n/<locale>.json`; Android and iOS use bundled data assets. No translation source files need to be duplicated or moved. If the PWA must work offline, include its emitted language files in the application's service-worker caching strategy too.

For iOS release builds, the usual React Native/Expo Xcode bundle phase includes the statically required `.i18npack` files as app resources. Keep that asset-copying phase enabled, and run it again when shared translations change. A custom asset-selection or OTA update configuration must include the generated packs as well. The [iOS guide](ios/README.md) covers platform setup and release checks.

This package change does not migrate Health Ledger or modify its platform configuration. Its existing native shared-source Gradle inputs can continue to trigger rebundling when `src/` changes. Other bare Gradle projects should ensure shared source directories are inputs to the JavaScript bundle task.

## Preparation, development, and CI

`withI18nMetro` regenerates the packs every time Metro configuration loads, including production bundling. The first version intentionally performs preparation at startup rather than maintaining a second file watcher alongside Metro.

**Restart Metro after editing, adding, or removing translation JSON.** A regular app reload alone does not rerun preparation. If a changed or uncollected source is resolved during a session, the helper reports an actionable restart/collection error instead of bundling all its languages inline. Other source-code Fast Refresh behavior is unchanged; this restriction is specific to translation preparation.

For a fresh checkout, prepare the generated manifest before running a standalone native type check:

```sh
# Run from the native/ application directory.
npx i18n-json-react-native --root .. --dir src --dir native \
  --exclude 'native/android/**' --exclude 'native/ios/**' \
  --exclude 'native/dist/**' --exclude 'native/.expo/**'
```

Alternatively call `prepareNativeI18n` from a build script. The CLI supports `--project-root`, `--root`, `--out`, repeated `--dir` / `--exclude`, and repeated `--language` options. Use the same options as Metro.

### Build options

| Option        | Default / meaning                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `root`        | Metro project root; absolute or relative to `projectRoot`; shared ID/source root                                                  |
| `dirs`        | `['.']`; directories/globs relative to `root`                                                                                     |
| `exclude`     | File/directory globs relative to `root`                                                                                           |
| `languages`   | All locales found in the collected files; an optional nonempty subset for the build                                               |
| `outputDir`   | `.i18n-json-react`; dedicated generated folder, relative to Metro project root or absolute                                        |
| `projectRoot` | For `prepareNativeI18n` / CLI only; defaults to the current directory; inferred from the provided Metro config by `withI18nMetro` |

Include the runtime fallback in `languages` when filtering. The runtime loader rejects a locale absent from the manifest. The generated directory is marked as package-owned; preparation refuses to overwrite a nonempty unmarked directory and only removes recognized stale generated files.

## Other React Native asset readers

The generic adapter has no Expo dependency:

```ts
import { createNativeDictionaryLoader } from 'i18n-json-react/native';

const loadDictionary = createNativeDictionaryLoader(assets, {
  readAssetText: async moduleId => nativeAssetReader.readUtf8(moduleId),
});
```

Your reader must resolve a Metro asset module ID to UTF-8 text on the native platform, handling bundled resources and development-server assets as appropriate. Only the Expo adapter entry points entry imports Expo modules. The package root, `/core`, and web build plugins do not import them.

## Verification

Tests generate shared-workspace assets and build actual minified Android and iOS Metro bundles. They check that language text is absent from JavaScript, assets remain discoverable for packaging, provider calls are lazy, and only selected/fallback files are read. The loader, Expo adapter contract, caching/retry behavior, CLI, safe regeneration, and TypeScript exports are covered.

To also execute the generated production bundle in an available Hermes CLI, set `I18N_JSON_REACT_HERMES=/absolute/path/to/hermes` when running tests. This was checked against the Hermes binary installed with React Native 0.81.5. An installed Android/iOS app test is still required when integrating into an application; these package tests do not claim to run native modules on a device.

## Android widgets, notifications, and native views

Kotlin/Java code that runs without JavaScript uses `R.string` resources. The Metro
language packs above serve React translations; Android XML resource export is an
optional, separate build-time integration. It has no runtime dependencies and works
with both inline dictionaries and Metro extraction, using the global or isolated API.

Create one declarative config, for example `native/i18n.resources.json`:

```json
{
  "root": "..",
  "defaultLanguage": "EN",
  "languages": ["EN", "UK"],
  "resources": [
    {
      "outputDir": "native/android/app/src/main/res",
      "dictionaries": ["src/profile/i18n.json", "src/common.i18n.json"],
      "strings": {
        "profile_title": "title",
        "profile_greeting": "nativeGreeting"
      }
    }
  ]
}
```

Dictionary files remain feature-local. Each target searches its `dictionaries` in
order for a message in the requested locale, then uses `defaultLanguage` if that
message is missing. Empty strings stay empty. A missing default translation fails
the build. Resource IDs map to flat message keys; no combined application catalog
is required. Configure additional targets for native modules with their own `res/`
directories. Each target may set a dedicated `fileName` (default
`i18n_json_react.xml`). Do not assign the same target/file to multiple configs.

All paths are relative to `root`; `root` itself is relative to the JSON config file.
Without `root`, use paths relative to that file. No environment files or executable
configuration modules are loaded. An optional `$schema` can point your editor to
`i18n-json-react/native/android/resources.schema.json` in `node_modules`.

For Expo, add this config plugin to the app's plugins list:

```json
[
  "i18n-json-react/native/android/plugin",
  { "config": "./i18n.resources.json" }
]
```

The plugin uses the Expo app's installed `@expo/config-plugins` peer and exports the
resources automatically during Android prebuild, before Gradle compiles them.
`config` is relative to the Expo app directory. Restarting Metro or exporting only a
JavaScript bundle does not rebuild native resources; run prebuild and rebuild
Android after editing these translations. iOS builds do not invoke this plugin.

Bare Android and CI can use the CLI, with no custom generator script:

```sh
npx i18n-json-react-android-resources --config native/i18n.resources.json
```

Or call the dependency-free Node API:

```ts
import { generateAndroidResourcesFromConfig } from 'i18n-json-react/native/android/resources';
await generateAndroidResourcesFromConfig('native/i18n.resources.json');
```

`generateAndroidResources(options)` also accepts the configuration as an object,
plus an optional `projectRoot` base (default: the working directory).

The default language is emitted into `values/`. Uppercase identifiers such as `UK`
automatically become `values-uk`; regional/script tags use Android BCP-47 resource
qualifiers, such as `values-b+pt+BR` or `values-b+sr+Latn+RS`. Set `locales` to map
custom dictionary identifiers, for example `{ "PORT": "pt-BR" }`.
Two identifiers that map to the same Android locale are rejected. The exporter
preserves whitespace and escapes XML and Android string syntax, including quotes,
backslashes, literal resource-reference prefixes, and line breaks. See the official
[Android string resource documentation](https://developer.android.com/guide/topics/resources/string-resource).

Native formatting uses positional Android/Java printf arguments in the dictionary,
for example `"nativeGreeting": "Hello, %1$s"`. Translations can reorder arguments;
argument positions and types are checked against the default translation before
writing files. Strings containing positional arguments are formatted automatically;
other strings are literal (`formatted="false"`), including ordinary percentages.
Override this with `{ "key": "nativeGreeting", "formatted": false }` or explicitly
require formatting with `true`. Formatted strings must use indexed arguments;
`{name}` interpolation is left as text. This exporter does not convert ICU messages,
HTML, plurals, or string arrays.

Output files carry an ownership marker. Regeneration skips unchanged files and
removes only recognized generated files for locales that were removed. Existing
manual resources, unrelated files and directories remain intact; generation refuses
to overwrite an unmarked destination or a symlink. Use a distinct filename when
other tooling also generates resources in the same directory.

Android selects these resources using the native `Context` locale. Changing the
JavaScript I18N language alone does not change Android's locale or refresh widgets;
the application owns native locale synchronization and background component updates.

To verify exported XML with a local Android SDK, set
`I18N_JSON_REACT_AAPT2=/absolute/path/to/aapt2` when running the library tests.
