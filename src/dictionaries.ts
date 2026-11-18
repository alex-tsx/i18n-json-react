import type { DictionaryInput, LanguageDictionary, Messages } from './types.js';

export function getMessages(
  info: DictionaryInput,
  language: string,
  dictionaries: ReadonlyMap<string, LanguageDictionary>,
): Messages | undefined {
  if (isReference(info)) {
    const dictionary = dictionaries.get(language);
    return dictionary && Object.hasOwn(dictionary, info.__id) ? dictionary[info.__id] : undefined;
  }
  return Object.hasOwn(info, language) ? info[language] : undefined;
}

export function isReference(info: DictionaryInput): info is { readonly __id: string } {
  return typeof info.__id === 'string';
}

export function validateLanguageDictionary(value: unknown): asserts value is LanguageDictionary {
  if (!isRecord(value)) throw new TypeError('Expected a language dictionary object');
  for (const [id, messages] of Object.entries(value)) {
    if (!isRecord(messages)) throw new TypeError(`Expected a message object for feature "${id}"`);
    for (const [key, message] of Object.entries(messages)) {
      if (typeof message !== 'string') throw new TypeError(`Expected a string for "${id}.${key}"`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
