import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,mkdir,rm,writeFile,realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import runtime from '../desktop/runtime.cjs';
import {noSymlinks} from '../dist/presentation/io.js';

test('desktop CLI launcher pins its own folder, including spaces and shell metacharacters',async t=>{
 const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),'career-bound-')));t.after(()=>rm(temp,{recursive:true,force:true}));
 const workspace=path.join(temp,"我的资料 ' $ `&% !"),appRoot=path.join(temp,'Application Space');await mkdir(workspace);await mkdir(appRoot);
 await writeFile(path.join(appRoot,'runner.cjs'),`console.log(JSON.stringify({argv:process.argv.slice(2),mode:process.env.ELECTRON_RUN_AS_NODE}));`);
 const entry=await runtime.prepareRuntime(workspace,{executable:process.execPath,appRoot,coreRoot:appRoot,noSymlinks});
 if(process.platform!=='win32'){
  const run=spawnSync(entry.command,['doctor','--json'],{encoding:'utf8',cwd:temp});assert.equal(run.status,0,run.stderr);
  assert.deepEqual(JSON.parse(run.stdout),{argv:['--workspace',workspace,'doctor','--json'],mode:'1'});
 }
 const info=JSON.parse(await readFile(path.join(workspace,'.local/desktop-runtime.json')));assert.equal(info.workspace,workspace);
 await runtime.prepareRuntime(workspace,{executable:process.execPath,appRoot,coreRoot:appRoot,noSymlinks});
 assert.deepEqual(runtime.boundArguments(['--workspace',workspace,'doctor','--json']),{workspace,args:['doctor','--json']});
 for(const args of [['--workspace',temp],['--workspace='+temp],['setup'],['workspace','restore']])assert.throws(()=>runtime.boundArguments(['--workspace',workspace,...args]));
 assert.throws(()=>runtime.boundArguments(['--workspace','relative','doctor']));
 assert.match(runtime.handoffPrompt(workspace,'win32'),/career\.cmd/);assert.match(runtime.handoffPrompt(workspace,'darwin'),/\.local\/career/);
});
