const {withDangerousMod} = require('@expo/config-plugins');
const {generateAndroidResourcesFromConfig} = require('./resources.cjs');

/** Generate native resources during Expo Android prebuild, before Gradle reads module sources. */
function withAndroidResources(config, options) {
  if (!options || typeof options.config !== 'string' || !options.config.trim()) throw new Error('Android resources plugin requires a JSON config path');
  if (Object.keys(options).some(key => key !== 'config')) throw new Error('Unknown Android resources plugin option');
  return withDangerousMod(config, ['android', async mod => {
    await generateAndroidResourcesFromConfig(options.config, {projectRoot: mod.modRequest.projectRoot});
    return mod;
  }]);
}
module.exports = withAndroidResources;
