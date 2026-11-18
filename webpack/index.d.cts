import type { Compiler, RuleSetRule, WebpackPluginInstance } from 'webpack';

export interface I18nLoaderOptions {
  /** Absolute or relative to Webpack context. Must match the collector's root. */
  root?: string;
}

export interface I18nCollectPluginOptions extends I18nLoaderOptions {
  /** Directories/globs relative to root. Defaults to ['.']; list dependency packages explicitly. */
  dirs?: string[];
  /** File/directory globs relative to root, e.g. ['scripts/**', 'dist/**']. */
  exclude?: string[];
  /** Relative emitted asset directory. Defaults to 'i18n'. Match the runtime loader's baseUrl. */
  outputDir?: string;
}

export declare function i18nLoaderRule(options?: I18nLoaderOptions): RuleSetRule;

export declare class I18nCollectPlugin implements WebpackPluginInstance {
  constructor(options?: I18nCollectPluginOptions);
  apply(compiler: Compiler): void;
}
