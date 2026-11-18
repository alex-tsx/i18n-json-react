#!/usr/bin/env node
const { prepareAndroidI18n } = require('./prepare.cjs');

async function main() {
  const options = {};
  const values = new Map([
    ['--project-root', 'projectRoot'],
    ['--root', 'root'],
    ['--out', 'outputDir'],
    ['--dir', 'dirs'],
    ['--exclude', 'exclude'],
    ['--language', 'languages'],
  ]);
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--help') {
      process.stdout.write(
        'i18n-json-react-android [--project-root DIR] [--root DIR] [--out DIR] [--dir DIR] [--exclude GLOB] [--language CODE]\nRepeat --dir, --exclude and --language as needed.\n',
      );
      return;
    }
    const key = values.get(flag);
    const value = args[++index];
    if (!key || !value || value.startsWith('--')) throw new Error(`Invalid option: ${flag}`);
    if (['dirs', 'exclude', 'languages'].includes(key)) (options[key] ??= []).push(value);
    else options[key] = value;
  }
  const result = await prepareAndroidI18n(options);
  process.stdout.write(
    `Prepared ${result.references.size} feature dictionaries for ${result.languages.join(', ')} in ${result.outputDir}\n`,
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
