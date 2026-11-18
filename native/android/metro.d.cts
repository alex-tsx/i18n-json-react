import type { ConfigT } from 'metro-config';

export interface AndroidI18nOptions {
  /** Source/ID root, absolute or relative to the Metro projectRoot. Use the same root in Vite. */
  root?: string;
  /** Directories relative to root. Defaults to ['.']; list platform-specific source directories explicitly. */
  dirs?: readonly string[];
  exclude?: readonly string[];
  /** Optional language subset to package. Include the runtime fallback language. Defaults to all JSON locales. */
  languages?: readonly string[];
  /** Dedicated generated folder, absolute or relative to projectRoot. Defaults to '.i18n-json-react'. */
  outputDir?: string;
}

export interface AndroidI18nPreparationOptions extends AndroidI18nOptions {
  /** Metro application's directory. Defaults to process.cwd(). */
  projectRoot?: string;
}

export interface PreparedAndroidI18n {
  root: string;
  outputDir: string;
  manifestPath: string;
  languages: string[];
  references: Map<string, string>;
  fingerprints: Map<string, string>;
  watchFolders: string[];
}

export declare function prepareAndroidI18n(options?: AndroidI18nPreparationOptions): Promise<PreparedAndroidI18n>;
export declare function withI18nMetro(
  config: ConfigT | Promise<ConfigT>,
  options?: AndroidI18nOptions,
): Promise<ConfigT>;
