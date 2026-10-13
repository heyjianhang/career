// Run via npm run test:package after npm ci. Only synthetic data; no GitHub calls.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkDocumentation} from '../scripts/check-docs.mjs';
const exec=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-package-'));
const env={...process.env,npm_config_offline:'true',GIT_TERMINAL_PROMPT:'0'};
const run=async(file,args,cwd=root)=>(await exec(file,args,{cwd,env,maxBuffer:8*1024*1024,timeout:300_000})).stdout;
const npm=(args,cwd=root)=>run(process.execPath,[process.env.npm_execpath,...args],cwd);
const jsonCommand=async(cli,cwd,args)=>{
 const result=JSON.parse(await run(process.execPath,[cli,...args,'--json'],cwd));
 assert.equal(result.status,'success');return result.data;
};
try{
 const [packed]=JSON.parse(await npm(['pack','--json','--pack-destination',dir]));
 const names=packed.files.map(f=>f.path);
 assert.ok(names.includes('resources/workspace/gitignore.template'),'npm must include the ignore rules');
 assert.ok(!names.some(f=>/^(workspace|src|tests|research|\.cache|node_modules|outputs)\//.test(f)),'private and development material must stay outside the package');
 const archive=path.join(dir,packed.filename),bootstrap=path.join(dir,'bootstrap');
 await npm(['install','--prefix',bootstrap,'--ignore-scripts','--no-audit','--no-fund',archive]);
 const bootstrapCli=path.join(bootstrap,'node_modules/@heyjianhang/career/dist/cli.js');
 const workspace=path.join(dir,'我的 career'),args=['setup','--workspace',workspace,'--package-source',archive];
 const initial=await jsonCommand(bootstrapCli,dir,args);assert.equal(initial.dependencies,'installed');
 const retry=await jsonCommand(bootstrapCli,dir,args);assert.equal(retry.agent.conflicts.length,0);
 const documentation=await checkDocumentation(workspace);assert.equal(documentation.skills,5);
 for(const name of ['career-setup','career-git','career-intake','resume-master','resume-tailor'])assert.ok((await stat(path.join(workspace,'.agents/skills',name,'SKILL.md'))).isFile());
 assert.match(await readFile(path.join(workspace,'.gitignore'),'utf8'),/node_modules/);
 assert.ok(!(await stat(path.join(workspace,'gitignore.template')).catch(()=>null)));
 const cli=path.join(workspace,'node_modules/@heyjianhang/career/dist/cli.js');
 const command=(...args)=>jsonCommand(cli,workspace,args);
 assert.equal((await command('doctor')).tool_matches,true);
 assert.equal((await command('workspace','check')).valid,true);
 assert.equal((await command('resume','themes')).length,14);
 await command('sync','local');
 await command('resume','save','--input',path.join(workspace,'examples/presentation/package.json'));
 const built=await command('resume','build','--collection');
 assert.ok((await stat(path.join(built.directory,'index.html'))).isFile());
 await command('history','init','--name','Career Package Test','--email','package-test@example.invalid');
 assert.equal((await command('history','save','--message','验证安装包')).saved,true);
 assert.equal((await command('sync','status')).dirty,false);
 console.log(JSON.stringify({package:packed.name,version:packed.version,files:names.length,bytes:packed.size,setup:'passed',retry:'passed',agent_resources:documentation,resume_html:'passed',local_history:'passed'}));
}finally{await rm(dir,{recursive:true,force:true});}
