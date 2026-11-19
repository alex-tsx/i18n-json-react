# i18n-json-react

Feature-local JSON translations with typed keys, React hooks, and optional per-language Vite, Webpack, or Android/iOS Metro assets. No runtime dependencies other than the React peer for the main entry. The `/core` entry works without React; the optional Expo adapter uses native peer modules.

## Install

```sh
npm install i18n-json-react
```

Use React 18.3 or 19. Build tools require Node 22.13 or newer; the declarations require TypeScript 5.4 or newer. Enable TypeScript's `resolveJsonModule` to infer keys from JSON imports.

## Start with inline JSON

Keep translations beside the feature, in `i18n.json` or `*.i18n.json`. Language identifiers are configured by your app; no languages are hard-coded. Keys are flat strings, so dots in keys are literal.

```json
{
  "en": { "hello": "Hello, {name}", "buttons.save": "Save" },
  "uk": { "hello": "Вітаю, {name}", "buttons.save": "Зберегти" },
  "pt-BR": { "hello": "Olá, {name}", "buttons.save": "Salvar" }
}
```

Configure the shared default instance during application startup:

```ts
// i18n.ts
import I18N from 'i18n-json-react';

I18N.configure({
  supportedLanguages: ['en', 'uk', 'pt-BR'],
  fallbackLanguage: 'en',
});
```

```tsx
// profile.tsx
import { memo } from 'react';
import { createUseTypo } from 'i18n-json-react';
import messages from './i18n.json';

const useProfileTypo = createUseTypo(messages);

export const Profile = memo(function Profile() {
  const t = useProfileTypo();
  const buttons = useProfileTypo({ keyPrefix: 'buttons.' });
  return (
    <button>
      {t('hello', { name: 'Alex' })} — {buttons('save')}
    </button>
  );
});
```

Inline imports work in Webpack, Vite, and other bundlers without a plugin, provider, loader component, or Suspense. All imported languages remain in the JavaScript bundle. Create hooks and translation components at module scope, outside render.

The default export and package-level translation helpers share one configuration. `createUseTypo`, `createTypo`, and `createTypoGetter` can run before `configure`, so importing feature modules before startup configuration is safe. Call `configure` before rendering translations or reading language state; otherwise those reads throw a setup error. There are no implicit supported languages. Import your setup module from the application entry point before rendering.

`configure` accepts the same options as `createI18n`. Calling it again replaces the whole configuration, resets language detection and dictionary caches, and updates existing helpers and mounted roots. Include the supported languages and fallback on every call. Invalid options leave the active configuration intact. Use `setCurrentLang` for ordinary language switching.

For independent applications or server requests, create an isolated instance instead:

```ts
import { createI18n } from 'i18n-json-react';

export const i18n = createI18n({
  supportedLanguages: ['en', 'uk'],
  fallbackLanguage: 'en',
});

export const { createUseTypo, createTypo, useI18nLanguage, setCurrentLang } = i18n;
```

Factory-created instances are independent of `I18N.configure`. Their configured language union checks both language operations and feature dictionary locale keys. Package-level helpers can obtain the same checks through an application declaration, described below. Translation keys and prefixes retain their JSON-based types in both APIs.

`t` is callable and supports `const { t } = useProfileTypo()`. Unknown keys fail type checking; a prefix limits keys to the matching suffixes. Missing messages fall back per key to `fallbackLanguage`, then to `i18n(key)`. Pass `{ placehold: false }` to return `''` for missing messages. Empty translations stay empty.

Interpolation replaces `{name}` with string/number values. Missing, `null`, and `undefined` values become empty strings. Values are plain text; render them normally in React. ICU messages, automatic plural rules, nested key traversal, and HTML parsing are outside this package's scope. Use `Intl` for dates and numbers.

### Application-wide TypeScript configuration

Runtime calls to `I18N.configure` cannot change types in other modules. Register the shared instance's language types by augmenting `CustomTypeOptions` in a separate declaration file included by your `tsconfig.json`:

