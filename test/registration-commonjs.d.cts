import 'i18n-json-react';

declare module 'i18n-json-react' {
  interface CustomTypeOptions {
    supportedLanguages: 'de' | 'fr';
    fallbackLanguage: 'de';
  }
}
