import {readFile,writeFile,mkdir,readdir,realpath,stat,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {config,setup,withLock,updateConfig} from './setup.js';
import {hash,noSymlinks,root} from '../presentation/io.js';

export type WorkspaceEntry={id:string;path:string;name:string;last_opened:string;available:boolean};
type Registry={schema:'career-local-workspaces/v1';recent:WorkspaceEntry[];last_workspace?:string};
export type LocalSession={url:string;close:()=>Promise<void>};
export class WorkspaceManager {
 readonly sessions=new Map<string,Promise<LocalSession>>();
 readonly origins=new Set<string>();
 prepare?: (workspace:string)=>Promise<void>;
 readonly registryFile:string;
 constructor(registryFile=process.env.CAREER_LOCAL_SETTINGS??path.join(os.homedir(),'.career','workspaces.json')){this.registryFile=path.resolve(registryFile);}
 async readRegistry():Promise<Registry>{
  await noSymlinks(this.registryFile);
  try{const r=JSON.parse(await readFile(this.registryFile,'utf8'));if(r.schema!=='career-local-workspaces/v1'||!Array.isArray(r.recent)||r.recent.some((e:any)=>typeof e.path!=='string'||!path.isAbsolute(e.path)||typeof e.name!=='string'||typeof e.id!=='string'))throw new Error('本机工作区记录格式无效，请先保留并检查 '+this.registryFile);return r;}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {schema:'career-local-workspaces/v1',recent:[]};throw e;}
 }
 async changeRegistry(change:(r:Registry)=>void){
  await noSymlinks(this.registryFile);await mkdir(path.dirname(this.registryFile),{recursive:true});const lock=this.registryFile+'.lock';let acquired=false;
  for(let i=0;i<80;i++){try{await writeFile(lock,String(process.pid),{flag:'wx',mode:0o600});acquired=true;break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,25));}}
  if(!acquired)throw new Error('工作区列表正在更新，请稍后重试');
  const temp=this.registryFile+'.'+randomUUID()+'.tmp';
  try{const r=await this.readRegistry();change(r);await writeFile(temp,JSON.stringify(r,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temp,this.registryFile);}
  finally{await rm(temp,{force:true});await rm(lock,{force:true});}
 }
 async entry(directory:string):Promise<WorkspaceEntry>{
  if(typeof directory!=='string'||!path.isAbsolute(directory))throw new Error('请选择完整的文件夹路径');
  await noSymlinks(directory);let canonical:string;
  try{canonical=await realpath(directory);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new Error('找不到这个文件夹，可能已移动或删除');throw e;}
  let value:Record<string,any>;
  try{value=await config(canonical);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new Error('这个文件夹还不是 career 工作区。请选择已有工作区，或返回创建新工作区。');throw e;}
  return {id:hash(canonical).slice(0,24),path:canonical,name:typeof value.name==='string'&&value.name.trim()?value.name:path.basename(canonical),last_opened:new Date().toISOString(),available:true};
 }
 async remember(directory:string,replaceId?:string){
  const entry=await this.entry(directory);await this.changeRegistry(r=>{r.recent=[entry,...r.recent.filter(e=>e.id!==entry.id&&e.id!==replaceId)].slice(0,50);r.last_workspace=entry.id;});return entry;
 }
 async list(current:string){
  const entry=await this.entry(current),registry=await this.readRegistry();
  const recent=await Promise.all(registry.recent.map(async e=>{try{return {...await this.entry(e.path),last_opened:e.last_opened};}catch{return {...e,available:false};}}));
  if(!recent.some(e=>e.id===entry.id))recent.unshift(entry);
  return {current:entry,recent,default_location:path.dirname(entry.path)};
 }
 async browse(directory:string){
  if(typeof directory!=='string'||!path.isAbsolute(directory))throw new Error('请输入完整的文件夹路径');await noSymlinks(directory);
  const canonical=await realpath(directory);const entries=await readdir(canonical,{withFileTypes:true});
  return {path:canonical,parent:path.dirname(canonical),directories:entries.filter(e=>e.isDirectory()&&!e.name.startsWith('.')&&!['node_modules','Library','$RECYCLE.BIN','System Volume Information'].includes(e.name)).map(e=>({name:e.name,path:path.join(canonical,e.name)})).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'))};
 }
 async create(parent:string,name:string){
  const title=validName(name);if(/[<>:"/\\|?*\x00-\x1f]|[. ]$/.test(title)||/^\.+$/.test(title)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(title))throw new Error('名称不能包含路径分隔符、特殊文件名或末尾句点');
  const location=(await this.browse(parent)).path;
  for(let ancestor=location;;ancestor=path.dirname(ancestor)){
   try{await stat(path.join(ancestor,'career.json'));throw new Error('请选择现有工作区之外的位置，工作区不能嵌套');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   if(path.dirname(ancestor)===ancestor)break;
  }
  const directory=path.join(location,title);
  if(directory===path.resolve(root)||directory.startsWith(path.resolve(root)+path.sep))throw new Error('请选择程序安装目录之外的位置');
  // Claim only a new directory. Never initialise or overwrite an existing folder.
  try{await mkdir(directory);}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw new Error('这里已经有同名文件夹，请换个名称，或使用“打开已有工作区”');throw e;}
  try{
   await setup(directory,false);
   await withLock(directory,()=>updateConfig(directory,c=>{c.name=title;}));
   if(this.prepare)await this.prepare(directory);else await attachLocalRuntime(directory);
   return await this.remember(directory);
  }catch(e){throw new Error('创建未完成，已保留文件夹 '+directory+'。'+(e as Error).message);}
 }
 async renameWorkspace(directory:string,name:string,previous:string){
  const title=validName(name);await withLock(directory,async()=>{const e=await this.entry(directory);if(e.name!==previous)throw new Error('工作区名称已改变，请重新打开设置后修改');await updateConfig(directory,c=>{c.name=title;});});return this.remember(directory);
 }
 async close(){const results=await Promise.allSettled(this.sessions.values());await Promise.all(results.filter((r):r is PromiseFulfilledResult<LocalSession>=>r.status==='fulfilled').map(r=>r.value.close()));this.sessions.clear();}
}
function validName(value:unknown){if(typeof value!=='string'||!value.trim()||value.trim().length>60||/[\x00-\x1f]/.test(value))throw new Error('名称请填写 1–60 个字符');return value.trim();}
async function attachLocalRuntime(workspace:string){
 // The browser-created folder reuses this installation, without downloading a different CLI version.
 // A relocated folder can fall back to its own npm installation; machine paths stay gitignored.
 await writeFile(path.join(workspace,'.local/runtime.json'),JSON.stringify({node:process.execPath,cli:path.join(root,'dist/cli.js')}));
 const runner=`import {readFileSync,existsSync} from 'node:fs';\nimport {spawnSync} from 'node:child_process';\nimport {fileURLToPath} from 'node:url';\nlet runtime;try{runtime=JSON.parse(readFileSync(new URL('../.local/runtime.json',import.meta.url),'utf8'));}catch{}\nconst installed=fileURLToPath(new URL('../node_modules/@heyjianhang/career/dist/cli.js',import.meta.url));\nconst cli=runtime&&existsSync(runtime.node)&&existsSync(runtime.cli)?runtime.cli:installed;\nconst node=cli===installed?process.execPath:runtime.node;\nif(!existsSync(cli)){console.error('请先在工作区执行 npm install --ignore-scripts，再重新运行。');process.exit(1);}\nconst result=spawnSync(node,[cli,...process.argv.slice(2)],{stdio:'inherit',cwd:fileURLToPath(new URL('../',import.meta.url))});\nif(result.error)console.error(result.error.message);process.exit(result.status??1);\n`;
 await writeFile(path.join(workspace,'.career/run.mjs'),runner,{flag:'wx'});
 const packageFile=path.join(workspace,'package.json'),pkg=JSON.parse(await readFile(packageFile,'utf8'));pkg.scripts.career='node .career/run.mjs';await writeFile(packageFile,JSON.stringify(pkg,null,2)+'\n');
}
export async function revealFolder(directory:string){
 const command=process.platform==='darwin'?'open':process.platform==='win32'?'explorer.exe':'xdg-open';
 await new Promise<void>((resolve,reject)=>{const child=spawn(command,[directory],{stdio:'ignore'});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
}