```ts
// src/i18n-types.d.ts
import 'i18n-json-react';

declare module 'i18n-json-react' {
  interface CustomTypeOptions {
    supportedLanguages: 'EN' | 'UK';
    fallbackLanguage: 'UK';
  }
}
```

This checks imported JSON variables at each dictionary-taking helper (`createTypo`, `createUseTypo`, `createTypoGetter`, `useTypoAsObject`, and `getTypoAsObject`). The default export and named helpers use the same declaration in ESM and CommonJS.

```ts
import I18N, { createTypo, setCurrentLang } from 'i18n-json-react';
import messages from './i18n.json';

I18N.configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'UK' });
const Text = createTypo(messages); // Rejects unknown locale keys or a missing UK entry.
setCurrentLang('EN');
setCurrentLang('FR'); // Type error.
```

- `supportedLanguages` is a union of exact JSON locale identifiers. Unknown identifiers, including a casing mismatch, are type errors. Runtime configuration must include the declared language set.
- `fallbackLanguage` is optional in the declaration. When provided, runtime configuration must use that fallback and feature JSON must contain its entry. Other supported locales and individual message keys may remain partial.
- Translation keys and prefixes are still inferred from each JSON import. An opaque `DictionaryReference` preserves its declared keys; it no longer contains locale entries to check.
- Without an application declaration, shared helpers continue to accept arbitrary locale identifiers. Isolated `createI18n` and `/core` stores always check their own configured language union and do not inherit the global declaration.

Keep runtime and type configuration together by deriving the declaration from shared constants:

```ts
// src/i18n-config.ts
export const SUPPORTED_LANGUAGES = ['EN', 'UK'] as const;
export const FALLBACK_LANGUAGE = 'UK';
```

```ts
// src/i18n-types.d.ts
import 'i18n-json-react';
import type { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from './i18n-config.js';

declare module 'i18n-json-react' {
  interface CustomTypeOptions {
    supportedLanguages: (typeof SUPPORTED_LANGUAGES)[number];
    fallbackLanguage: typeof FALLBACK_LANGUAGE;
  }
}
```

Pass those same constants to `I18N.configure({ supportedLanguages: SUPPORTED_LANGUAGES, fallbackLanguage: FALLBACK_LANGUAGE })` during startup. The declaration is type-only and does not perform runtime configuration. Checks occur at the helper call using the original imported JSON; they do not install a JSON editor schema or check files that are never passed to a typed helper.

### Custom interpolation delimiters

Set `interpolation` in `I18N.configure` or when creating an instance. Both delimiters are literal, nonempty strings; the default is `{ prefix: '{', suffix: '}' }`.

```ts
const i18n = createI18n({
  supportedLanguages: ['en', 'uk'],
  fallbackLanguage: 'en',
  interpolation: { prefix: '${', suffix: '}' },
});

const t = i18n.createTypoGetter({ en: { hello: 'Hello, ${name}' } });
t('hello', { name: 'Alex' }); // "Hello, Alex"
```

The instance configuration applies to hooks, translation components, getters, fallback messages, and both inline and extracted dictionaries. Delimiters are compiled once per instance. Existing JSON files need no build-tool configuration change.

| Placeholder                 | `prefix`           | `suffix`           |
| --------------------------- | ------------------ | ------------------ |
| `{name}` (default)          | `{`                | `}`                |
| `{{name}}`                  | `{{`               | `}}`               |
| `${name}`                   | `${`               | `}`                |
| `$${name}`                  | `$${`              | `}`                |
| `"name"`                    | `"`                | `"`                |
| `'name'`                    | `'`                | `'`                |
| <code>&#96;name&#96;</code> | <code>&#96;</code> | <code>&#96;</code> |

Parameter names support ASCII letters, digits, underscores, dots, and hyphens. Quote delimiters treat quoted parameter names as placeholders, so choose them accordingly for text that also uses quotation marks. Missing values keep the same empty-string behavior for every delimiter pair. Calling a translator without values leaves its template unchanged.

For a standalone template, pass the delimiters as the third argument, or use the instance's configured helper:

