import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {root} from '../presentation/io.js';
export const exec=promisify(execFile);
export class SetupError extends Error { constructor(public code:string,message:string,public details:unknown=null){super(message);} }
export async function run(file:string,args:string[],cwd:string,timeout=60_000){
  const env={...process.env,GIT_TERMINAL_PROMPT:'0',GH_PROMPT_DISABLED:'true'};
  for(const key of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR'])delete (env as NodeJS.ProcessEnv)[key];
  try {return (await exec(file,args,{cwd,timeout,maxBuffer:8*1024*1024,windowsHide:true,env})).stdout.trim();}
  catch(e){const error=e as NodeJS.ErrnoException;throw new SetupError(error.code==='ENOENT'?'DEPENDENCY_MISSING':'COMMAND_FAILED',`${file} 执行失败；检查安装、登录或网络。`,{command:file,args:args.filter(a=>!a.includes('token')),reason:error.code??'exit'});}
}
export async function available(file:string,args=['--version']) {try{return await run(file,args,root,10_000);}catch{return null;}}
export async function metadata(){const {name,version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')) as {name:string;version:string};return {name,version};}
export async function npm(args:string[],cwd:string){
  const env=process.env.npm_execpath;
  const candidates=[env&&path.join(path.dirname(env),'npm-cli.js'),path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),path.resolve(path.dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean) as string[];
  for(const candidate of candidates){try{await access(candidate);}catch{continue;}return run(process.execPath,[candidate,...args],cwd,300_000);}
  if(process.platform!=='win32')return run('npm',args,cwd,300_000);
  throw new SetupError('NPM_MISSING','未找到 npm；请安装 Node.js 官方发行版后重试。');
}
export async function installPdf(){const require=createRequire(import.meta.url);const cli=path.join(path.dirname(require.resolve('playwright/package.json')),'cli.js');await run(process.execPath,[cli,'install','chromium'],root,600_000);return {installed:'chromium'};}
