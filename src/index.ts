'use client';

import { createI18nStore } from './core.js';
import { createDefaultI18nStore } from './default-store.js';
import { createReactBindings } from './react.js';
import type { I18nOptions } from './types.js';

export { createFetchDictionaryLoader, createI18nStore, interpolateTypo } from './core.js';
export type { I18nStore } from './core.js';
export type * from './types.js';

/** Creates an isolated language store and its bound React helpers. No provider is needed. */
export function createI18n<const L extends string>(options: I18nOptions<L>) {
  const store = createI18nStore(options);
  return Object.assign(store, createReactBindings(store));
}

const defaultStore = createDefaultI18nStore();
const I18N = Object.assign(defaultStore, createReactBindings(defaultStore));

export default I18N;

/** These helpers share the default instance configured with I18N.configure(...). */
export const {
  configure,
  createTypo,
  createUseTypo,
  createTypoGetter,
  useTypoAsObject,
  useI18nLanguage,
  LoaderForI18N,
  getCurrentLang,
  setCurrentLang,
  resolveLanguage,
  subscribe,
  loadLanguage,
} = I18N;

export type I18n<L extends string> = ReturnType<typeof createI18n<L>>;
