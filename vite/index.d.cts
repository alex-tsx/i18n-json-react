import type { Plugin } from 'vite';

export interface I18nViteOptions {
  /** Absolute or relative to Vite root. IDs and directory patterns use this root. */
  root?: string;
  /** Directory globs relative to root. Defaults to ['.']; list dependency packages explicitly. */
  dirs?: string[];
  /** File/directory globs relative to root, e.g. ['scripts/**']. Vite's outDir is excluded automatically. */
  exclude?: string[];
  /** Relative asset path, used for build output and dev requests. Defaults to 'i18n'. */
  outputDir?: string;
}

/** Extracts JSON imports and emits/serves per-language dictionaries; edits trigger a full dev reload. */
export declare function i18nJsonPlugin(options?: I18nViteOptions): Plugin;