```ts
import { interpolateTypo } from 'i18n-json-react';

interpolateTypo('Hello, {{name}}', { name: 'Alex' }, { prefix: '{{', suffix: '}}' });
i18n.interpolateTypo('Hello, ${name}', { name: 'Alex' });
```

`I18N.interpolateTypo` uses the shared configuration. The standalone named `interpolateTypo` helper remains independent: it uses `{name}` unless its third argument supplies custom delimiters.

## Language selection

```ts
i18n.getCurrentLang();
i18n.setCurrentLang('pt-BR'); // Persists the choice and updates subscribed React roots.
const language = i18n.useI18nLanguage(); // Inside a component.
const unsubscribe = i18n.subscribe(() => console.log(i18n.getCurrentLang()));
unsubscribe();
```

Each instance shares its language across all roots and non-React callers. Separate instances are isolated. Choose separate `storageKey` values if instances should remember independent choices.

On first use, selection checks `initialLanguage`, the saved choice, browser preferences, then the fallback. Locale matching ignores case and treats `_` as `-`; an exact regional or script match wins, then progressively shorter tags (`zh-Hant-TW` → `zh-Hant` → `zh`). Matching returns the configured spelling. A generic language does not arbitrarily choose a region (`pt` does not choose `pt-BR`). There are no application-specific locale aliases. Use matching identifiers in your config and JSON files, including case.

Uppercase identifiers work with either API:

```ts
import I18N, { setCurrentLang } from 'i18n-json-react';

I18N.configure({ supportedLanguages: ['EN', 'UK'], fallbackLanguage: 'UK' });
setCurrentLang('EN');
```

Use `EN` and `UK` keys in your JSON. Browser preferences such as `en-US` and `uk-UA` resolve to those configured spellings, and extracted files are named `EN.json` and `UK.json`.

Configuration:

| Option                | Default / behavior                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `supportedLanguages`  | Required, nonempty list of language identifiers; infers the language union                              |
| `fallbackLanguage`    | Required member of that list                                                                            |
| `initialLanguage`     | Explicit initial choice; useful for SSR and controlled startup                                          |
| `storage`             | Browser `localStorage`; `false` disables persistence; accepts a synchronous `getItem`/`setItem` adapter |
| `storageKey`          | `i18n-language`; stores plain strings such as `pt-BR`                                                   |
| `interpolation`       | `{ prefix: '{', suffix: '}' }`; literal placeholder delimiters for all instance translators             |
| `getBrowserLanguages` | `navigator.languages`, then `navigator.language`; accepts a custom function for nonbrowser hosts        |
| `onError`             | `console.error`; reports storage access failures while language switching continues                     |
| `loadDictionary`      | Optional async loader for extracted language files                                                      |
| `dictionaries`        | Optional preloaded extracted files, keyed by language                                                   |

Language changes are explicit within each instance. Other libraries and browser tabs can follow `subscribe` and call `setCurrentLang` as needed.

## Android and iOS / React Native

See the [native integration guide](native/README.md) for Metro configuration, Expo SDK 54+ loading, native storage/locale setup, and a shared Health Ledger PWA/Android/iOS layout.

The native integration replaces feature imports with IDs and packages each locale as a separate data asset outside the main JavaScript/Hermes bundle. Only selected/fallback translations are read and parsed initially. All packaged locales remain available offline; use the build's `languages` option to reduce the packaged language set.

Use `i18n-json-react/native/metro` at build time and `i18n-json-react/native/expo` in Expo startup code. Shared feature code keeps importing hooks/components and JSON normally. The same workspace root gives feature IDs matching the web builds.

Translation preparation runs at Metro startup: restart Metro after translation JSON changes. Web/Vite reload behavior is unchanged. The guide includes a preparation CLI for native type-checking and CI.

## Extract language files with Vite 7 or 8

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { i18nJsonPlugin } from 'i18n-json-react/vite';

