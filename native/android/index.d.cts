import type { LanguageDictionary } from '../../dist/cjs/core.js';

/** Generated manifest: static native asset requires, deferred until the locale is requested. */
export type AndroidLanguageAssets<L extends string = string> = Readonly<Record<L, () => number>>;

export interface AndroidDictionaryLoaderOptions {
  /** Read UTF-8 asset text using the application's native file/asset integration. */
  readAssetText(moduleId: number): Promise<string>;
}

export declare function createAndroidDictionaryLoader<const L extends string>(
  assets: AndroidLanguageAssets<L>,
  options: AndroidDictionaryLoaderOptions,
): (language: L) => Promise<LanguageDictionary>;
