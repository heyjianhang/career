// Run via npm run test:package after npm ci. Only synthetic data; no GitHub calls.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat,realpath} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkDocumentation} from '../scripts/check-docs.mjs';
const exec=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-package-'));
// A fresh npm ci cache may have tarballs without registry metadata.
// Let npm resolve missing metadata as a first-time installation would.
const env={...process.env,GIT_TERMINAL_PROMPT:'0'};
const run=async(file,args,cwd=root)=>(await exec(file,args,{cwd,env,maxBuffer:8*1024*1024,timeout:300_000})).stdout;
const npm=(args,cwd=root)=>run(process.execPath,[process.env.npm_execpath,...args],cwd);
const jsonCommand=async(cli,cwd,args)=>{
 const result=JSON.parse(await run(process.execPath,[cli,...args,'--json'],cwd));
 assert.equal(result.status,'success');return result.data;
};
try{
 const [packed]=JSON.parse(await npm(['pack','--json','--pack-destination',dir]));
 const names=packed.files.map(f=>f.path);
 for(const file of ['dist/resumes/styles.css','dist/resumes/browser.js','schemas/resume-package.v1.schema.json','dist/board/styles.css','dist/board/icons.json','dist/board/ICONS-LICENSE','dist/board/pdf/pdf.mjs','dist/board/pdf/pdf.worker.mjs','dist/board/pdf/LICENSE'])assert.ok(names.includes(file),'Missing board runtime asset: '+file);
 assert.ok(names.includes('resources/workspace/gitignore.template'),'npm must include the ignore rules');
 const userSkills=['career-setup','career-git','career-intake','resume-master','resume-tailor','career-board'];
 for(const prefix of ['.agents/skills/','resources/workspace/.agents/skills/']){
  const included=[...new Set(names.filter(name=>name.startsWith(prefix)).map(name=>name.slice(prefix.length).split('/')[0]))].sort();
  assert.deepEqual(included,[...userSkills].sort(),'Only user Skills belong in the npm package');
 }
 assert.ok(!names.some(f=>/^(workspace|src|tests|research|\.cache|node_modules|outputs)\//.test(f)),'private and development material must stay outside the package');
 const archive=path.join(dir,packed.filename),bootstrap=path.join(dir,'bootstrap');
 await npm(['install','--prefix',bootstrap,'--ignore-scripts','--no-audit','--no-fund',archive]);
 const bootstrapCli=path.join(bootstrap,'node_modules/@heyjianhang/career/dist/cli.js');
 const workspace=path.join(dir,'我的 career'),args=['setup','--workspace',workspace,'--package-source',archive];
 const initial=await jsonCommand(bootstrapCli,dir,args);assert.equal(initial.dependencies,'installed');
 assert.equal(initial.handoff.action,'open_workspace');assert.equal(initial.handoff.workspace,workspace);
 assert.equal(initial.handoff.entrypoint,path.join(workspace,'AGENTS.md'));assert.ok((await stat(initial.handoff.entrypoint)).isFile());
 assert.equal(initial.handoff.workspace_next_action,initial.next_action);
 assert.ok((await readFile(path.join(workspace,'README.md'),'utf8')).includes(initial.handoff.prompt));
 const retry=await jsonCommand(bootstrapCli,dir,args);assert.equal(retry.agent.conflicts.length,0);assert.deepEqual(retry.handoff,initial.handoff);
 const documentation=await checkDocumentation(workspace);assert.equal(documentation.skills,6);
 assert.ok(!(await stat(path.join(workspace,'.agents/skills/career-release')).catch(()=>null)),'Maintainer release instructions must not be installed');
 for(const name of userSkills)assert.ok((await stat(path.join(workspace,'.agents/skills',name,'SKILL.md'))).isFile());
 assert.match(await readFile(path.join(workspace,'.gitignore'),'utf8'),/node_modules/);
 assert.ok(!(await stat(path.join(workspace,'gitignore.template')).catch(()=>null)));
 const cli=path.join(workspace,'node_modules/@heyjianhang/career/dist/cli.js');
 const command=(...args)=>jsonCommand(cli,workspace,args);
 assert.equal((await command('doctor')).tool_matches,true);
 assert.equal((await command('workspace','check')).valid,true);
 assert.equal((await command('resume','themes')).length,14);
 assert.equal((await command('board','overview')).total,0);
 const spec=await command('opportunity','schema');
 const input=path.join(dir,'opportunity.json');
 await writeFile(input,JSON.stringify(spec.examples.create));
 const op=await command('opportunity','add','--input',input);
 assert.equal((await command('opportunity','context','--id',op.id)).id,op.id);
 const roundInput=path.join(dir,'round.json');await writeFile(roundInput,JSON.stringify({...spec.examples.interview,body:'来自安装包的自由面试记录。'}));
 const round=await command('interview','save','--opportunity',op.id,'--input',roundInput);
 assert.equal((await command('interview','list','--opportunity',op.id)).interviews.length,1);
 assert.equal((await command('interview','context','--opportunity',op.id,'--round',round.id)).selected_interview.body,'来自安装包的自由面试记录。');
 assert.equal((await command('board','check')).valid,true);
 const draft=await command('resume','create','--title','安装包生成的统一简历');
 const read=await command('resume','read','--id',draft.id);assert.equal(read.package.schema,'career-resume-package/v1');
 read.package.synthetic=true;read.package.content.profile.name='安装验证（虚构）';read.package.content.summary='来自真实安装包的编辑内容。';
 const candidate=path.join(dir,'resume-candidate.json');await writeFile(candidate,JSON.stringify(read.package));
 await command('resume','save','--input',candidate,'--if-match',read.sha256);
 const current=await command('opportunity','show','--id',op.id);
 await command('opportunity','resume','--id',op.id,'--resume',draft.id,'--if-match',current.card.sha256);
 assert.equal((await command('resume','relations','--id',draft.id)).jobs.length,1);
 const preview=spawn(process.execPath,[cli,'board','preview','--workspace',workspace,'--json'],{cwd:workspace,env,stdio:['ignore','pipe','pipe']});
 try{
  const ready=await new Promise((resolve,reject)=>{
   let stdout='',stderr='';const timer=setTimeout(()=>reject(new Error('Packaged board did not start: '+stderr)),30_000);
   preview.stdout.on('data',chunk=>{stdout+=String(chunk);try{const value=JSON.parse(stdout);clearTimeout(timer);resolve(value);}catch{}});
   preview.stderr.on('data',chunk=>stderr+=String(chunk));
   preview.once('error',error=>{clearTimeout(timer);reject(error);});
   preview.once('exit',code=>{clearTimeout(timer);reject(new Error('Preview exited '+code+': '+stderr));});
  });
  assert.equal(ready.status,'success');const base=new URL(ready.data.url);
  assert.match(await (await fetch(base)).text(),/岗位概况/);
  assert.equal((await (await fetch(new URL('/api/board/overview',base))).json()).total,1);
  assert.match(await(await fetch(new URL('/',base))).text(),/我的简历/);
  const detailPage=await(await fetch(new URL('/resumes/'+draft.id+'/index.html',base))).text();assert.match(detailPage,/来自真实安装包的编辑内容/);assert.match(detailPage,/编辑内容/);
  const worker=await fetch(new URL('/board-assets/pdf/pdf.worker.mjs',base));assert.equal(worker.status,200);assert.ok((await worker.text()).length>1000);
 }finally{preview.kill();await new Promise(resolve=>{if(preview.exitCode!==null)resolve();else preview.once('exit',resolve);});}
 await command('sync','local');
 await command('resume','save','--input',path.join(workspace,'examples/presentation/package.json'));
 const built=await command('resume','build','--collection');
 assert.ok((await stat(path.join(built.directory,'index.html'))).isFile());
 await command('history','init','--name','Career Package Test','--email','package-test@example.invalid');
 assert.equal((await command('history','save','--message','验证安装包')).saved,true);
 assert.equal((await command('sync','status')).dirty,false);
 console.log(JSON.stringify({package:packed.name,version:packed.version,files:names.length,bytes:packed.size,setup:'passed',retry:'passed',agent_resources:documentation,resume_html:'passed',local_history:'passed'}));
}finally{await rm(dir,{recursive:true,force:true});}
