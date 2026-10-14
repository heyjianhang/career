import {cp,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const [run,id,label]=process.argv.slice(2);
if(!run||!path.isAbsolute(run)||![id,label].every(x=>/^[a-z0-9-]+$/.test(x??'')))throw new Error('用法：node scripts/snapshot-agent-simulation.mjs <运行绝对目录> <case-id> <检查点名>');
await access(path.join(run,'manifest.json'));
const workspace=path.join(run,'workspaces',id),dest=path.join(run,'snapshots',id,label);
try{await access(dest);throw new Error('检查点已经存在，禁止覆盖');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(dest,{recursive:true});
for(const name of ['context','resume','opportunities','career.json','.local/dialogue.md']){
 try{await access(path.join(workspace,name));}catch(e){if(e.code==='ENOENT')continue;throw e;}
 await cp(path.join(workspace,name),path.join(dest,name),{recursive:true});
}
const results={};
for(const [name,args] of [['workspace',['workspace','check']],['board',['board','check']],['overview',['board','overview']]]){
 try{results[name]=JSON.parse(execFileSync(process.execPath,[path.join(run,'package/dist/cli.js'),...args,'--workspace',workspace,'--json'],{encoding:'utf8',maxBuffer:8*1024*1024}));}
 catch(e){const body=e.stdout||e.stderr;try{results[name]=JSON.parse(body);}catch{results[name]={error:'读取或校验失败',exit_code:e.status};}}
}
await writeFile(path.join(dest,'checks.json'),JSON.stringify({captured_at:new Date().toISOString(),case:id,label,results},null,2));
console.log(dest);
