import type { I18nOptions, StorageAdapter } from './types.js';

export function createLanguageResolver<L extends string>(languages: readonly L[]) {
  const normalized = new Map<string, L>();
  for (const language of languages) {
    if (!/^[a-zA-Z]{2,8}(?:[-_][a-zA-Z0-9]{1,8})*$/.test(language)) {
      throw new Error(`Invalid language identifier: ${language}`);
    }
    const tag = normalize(language);
    if (normalized.has(tag)) throw new Error(`Duplicate language identifier: ${language}`);
    normalized.set(tag, language);
  }

  return (tag: string): L | undefined => {
    let candidate = normalize(tag);
    // Prefer an exact regional/script match, then progressively less specific tags.
    while (candidate) {
      const match = normalized.get(candidate);
      if (match !== undefined) return match;
      const separator = candidate.lastIndexOf('-');
      if (separator === -1) break;
      candidate = candidate.slice(0, separator);
    }
    return undefined;
  };
}

export function detectLanguage<L extends string>(
  options: I18nOptions<L>,
  resolve: (tag: string) => L | undefined,
  getStorage: () => StorageAdapter | undefined,
  onError: (error: unknown) => void,
): L {
  if (options.initialLanguage !== undefined) return options.initialLanguage;

  try {
    const stored = getStorage()?.getItem(options.storageKey ?? 'i18n-language');
    const language = stored ? resolve(stored) : undefined;
    if (language !== undefined) return language;
  } catch (error) {
    onError(error);
  }

  const browserLanguages =
    options.getBrowserLanguages?.() ??
    (typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]);
  for (const tag of browserLanguages) {
    const language = resolve(tag);
    if (language !== undefined) return language;
  }
  return options.fallbackLanguage;
}

function normalize(tag: string) {
  return tag.trim().replaceAll('_', '-').toLowerCase();
}
