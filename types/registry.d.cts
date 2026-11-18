/** Augment this interface through 'i18n-json-react' to type the application's shared instance. */
export interface CustomTypeOptions {}

/** Registered language identifiers, or string when no application registration is supplied. */
export type SupportedLanguage = CustomTypeOptions extends { supportedLanguages: infer L extends string } ? L : string;

/** Registering a fallback also requires that locale's entry in feature dictionaries. */
export type RegisteredFallbackLanguage = CustomTypeOptions extends { fallbackLanguage: infer F extends string }
  ? F
  : never;
