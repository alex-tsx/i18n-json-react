/** Export a string literally, or explicitly opt into Android positional printf formatting. */
export type AndroidStringResource = string | {key: string; formatted?: boolean};
export interface AndroidResourceTarget {
  /** Android res directory, absolute or relative to root. Existing manual resources are retained. */
  outputDir: string;
  /** Dedicated generated XML filename. Defaults to i18n_json_react.xml. */
  fileName?: string;
  /** Feature JSON paths relative to root, in precedence order (feature first, shared fallback last). */
  dictionaries: readonly string[];
  /** Native resource ID -> flat translation key, or key/formatting options. */
  strings: Readonly<Record<string, AndroidStringResource>>;
}
export interface AndroidResourcesConfig<L extends string = string> {
  /** Optional editor schema reference; never fetched by the exporter. */
  $schema?: string;
  /** Source/output root, relative to projectRoot (or the JSON config file's directory). */
  root?: string;
  /** Translation used in values/ and for missing individual messages in other locales. */
  defaultLanguage: L;
  /** Locales to export. Defaults to all locales present in the referenced dictionaries. */
  languages?: readonly L[];
  /** Map dictionary identifiers to Android locale tags, e.g. {EN: 'en', UK: 'uk'}. */
  locales?: Readonly<Partial<Record<L, string>>>;
  resources: readonly AndroidResourceTarget[];
}
export interface AndroidResourcesOptions<L extends string = string> extends AndroidResourcesConfig<L> {
  /** Base for root. Defaults to process.cwd(); no configuration/environment files are loaded implicitly. */
  projectRoot?: string;
}
export interface GeneratedAndroidResources {
  root: string;
  languages: string[];
  files: string[];
}
export declare function generateAndroidResources<const L extends string>(options: AndroidResourcesOptions<L>): Promise<GeneratedAndroidResources>;
/** Reads only the named JSON file. Its directory is the base for root. */
export declare function generateAndroidResourcesFromConfig(configFile: string, options?: {projectRoot?: string}): Promise<GeneratedAndroidResources>;
