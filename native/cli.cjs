#!/usr/bin/env node
const { prepareNativeI18n } = require('./prepare.cjs');

function runCLI(command = 'i18n-json-react-native') {
  main(command).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

async function main(command) {
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
        `${command} [--project-root DIR] [--root DIR] [--out DIR] [--dir DIR] [--exclude GLOB] [--language CODE]\nRepeat --dir, --exclude and --language as needed.\n`,
      );
      return;
    }
    const key = values.get(flag);
    const value = args[++index];
    if (!key || !value || value.startsWith('--')) throw new Error(`Invalid option: ${flag}`);
    if (['dirs', 'exclude', 'languages'].includes(key)) (options[key] ??= []).push(value);
    else options[key] = value;
  }
  const result = await prepareNativeI18n(options);
  process.stdout.write(
    `Prepared ${result.references.size} feature dictionaries for ${result.languages.join(', ')} in ${result.outputDir}\n`,
  );
}

module.exports = { runCLI };
if (require.main === module) runCLI();