export default defineConfig({
  plugins: [i18nJsonPlugin({ exclude: ['scripts/**'] })],
});
```

The plugin replaces default imports of `i18n.json` and `*.i18n.json` with feature IDs. Production builds emit `i18n/<language>.json`; during development the Vite server serves the same files under the configured `base` path. A translation edit, addition, or deletion triggers a full page reload so cached language resources are recreated. No query provider or additional client code is needed.

Use the same runtime loading setup described below. For Vite, include its public base path:

```ts
loadDictionary: createFetchDictionaryLoader({
  baseUrl: `${import.meta.env.BASE_URL}i18n`,
}),
```

Options:

| Option      | Default / behavior                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `root`      | Vite's project root; an explicit path can be absolute or relative to that root                   |
| `dirs`      | `['.']`; directory globs relative to `root`                                                      |
| `exclude`   | File/directory globs relative to `root`; Vite's build output directory is excluded automatically |
| `outputDir` | `i18n`; relative emitted and served directory; match the runtime loader's `baseUrl`              |

For example, use `dirs: ['.', 'node_modules/@your-org/*']` to collect dependency dictionaries. Nested dependency folders and `.git` are skipped. The Vite and Webpack integrations share validation, collection, and ID generation. JSON excluded from collection stays inline; explicit `?raw` and `?url` imports keep Vite's normal behavior.

If Vite prebundles a dependency that imports these JSON files, add that package to `optimizeDeps.exclude` so the plugin can process its source imports. Put translated source files outside Vite's `publicDir`, whose contents are copied as static files without module processing.

## Extract language files with Webpack 5

The optional loader replaces each JSON import with `{ __id: "..." }`. The collector emits `i18n/<language>.json`, containing feature IDs and their messages. Original JSON files still provide TypeScript's key inference. The same runtime API works with inline imports or extracted references.

```js
// webpack.config.cjs
const { I18nCollectPlugin, i18nLoaderRule } = require('i18n-json-react/webpack');

module.exports = {
  module: { rules: [i18nLoaderRule()] },
  plugins: [new I18nCollectPlugin({ exclude: ['scripts/**', 'dist/**'] })],
};
```

The collector scans the project by default, skipping nested `node_modules`, `ide_node_modules`, and `.git` directories. To include feature dictionaries from dependencies, list their directories explicitly:

```js
new I18nCollectPlugin({
  dirs: ['.', 'node_modules/@your-org/*'],
  exclude: ['scripts/**', 'dist/**'],
  outputDir: 'i18n',
});
```

It collects all matching files under those directories, including files that are not imported. `exclude` globs are relative to `root`. IDs use real file paths relative to `root`, so linked packages work too. The collector tracks files and directories for watch rebuilds.

Both helpers accept `root`, an absolute path or a path relative to Webpack's context. Set the same root on both. `outputDir` is a relative emitted asset path, defaulting to `i18n`. The plugin and runtime emit/load the exact language identifiers from your JSON. JSON must contain objects of string messages; invalid input fails the build.

## Load extracted translations

Configure fetching for either bundler:

```ts
import I18N, { createFetchDictionaryLoader } from 'i18n-json-react';

I18N.configure({
  supportedLanguages: ['en', 'uk', 'pt-BR'],
  fallbackLanguage: 'en',
  loadDictionary: createFetchDictionaryLoader({ baseUrl: '/i18n' }),
});
```

`baseUrl` defaults to `i18n` (relative to the current page). Include your deployment's public path explicitly, such as `/app/assets/i18n`. You can supply `fetch` and `requestInit`, or replace the loader entirely with an async function returning a language dictionary. HTTP failures and malformed payloads reject.

```tsx
import { Suspense } from 'react';
import { LoaderForI18N } from 'i18n-json-react';

<Suspense fallback={<span>Loading translations…</span>}>
  <LoaderForI18N />
  <App />
</Suspense>;
```

Extracted translation hooks also suspend automatically, so `LoaderForI18N` is optional. It is useful to load translations before other app content. Put it inside the same Suspense boundary as the content. Use an error boundary for failed loads.

A small internal resource caches each language's promise, result, or error. It loads the fallback and selected language concurrently, deduplicates requests across roots, and never refetches successful files automatically. A failed file throws to the error boundary; it does not silently mark a failed request as loaded.

```ts
await I18N.loadLanguage('pt-BR'); // Preload selected language and fallback without changing the language.
I18N.setCurrentLang('pt-BR');

