import {cp,mkdir,access,writeFile} from 'node:fs/promises';
import path from 'node:path';

const [run,from,to]=process.argv.slice(2);
if(!run||!path.isAbsolute(run)||![from,to].every(x=>/^[a-z0-9-]+$/.test(x??''))||from===to)throw new Error('用法：node scripts/fork-agent-simulation.mjs <运行绝对目录> <来源case> <新case>');
await access(path.join(run,'manifest.json'));
const source=path.join(run,'workspaces',from),destination=path.join(run,'workspaces',to);
try{await access(destination);throw new Error('目标已存在，禁止覆盖');}catch(e){if(e.code!=='ENOENT')throw e;}
await cp(source,destination,{recursive:true,filter:entry=>!path.relative(source,entry).split(path.sep).some(p=>['.git','.local','node_modules'].includes(p))});
await mkdir(path.join(destination,'.local'),{recursive:true});
await writeFile(path.join(run,`${to}-fork.json`),JSON.stringify({from,to,copied_at:new Date().toISOString(),excluded:['.git','.local','node_modules'],reason:'新 Agent 仅从正常工作区文件恢复；不提供上一 Agent 的聊天回放或执行脚本'},null,2));
console.log(destination);
