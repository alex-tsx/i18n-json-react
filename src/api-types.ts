import type { NamedExoticComponent } from 'react';
import type { createReactBindings } from './react.js';
import type { I18nStore } from './store-types.js';
import type {
  CheckedDictionary,
  DefaultI18nOptions,
  DictionaryInput,
  DictionaryKeys,
  RegisteredFallbackLanguage,
  RemovePrefix,
  SupportedLanguage,
  TypoHook,
  TypoProps,
} from './types.js';

export interface DictionaryReactBindings<L extends string, F extends string = never> {
  createUseTypo<const D extends DictionaryInput>(info: CheckedDictionary<D, L, F>): TypoHook<DictionaryKeys<D>>;
  createTypo<const D extends DictionaryInput>(
    info: CheckedDictionary<D, L, F>,
  ): NamedExoticComponent<TypoProps<DictionaryKeys<D>>>;
  createTypo<const D extends DictionaryInput, P extends string>(
    info: CheckedDictionary<D, L, F>,
    prefix: P,
  ): NamedExoticComponent<TypoProps<RemovePrefix<DictionaryKeys<D>, P>>>;
  useTypoAsObject<const D extends DictionaryInput>(
    info: CheckedDictionary<D, L, F>,
  ): Record<DictionaryKeys<D>, string | undefined>;
}

export type ReactBindings<L extends string, F extends string = never> = Omit<
  ReturnType<typeof createReactBindings<L>>,
  keyof DictionaryReactBindings<L, F>
> &
  DictionaryReactBindings<L, F>;

export type I18n<L extends string, F extends string = never> = I18nStore<L, F> & ReactBindings<L, F>;

export interface DefaultConfiguration {
  configure<const L extends SupportedLanguage>(options: DefaultI18nOptions<L>): void;
}

export type DefaultI18n = I18n<SupportedLanguage, RegisteredFallbackLanguage> & DefaultConfiguration;
