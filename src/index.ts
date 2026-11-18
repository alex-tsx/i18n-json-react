'use client';

import { createI18nStore } from './store.js';
import { createDefaultI18nStore } from './default-store.js';
import { withDictionaryTypes } from './store-types.js';
import { bindReact } from './typed-react.js';
import type { I18nOptions, RegisteredFallbackLanguage, SupportedLanguage } from './types.js';
import type { DefaultI18n, I18n } from './api-types.js';

export { createFetchDictionaryLoader, createI18nStore, interpolateTypo } from './core.js';
export type { I18nStore } from './core.js';
export type { DefaultI18n, I18n } from './api-types.js';
export type * from './types.js';

/** Creates an isolated language store and its bound React helpers. No provider is needed. */
export function createI18n<const L extends string>(options: I18nOptions<L>): I18n<L> {
  const store = createI18nStore(options);
  return Object.assign(withDictionaryTypes(store), bindReact(store));
}

const I18N = createSharedI18n();

export default I18N;

/** These helpers share the default instance configured with I18N.configure(...). */
export const configure: DefaultI18n['configure'] = I18N.configure;
export const createTypo: DefaultI18n['createTypo'] = I18N.createTypo;
export const createUseTypo: DefaultI18n['createUseTypo'] = I18N.createUseTypo;
export const createTypoGetter: DefaultI18n['createTypoGetter'] = I18N.createTypoGetter;
export const useTypoAsObject: DefaultI18n['useTypoAsObject'] = I18N.useTypoAsObject;
export const useI18nLanguage: DefaultI18n['useI18nLanguage'] = I18N.useI18nLanguage;
export const LoaderForI18N: DefaultI18n['LoaderForI18N'] = I18N.LoaderForI18N;
export const getCurrentLang: DefaultI18n['getCurrentLang'] = I18N.getCurrentLang;
export const setCurrentLang: DefaultI18n['setCurrentLang'] = I18N.setCurrentLang;
export const resolveLanguage: DefaultI18n['resolveLanguage'] = I18N.resolveLanguage;
export const subscribe: DefaultI18n['subscribe'] = I18N.subscribe;
export const loadLanguage: DefaultI18n['loadLanguage'] = I18N.loadLanguage;

function createSharedI18n(): DefaultI18n {
  const store = createDefaultI18nStore();
  return Object.assign(
    withDictionaryTypes<SupportedLanguage, RegisteredFallbackLanguage>(store),
    bindReact<SupportedLanguage, RegisteredFallbackLanguage>(store),
    { configure: store.configure },
  );
}