// After a failure: retry the request, then reset your error boundary.
await I18N.loadLanguage('pt-BR', { retry: true });
```

Serve matching JavaScript and dictionary assets together, with an appropriate HTTP cache policy. Use a fresh instance, reconfigure the default instance, or reload the page to load a new version of a successfully cached dictionary.

## Other helpers

```tsx
import { createTypo, useTypoAsObject } from 'i18n-json-react';

const Text = createTypo(messages);
<Text id="hello" values={{ name: 'Alex' }} />;

const ButtonText = createTypo(messages, 'buttons.');
<ButtonText id="save" />;

// In a component: a memoized object merged with the fallback.
const texts = useTypoAsObject(messages);
// Each property's value is string | undefined; missing values are not placeholders.
```

For non-React code:

```ts
import { createTypoGetter } from 'i18n-json-react';

const getText = createTypoGetter(messages);
getText('hello', { name: 'Alex' });

const getEnglish = createTypoGetter(messages, { language: 'en', placehold: false });
```

Getters follow the current language unless fixed explicitly. They do not subscribe, fetch, or suspend. With extracted files, await `loadLanguage` before calling them. In React render, use the hooks/components so language changes rerender your UI.

Use `createI18nStore` from `i18n-json-react/core` for the same language, loading, getter, and subscription APIs without importing React. `createFetchDictionaryLoader` and `interpolateTypo` are available from both entry points. Custom build tools can produce `{ __id }` references typed as `DictionaryReference<YourKeys>` and language files typed as `LanguageDictionary`.

## Server rendering

Create an instance per request, with `storage: false` and an explicit `initialLanguage`. For extracted files, supply `dictionaries` or await `loadLanguage` before rendering. Use the same initial language and preloaded dictionaries when hydrating. React's server snapshot uses `initialLanguage` or the fallback and never reads browser storage.

```ts
const requestI18n = createI18n({
  supportedLanguages: ['en', 'uk'],
  fallbackLanguage: 'en',
  initialLanguage: 'uk',
  storage: false,
  dictionaries: { en: englishDictionary, uk: ukrainianDictionary },
});
```

Bind the request's feature hooks to that instance. Do not put a mutable server instance in a process-wide singleton shared by requests.

## Differences from the SDK implementation

- Configure languages and fallback per instance rather than using a fixed `UK`/`EN` global.
- Use `createUseTypo` for callable translators. The deprecated `createUseTypoHook` proxy export is omitted.
- No TanStack Query or query provider is needed.
- `createTypoGetter` takes an options object instead of positional language/placeholder arguments.
- Storage adapters use the native string storage contract. The SDK stored a versioned JSON record under `item:{i18n-language}`; migrate its `value` explicitly if you want to keep existing preferences.
- Failed dictionary loads throw to an error boundary and can be retried explicitly.
- Default collection scans only the project; include dependency directories explicitly.
- Feature IDs differ from SDK IDs. Use this package's loader and collector together.

## Development

```sh
npm ci
npm run check
npm pack --dry-run
```

`check` builds ESM and CommonJS with declaration/source maps, checks consumer types for both formats, and runs runtime, React, SSR, Vite build/dev-server, Webpack extraction/watch, and production Android/iOS Metro tests. Set `I18N_JSON_REACT_HERMES` to an installed Hermes CLI to also execute both native bundles in Hermes. React, bundlers, and Expo modules are optional peers; install only those required by your entry points. There are no runtime `dependencies`.

The [GitHub Actions workflow](.github/workflows/test.yml) runs on pushes and pull requests, using Node 22 and 24 with npm 11 on Linux, macOS, and Windows. Each job installs from the lockfile, runs `npm run check`, and checks packaging with `npm pack --dry-run`. CI builds and checks both native bundles; executing them in Hermes requires the optional local CLI described above.

Licensed under the [MIT License](LICENSE). Nothing in the build publishes or commits changes.
