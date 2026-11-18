import type { ConfigT } from 'metro-config';

export interface NativeI18nOptions {
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

export interface NativeI18nPreparationOptions extends NativeI18nOptions {
  /** Metro application's directory. Defaults to process.cwd(). */
  projectRoot?: string;
}

export interface PreparedNativeI18n {
  root: string;
  outputDir: string;
  manifestPath: string;
  languages: string[];
  references: Map<string, string>;
  fingerprints: Map<string, string>;
  watchFolders: string[];
}

export declare function prepareNativeI18n(options?: NativeI18nPreparationOptions): Promise<PreparedNativeI18n>;
export declare function withI18nMetro(
  config: ConfigT | Promise<ConfigT>,
  options?: NativeI18nOptions,
): Promise<ConfigT>;
