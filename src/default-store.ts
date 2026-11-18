import { createI18nStore } from './core.js';
import type { I18nStore } from './core.js';
import type {
  DictionaryInput,
  DictionaryKeys,
  GetterOptions,
  I18nOptions,
  InterpolationValues,
  LoadOptions,
} from './types.js';

/** Stable delegates let module-scope feature factories work before configuration. */
export function createDefaultI18nStore() {
  let current: I18nStore<string> | undefined;
  let unsubscribe: (() => void) | undefined;
  let revision = 0;
  let wakePendingReads = () => {};
  let configurationChanged = new Promise<void>(resolve => {
    wakePendingReads = resolve;
  });
  let suspendedReads = new WeakMap<Promise<unknown>, Promise<unknown>>();
  const listeners = new Set<() => void>();

  const emit = () => {
    revision += 1;
    for (const listener of listeners) listener();
  };
  const getStore = () => {
    if (!current) throw new Error('Call I18N.configure(...) before reading translations or language state');
    return current;
  };

  const store: I18nStore<string> = {
    get supportedLanguages() {
      return getStore().supportedLanguages;
    },
    get fallbackLanguage() {
      return getStore().fallbackLanguage;
    },
    interpolateTypo: (template, values) => getStore().interpolateTypo(template, values),
    resolveLanguage: tag => getStore().resolveLanguage(tag),
    getCurrentLang: () => getStore().getCurrentLang(),
    getServerLanguage: () => getStore().getServerLanguage(),
    setCurrentLang: language => getStore().setCurrentLang(language),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => revision,
    getServerSnapshot: () => 0,
    async loadLanguage(language?: string, options?: LoadOptions) {
      await getStore().loadLanguage(language, options);
    },
    readLanguage(language) {
      try {
        getStore().readLanguage(language);
      } catch (error) {
        if (!(error instanceof Promise)) throw error;
        let pending = suspendedReads.get(error);
        if (!pending) {
          // Wake suspended roots when configuration changes, even if the old request never finishes.
          pending = Promise.race([error, configurationChanged]);
          suspendedReads.set(error, pending);
          // Keep the thrown promise rejecting for React while handling an unread imperative branch.
          void pending.catch(failure => failure);
        }
        throw pending;
      }
    },
    createTypoGetter<const D extends DictionaryInput>(info: D, options: GetterOptions<string> = {}) {
      let boundStore: I18nStore<string> | undefined;
      let getText: ((key: DictionaryKeys<D>, values?: InterpolationValues) => string) | undefined;
      return (key: DictionaryKeys<D>, values?: InterpolationValues) => {
        const configured = getStore();
        if (boundStore !== configured || !getText) {
          getText = configured.createTypoGetter(info, options);
          boundStore = configured;
        }
        return getText(key, values);
      };
    },
    getTypoAsObject: (info, language) => getStore().getTypoAsObject(info, language),
  };

  /** Replaces the whole configuration atomically; existing helpers follow the new store. */
  function configure<const L extends string>(options: I18nOptions<L>): void;
  function configure(options: I18nOptions<string>) {
    const next = createI18nStore(options);
    // Validate the new store before changing the active configuration or its subscriptions.
    unsubscribe?.();
    current = next;
    unsubscribe = next.subscribe(emit);
    wakePendingReads();
    configurationChanged = new Promise<void>(resolve => {
      wakePendingReads = resolve;
    });
    suspendedReads = new WeakMap();
    emit();
  }

  return Object.assign(store, { configure });
}
