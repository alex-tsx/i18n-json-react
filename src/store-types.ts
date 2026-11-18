import type { I18nStore as Store } from './store.js';
import type {
  CheckedDictionary,
  DictionaryInput,
  DictionaryKeys,
  GetterOptions,
  InterpolationValues,
} from './types.js';

export interface DictionaryGetters<L extends string, F extends string = never> {
  createTypoGetter<const D extends DictionaryInput>(
    info: CheckedDictionary<D, L, F>,
    options?: GetterOptions<L>,
  ): (key: DictionaryKeys<D>, values?: InterpolationValues) => string;
  getTypoAsObject<const D extends DictionaryInput>(
    info: CheckedDictionary<D, L, F>,
    language?: L,
  ): Record<DictionaryKeys<D>, string | undefined>;
}

export type I18nStore<L extends string, F extends string = never> = Omit<Store<L>, keyof DictionaryGetters<L, F>> &
  DictionaryGetters<L, F>;

/** Keep the original inferred dictionary when forwarding a checked argument to the store. */
export function withDictionaryTypes<L extends string, F extends string = never>(store: Store<L>): I18nStore<L, F> {
  const { createTypoGetter, getTypoAsObject } = store;
  const methods: DictionaryGetters<L, F> = {
    createTypoGetter<const D extends DictionaryInput>(info: CheckedDictionary<D, L, F>, options?: GetterOptions<L>) {
      return createTypoGetter<D>(info, options);
    },
    getTypoAsObject<const D extends DictionaryInput>(info: CheckedDictionary<D, L, F>, language?: L) {
      return getTypoAsObject<D>(info, language);
    },
  };
  return Object.assign(store, methods);
}
