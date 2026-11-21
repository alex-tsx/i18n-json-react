#!/usr/bin/env node
const {generateAndroidResourcesFromConfig} = require('./resources.cjs');

async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write('i18n-json-react-android-resources --config FILE.json\nExport feature translations as Android XML string resources. Paths are relative to the config file.\n');
    return;
  }
  if (args.length !== 2 || args[0] !== '--config' || !args[1] || args[1].startsWith('--')) throw new Error('Usage: i18n-json-react-android-resources --config FILE.json');
  const result = await generateAndroidResourcesFromConfig(args[1]);
  process.stdout.write(`Generated ${result.files.length} Android resource files for ${result.languages.join(', ')}\n`);
}
if (require.main === module) main().catch(error => {console.error(error.message); process.exitCode = 1;});
module.exports = {main};
