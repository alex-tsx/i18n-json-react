import type { LanguageDictionary } from '../dist/cjs/core.js';

/** Generated manifest: static native asset requires, deferred until the locale is requested. */
export type NativeLanguageAssets<L extends string = string> = Readonly<Record<L, () => number>>;

export interface NativeDictionaryLoaderOptions {
  /** Read UTF-8 asset text using the application's native file/asset integration. */
  readAssetText(moduleId: number): Promise<string>;
}

export declare function createNativeDictionaryLoader<const L extends string>(
  assets: NativeLanguageAssets<L>,
  options: NativeDictionaryLoaderOptions,
): (language: L) => Promise<LanguageDictionary>;
