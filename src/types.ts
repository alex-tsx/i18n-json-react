export type Messages = Readonly<Record<string, string | undefined>>;

/** A feature's original JSON: language -> flat translation keys. */
export type FeatureDictionary = Readonly<Record<string, Messages>>;

/** Emitted by the Webpack loader. The optional phantom field preserves keys for custom loaders. */
export interface DictionaryReference<K extends string = string> {
  readonly __id: string;
  readonly __keys?: K;
}

export type DictionaryInput = FeatureDictionary | DictionaryReference;

export type DictionaryKeys<D extends DictionaryInput> =
  D extends DictionaryReference<infer K> ? K : { [L in keyof D]: keyof D[L] }[keyof D] & string;

/** Contents of one emitted language file: feature ID -> translations. */
export type LanguageDictionary = Readonly<Record<string, Messages | undefined>>;

export type InterpolationValues = Readonly<Record<string, string | number | null | undefined>>;

export interface InterpolationDelimiters {
  /** Literal opening delimiter, e.g. '{', '{{', '${', or a quote. Must not be empty. */
  readonly prefix: string;
  /** Literal closing delimiter, e.g. '}', '}}', or the same quote. Must not be empty. */
  readonly suffix: string;
}

export type RemovePrefix<K extends string, P extends string> = K extends `${P}${infer Suffix}` ? Suffix : never;

export interface Typo<K extends string> {
  (key: K, values?: InterpolationValues): string;
  /** Allows `const { t } = useFeatureTypo()`. */
  readonly t: (key: K, values?: InterpolationValues) => string;
}

export interface TypoOptions<P extends string = string> {
  keyPrefix?: P;
  /** Show `i18n(key)` for a missing message. Defaults to true; false returns an empty string. */
  placehold?: boolean;
}

export interface TypoHook<K extends string> {
  <P extends string>(options: TypoOptions<P> & { keyPrefix: P }): Typo<RemovePrefix<K, P>>;
  (options?: TypoOptions<never>): Typo<K>;
}

export interface TypoProps<K extends string> {
  id: K;
  values?: InterpolationValues;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface I18nOptions<L extends string> {
  supportedLanguages: readonly L[];
  fallbackLanguage: NoInfer<L>;
  /** Overrides storage/browser detection. Use the same value on the server and during hydration. */
  initialLanguage?: NoInfer<L>;
  /** Defaults to browser localStorage. false disables persistence. Values are plain language strings. */
  storage?: StorageAdapter | false;
  storageKey?: string;
  /** Interpolation placeholder delimiters. Defaults to { prefix: '{', suffix: '}' }. */
  interpolation?: InterpolationDelimiters;
  /** Defaults to navigator.languages, with navigator.language as a fallback. */
  getBrowserLanguages?: () => readonly string[];
  /** Optional preloaded emitted dictionaries, useful for SSR. */
  dictionaries?: Readonly<Partial<Record<L, LanguageDictionary>>>;
  /** Without a loader only inline JSON dictionaries can be used. */
  loadDictionary?: (language: L) => Promise<LanguageDictionary>;
  /** Receives storage errors. Defaults to console.error. Loading errors reject/throw instead. */
  onError?: (error: unknown) => void;
}

export interface GetterOptions<L extends string> {
  /** Omit to follow the instance's current language on every call. */
  language?: L;
  placehold?: boolean;
}

export interface LoadOptions {
  /** Retry a failed language request. Successful requests stay cached. */
  retry?: boolean;
}

export interface FetchDictionaryOptions {
  /** Defaults to "i18n". Include any bundler public path, e.g. "/app/assets/i18n". */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  requestInit?: RequestInit;
}
