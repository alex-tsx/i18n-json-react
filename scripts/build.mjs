import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import ts from 'typescript';

const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json');
if (!configPath) throw new Error('tsconfig.json not found');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
if (parsed.errors.length) fail(parsed.errors);
await rm('dist', { recursive: true, force: true });
// Both module formats refer to the same augmentation interface, rather than separate copies.
await mkdir('dist/types', { recursive: true });
await copyFile('types/registry.d.cts', 'dist/types/registry.d.cts');

for (const format of ['esm', 'cjs']) {
  const options = { ...parsed.options, outDir: `dist/${format}` };
  if (format === 'cjs') {
    options.module = ts.ModuleKind.CommonJS;
    options.moduleResolution = ts.ModuleResolutionKind.Node10;
    options.verbatimModuleSyntax = false;
    options.ignoreDeprecations = '6.0';
  }
  const program = ts.createProgram(parsed.fileNames, options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) fail(diagnostics);
  const emitted = program.emit();
  if (emitted.emitSkipped || emitted.diagnostics.length) fail(emitted.diagnostics);
  await mkdir(`dist/${format}`, { recursive: true });
  await writeFile(
    `dist/${format}/package.json`,
    JSON.stringify({ type: format === 'esm' ? 'module' : 'commonjs' }) + '\n',
  );
}

function fail(diagnostics) {
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: file => file,
      getNewLine: () => '\n',
    }),
  );
  process.exit(1);
}
