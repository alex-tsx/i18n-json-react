import 'i18n-json-react';
import type { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from './app-languages.js';

declare module 'i18n-json-react' {
  interface CustomTypeOptions {
    supportedLanguages: (typeof SUPPORTED_LANGUAGES)[number];
    fallbackLanguage: typeof FALLBACK_LANGUAGE;
  }
}
