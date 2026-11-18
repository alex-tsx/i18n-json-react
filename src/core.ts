import { validateLanguageDictionary } from './dictionaries.js';
import { createI18nStore as createStore } from './store.js';
import { withDictionaryTypes } from './store-types.js';
import type { I18nStore } from './store-types.js';
import type { FetchDictionaryOptions, I18nOptions, LanguageDictionary } from './types.js';

export { interpolateTypo } from './interpolation.js';
export type { I18nStore } from './store-types.js';
export type * from './types.js';

/** Creates a React-independent store whose dictionary APIs check the configured languages. */
export function createI18nStore<const L extends string>(options: I18nOptions<L>): I18nStore<L> {
  return withDictionaryTypes(createStore(options));
}

/** HTTP loader for the language files emitted by I18nCollectPlugin. */
export function createFetchDictionaryLoader(options: FetchDictionaryOptions = {}) {
  const baseUrl = (options.baseUrl ?? 'i18n').replace(/\/+$/, '');
  return async (language: string): Promise<LanguageDictionary> => {
    const fetcher = options.fetch ?? globalThis.fetch;
    if (!fetcher) throw new Error('No fetch implementation available; provide options.fetch');
    const url = `${baseUrl}/${encodeURIComponent(language)}.json`;
    const response = await fetcher(url, options.requestInit);
    if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status} ${response.statusText}`);
    const dictionary: unknown = await response.json();
    validateLanguageDictionary(dictionary);
    return dictionary;
  };
}
