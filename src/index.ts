'use client';

import { memo, useCallback, useMemo, useSyncExternalStore } from 'react';
import type { NamedExoticComponent } from 'react';
import { createI18nStore } from './core.js';
import { isReference, translateMessage } from './dictionaries.js';
import type {
  DictionaryInput,
  DictionaryKeys,
  I18nOptions,
  InterpolationValues,
  RemovePrefix,
  Typo,
  TypoHook,
  TypoOptions,
  TypoProps,
} from './types.js';

export { createFetchDictionaryLoader, createI18nStore, interpolateTypo } from './core.js';
export type { I18nStore } from './core.js';
export type * from './types.js';

/** Creates an isolated language store and its bound React helpers. No provider is needed. */
export function createI18n<const L extends string>(options: I18nOptions<L>) {
  const store = createI18nStore(options);

  function useI18nLanguage() {
    return useSyncExternalStore(store.subscribe, store.getCurrentLang, store.getServerLanguage);
  }

  function useDictionaryLanguage(info: DictionaryInput) {
    const language = useI18nLanguage();
    // A language file can finish loading without the language itself changing.
    const revision = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
    if (isReference(info)) store.readLanguage(language);
    return { language, revision };
  }

  function useGetText(info: DictionaryInput, placehold = true) {
    const { language, revision } = useDictionaryLanguage(info);
    const messages = useMemo(() => store.getTypoAsObject(info, language), [info, language, revision]);
    return useCallback(
      (key: string, values?: InterpolationValues) => translateMessage(messages, key, values, placehold),
      [messages, placehold],
    );
  }

  function createUseTypo<const D extends DictionaryInput>(info: D): TypoHook<DictionaryKeys<D>> {
    function useTypo<P extends string>(
      hookOptions: TypoOptions<P> & { keyPrefix: P },
    ): Typo<RemovePrefix<DictionaryKeys<D>, P>>;
    function useTypo(hookOptions?: TypoOptions<never>): Typo<DictionaryKeys<D>>;
    function useTypo<P extends string>(hookOptions?: TypoOptions<P>): Typo<string> {
      const getText = useGetText(info, hookOptions?.placehold ?? true);
      const prefix = hookOptions?.keyPrefix ?? '';
      const translate = useCallback(
        (key: string, values?: InterpolationValues) => {
          return getText(`${prefix}${key}`, values);
        },
        [getText, prefix],
      );
      return useMemo(() => Object.assign(translate, { t: translate }), [translate]);
    }
    return useTypo;
  }

  function createTypo<const D extends DictionaryInput>(info: D): NamedExoticComponent<TypoProps<DictionaryKeys<D>>>;
  function createTypo<const D extends DictionaryInput, P extends string>(
    info: D,
    prefix: P,
  ): NamedExoticComponent<TypoProps<RemovePrefix<DictionaryKeys<D>, P>>>;
  function createTypo<const D extends DictionaryInput, P extends string>(info: D, prefix?: P) {
    const Component = memo<TypoProps<string>>(({ id, values }) => {
      const getText = useGetText(info);
      return getText(`${prefix ?? ''}${id}`, values);
    });
    Component.displayName = 'Typo';
    return Component;
  }

  function useTypoAsObject<const D extends DictionaryInput>(info: D): Record<DictionaryKeys<D>, string | undefined>;
  function useTypoAsObject(info: DictionaryInput) {
    const { language, revision } = useDictionaryLanguage(info);
    return useMemo(() => store.getTypoAsObject(info, language), [info, language, revision]);
  }

  const LoaderForI18N = memo(function LoaderForI18N() {
    store.readLanguage(useI18nLanguage());
    return null;
  });

  return { ...store, useI18nLanguage, createUseTypo, createTypo, useTypoAsObject, LoaderForI18N };
}

export type I18n<L extends string> = ReturnType<typeof createI18n<L>>;
