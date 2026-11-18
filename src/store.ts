import { getMessages, validateLanguageDictionary } from './dictionaries.js';
import { createInterpolator } from './interpolation.js';
import { createLanguageResolver, detectLanguage } from './languages.js';
import { createAsyncResource } from './resource.js';
import type { AsyncResource } from './resource.js';
import type {
  DictionaryInput,
  DictionaryKeys,
  GetterOptions,
  I18nOptions,
  InterpolationValues,
  LanguageDictionary,
  LoadOptions,
  Messages,
} from './types.js';

/** A React-independent store. Share one instance between roots, or create one per SSR request. */
export function createI18nStore<const L extends string>(options: I18nOptions<L>) {
  const interpolate = createInterpolator(options.interpolation);
  const languages = Object.freeze([...options.supportedLanguages]);
  const supported = new Set(languages);
  if (!supported.has(options.fallbackLanguage)) throw new Error('fallbackLanguage must be supported');
  if (options.initialLanguage !== undefined && !supported.has(options.initialLanguage)) {
    throw new Error('initialLanguage must be supported');
  }
  const resolveLanguage = createLanguageResolver(languages);
  const listeners = new Set<() => void>();
  const dictionaries = new Map<L, LanguageDictionary>();
  const resources = new Map<L, AsyncResource<void>>();
  const onError = options.onError ?? console.error;
  let currentLanguage: L | undefined;
  let revision = 0;

  for (const language of languages) {
    const dictionary = options.dictionaries?.[language];
    if (dictionary !== undefined) {
      validateLanguageDictionary(dictionary);
      dictionaries.set(language, dictionary);
    }
  }

  const getStorage = () =>
    options.storage === false
      ? undefined
      : (options.storage ?? (typeof window === 'undefined' ? undefined : window.localStorage));
  const emit = () => {
    revision += 1;
    for (const listener of listeners) listener();
  };
  const getCurrentLang = (): L => {
    currentLanguage ??= detectLanguage(options, resolveLanguage, getStorage, onError);
    return currentLanguage;
  };
  const assertSupported = (language: L) => {
    if (!supported.has(language)) throw new Error(`Unsupported language: ${language}`);
  };
  const getResource = (language: L, retry = false) => {
    assertSupported(language);
    if (dictionaries.has(language)) return undefined;
    const cached = resources.get(language);
    if (cached && !(retry && cached.isRejected())) return cached;
    const resource = createAsyncResource(async () => {
      if (!options.loadDictionary) {
        throw new Error('Configure loadDictionary or provide preloaded dictionaries for extracted JSON');
      }
      const dictionary = await options.loadDictionary(language);
      validateLanguageDictionary(dictionary);
      dictionaries.set(language, dictionary);
      emit();
    });
    resources.set(language, resource);
    return resource;
  };
  const requiredResources = (language: L, retry = false) => {
    assertSupported(language);
    return [...new Set([options.fallbackLanguage, language])].map(lang => getResource(lang, retry));
  };

  function getTypoAsObject<const D extends DictionaryInput>(
    info: D,
    language?: L,
  ): Record<DictionaryKeys<D>, string | undefined>;
  function getTypoAsObject(info: DictionaryInput, language: L = getCurrentLang()) {
    assertSupported(language);
    const merged = new Map(Object.entries(getMessages(info, options.fallbackLanguage, dictionaries) ?? {}));
    for (const [key, value] of Object.entries(getMessages(info, language, dictionaries) ?? {})) {
      if (value !== undefined) merged.set(key, value);
    }
    return Object.fromEntries(merged);
  }

  return {
    supportedLanguages: languages,
    fallbackLanguage: options.fallbackLanguage,
    /** Interpolates with this instance's configured delimiters. */
    interpolateTypo: interpolate,
    resolveLanguage,
    getCurrentLang,
    /** A stable SSR snapshot; match initialLanguage between server and client for hydration. */
    getServerLanguage: () => options.initialLanguage ?? options.fallbackLanguage,
    setCurrentLang(language: L) {
      assertSupported(language);
      const previous = getCurrentLang();
      try {
        getStorage()?.setItem(options.storageKey ?? 'i18n-language', language);
      } catch (error) {
        onError(error);
      }
      if (previous === language) return;
      currentLanguage = language;
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => revision,
    getServerSnapshot: () => 0,
    /** Loads the selected language and fallback concurrently, deduplicating each request. */
    async loadLanguage(language: L = getCurrentLang(), loadOptions: LoadOptions = {}) {
      await Promise.all(requiredResources(language, loadOptions.retry).map(resource => resource?.promise));
    },
    /** Throws a cached promise/error for React Suspense and error boundaries. */
    readLanguage(language: L = getCurrentLang()) {
      for (const resource of requiredResources(language)) resource?.read();
    },
    createTypoGetter<const D extends DictionaryInput>(info: D, getterOptions: GetterOptions<L> = {}) {
      if (getterOptions.language !== undefined) assertSupported(getterOptions.language);
      return (key: DictionaryKeys<D>, values?: InterpolationValues): string => {
        const language = getterOptions.language ?? getCurrentLang();
        const selected = getMessages(info, language, dictionaries);
        const fallback = getMessages(info, options.fallbackLanguage, dictionaries);
        const template =
          ownMessage(selected, key) ??
          ownMessage(fallback, key) ??
          (getterOptions.placehold === false ? '' : `i18n(${key})`);
        return values ? interpolate(template, values) : template;
      };
    },
    getTypoAsObject,
  };
}

export type I18nStore<L extends string> = ReturnType<typeof createI18nStore<L>>;

function ownMessage(messages: Messages | undefined, key: string) {
  return messages && Object.hasOwn(messages, key) ? messages[key] : undefined;
}
