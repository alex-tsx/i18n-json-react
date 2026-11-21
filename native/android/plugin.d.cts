import type {ConfigPlugin} from '@expo/config-plugins';
/** Path is relative to the Expo app directory; root and dictionary paths are relative to the JSON config. */
declare const withAndroidResources: ConfigPlugin<{config: string}>;
export = withAndroidResources;
