import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Apenas módulos locais; transpila para uma pasta temporária ignorada pelo Git.
for (const file of ['types.ts','utils/planner.ts','tests/planner.test.ts']) {
  const output = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const target = path.join('.test-build',file.replace(/\.ts$/,'.js'));
  fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,output);
}
fs.writeFileSync('.test-build/package.json','{"type":"commonjs"}');
require(path.resolve('.test-build/tests/planner.test.js'));
