import { createReactBindings } from './react.js';
import type { NamedExoticComponent } from 'react';
import type { DictionaryReactBindings, ReactBindings } from './api-types.js';
import type { I18nStore } from './store.js';
import type { CheckedDictionary, DictionaryInput, DictionaryKeys, RemovePrefix, TypoProps } from './types.js';

/** Validates locale keys at the public boundary while keeping the existing React implementation. */
export function bindReact<L extends string, F extends string = never>(store: I18nStore<L>): ReactBindings<L, F> {
  const bindings = createReactBindings(store);
  const { createTypo: createRawTypo, createUseTypo: createRawUseTypo, useTypoAsObject: useRawTypoAsObject } = bindings;

  function createTypo<const D extends DictionaryInput>(
    info: CheckedDictionary<D, L, F>,
  ): NamedExoticComponent<TypoProps<DictionaryKeys<D>>>;
  function createTypo<const D extends DictionaryInput, P extends string>(
    info: CheckedDictionary<D, L, F>,
    prefix: P,
  ): NamedExoticComponent<TypoProps<RemovePrefix<DictionaryKeys<D>, P>>>;
  function createTypo<const D extends DictionaryInput, P extends string>(info: D, prefix?: P) {
    return prefix === undefined ? createRawTypo<D>(info) : createRawTypo<D, P>(info, prefix);
  }

  const methods: DictionaryReactBindings<L, F> = {
    createTypo,
    createUseTypo<const D extends DictionaryInput>(info: CheckedDictionary<D, L, F>) {
      return createRawUseTypo<D>(info);
    },
    useTypoAsObject<const D extends DictionaryInput>(info: CheckedDictionary<D, L, F>) {
      return useRawTypoAsObject<D>(info);
    },
  };
  return Object.assign(bindings, methods);
}
