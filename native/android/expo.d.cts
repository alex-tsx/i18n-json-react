import type { LanguageDictionary } from '../../dist/cjs/core.js';
import type { AndroidLanguageAssets } from './index.cjs';

/** Requires expo-asset >=12 and expo-file-system >=19; does not import those modules in web entrypoints. */
export declare function createExpoDictionaryLoader<const L extends string>(
  assets: AndroidLanguageAssets<L>,
): (language: L) => Promise<LanguageDictionary>;
