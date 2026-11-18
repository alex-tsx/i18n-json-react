# i18n-json-react

Feature-local JSON translations with typed keys, React hooks, and optional per-language Vite or Webpack bundles. No runtime dependencies other than the React peer. The `/core` entry works without React.

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

Create one instance and share its helpers throughout your app:

```ts
// i18n.ts
import { createI18n } from 'i18n-json-react';

export const i18n = createI18n({
  supportedLanguages: ['en', 'uk', 'pt-BR'],
  fallbackLanguage: 'en',
});

export const { createUseTypo, createTypo, useI18nLanguage, setCurrentLang } = i18n;
```

```tsx
// profile.tsx
import { memo } from 'react';
import { createUseTypo } from './i18n';
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

`t` is callable and supports `const { t } = useProfileTypo()`. Unknown keys fail type checking; a prefix limits keys to the matching suffixes. Missing messages fall back per key to `fallbackLanguage`, then to `i18n(key)`. Pass `{ placehold: false }` to return `''` for missing messages. Empty translations stay empty.

Interpolation replaces `{name}` with string/number values. Missing, `null`, and `undefined` values become empty strings. Values are plain text; render them normally in React. ICU messages, automatic plural rules, nested key traversal, and HTML parsing are outside this package's scope. Use `Intl` for dates and numbers.

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

Configuration:

| Option                | Default / behavior                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `supportedLanguages`  | Required, nonempty list of language identifiers; infers the language union                              |
| `fallbackLanguage`    | Required member of that list                                                                            |
| `initialLanguage`     | Explicit initial choice; useful for SSR and controlled startup                                          |
| `storage`             | Browser `localStorage`; `false` disables persistence; accepts a synchronous `getItem`/`setItem` adapter |
| `storageKey`          | `i18n-language`; stores plain strings such as `pt-BR`                                                   |
| `getBrowserLanguages` | `navigator.languages`, then `navigator.language`; accepts a custom function for nonbrowser hosts        |
| `onError`             | `console.error`; reports storage access failures while language switching continues                     |
| `loadDictionary`      | Optional async loader for extracted language files                                                      |
| `dictionaries`        | Optional preloaded extracted files, keyed by language                                                   |

Language changes are explicit within each instance. Other libraries and browser tabs can follow `subscribe` and call `setCurrentLang` as needed.

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
import { createI18n, createFetchDictionaryLoader } from 'i18n-json-react';

export const i18n = createI18n({
  supportedLanguages: ['en', 'uk', 'pt-BR'],
  fallbackLanguage: 'en',
  loadDictionary: createFetchDictionaryLoader({ baseUrl: '/i18n' }),
});
```

`baseUrl` defaults to `i18n` (relative to the current page). Include your deployment's public path explicitly, such as `/app/assets/i18n`. You can supply `fetch` and `requestInit`, or replace the loader entirely with an async function returning a language dictionary. HTTP failures and malformed payloads reject.

```tsx
import { Suspense } from 'react';
import { i18n } from './i18n';

const { LoaderForI18N } = i18n;

<Suspense fallback={<span>Loading translations…</span>}>
  <LoaderForI18N />
  <App />
</Suspense>;
```

Extracted translation hooks also suspend automatically, so `LoaderForI18N` is optional. It is useful to load translations before other app content. Put it inside the same Suspense boundary as the content. Use an error boundary for failed loads.

A small internal resource caches each language's promise, result, or error. It loads the fallback and selected language concurrently, deduplicates requests across roots, and never refetches successful files automatically. A failed file throws to the error boundary; it does not silently mark a failed request as loaded.

```ts
await i18n.loadLanguage('pt-BR'); // Preload selected language and fallback without changing the language.
i18n.setCurrentLang('pt-BR');

// After a failure: retry the request, then reset your error boundary.
await i18n.loadLanguage('pt-BR', { retry: true });
```

Serve matching JavaScript and dictionary assets together, with an appropriate HTTP cache policy. Use a fresh instance or reload the page to load a new version of a successfully cached dictionary.

## Other helpers

```tsx
const Text = i18n.createTypo(messages);
<Text id="hello" values={{ name: 'Alex' }} />;

const ButtonText = i18n.createTypo(messages, 'buttons.');
<ButtonText id="save" />;

// In a component: a memoized object merged with the fallback.
const texts = i18n.useTypoAsObject(messages);
// Each property's value is string | undefined; missing values are not placeholders.
```

For non-React code:

```ts
const getText = i18n.createTypoGetter(messages);
getText('hello', { name: 'Alex' });

const getEnglish = i18n.createTypoGetter(messages, { language: 'en', placehold: false });
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

`check` builds ESM and CommonJS with declaration/source maps, checks consumer types for both formats, and runs runtime, React, SSR, Vite build/dev-server, Webpack extraction, and watch tests. React, Vite, and Webpack are optional peers: install React for the main entry and the appropriate bundler for extraction. There are no runtime `dependencies`.

The package is currently marked `UNLICENSED`; choose a license before a public release. Nothing in the build publishes or commits changes.
