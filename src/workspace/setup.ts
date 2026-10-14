import {readFile,writeFile,mkdir,readdir,rename,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {root,json,hash,noSymlinks} from '../presentation/io.js';
import {initializeWorkspace} from '../agent-api.js';
import {available,metadata,npm,SetupError} from './process.js';

export async function discoverWorkspace(explicit?:string){
  if(explicit)return path.resolve(explicit);
  let dir=process.cwd();
  while(true){try{if((await stat(path.join(dir,'career.json'))).isFile())return dir;}catch{}
    const parent=path.dirname(dir);if(parent===dir)break;dir=parent;
  }
  throw new SetupError('WORKSPACE_REQUIRED','请在个人工作区运行，或传入 --workspace <目录>。首次使用运行 career setup --workspace <新目录>。');
}
export async function config(workspace:string){const value=await json<Record<string,any>>(path.join(workspace,'career.json'));if(value.schema!=='career-workspace/v1')throw new SetupError('WORKSPACE_INVALID','不支持的工作区格式。');return value;}
export async function withLock<T>(workspace:string,fn:()=>Promise<T>){
  await noSymlinks(workspace);const dir=path.join(workspace,'.local');await noSymlinks(dir);await mkdir(dir,{recursive:true});const lock=path.join(dir,'operation.lock');
  try{await writeFile(lock,JSON.stringify({pid:process.pid,at:new Date().toISOString()}),{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw new SetupError('WORKSPACE_BUSY','工作区正在执行保存或同步；先确认现有操作结束。');throw e;}
  try{return await fn();}finally{await rm(lock,{force:true});}
}
export async function updateConfig(workspace:string,change:(value:Record<string,any>)=>void){
  const file=path.join(workspace,'career.json'),before=await readFile(file,'utf8'),value=JSON.parse(before);change(value);
  const tmp=file+'.'+randomUUID()+'.tmp';
  try{await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});if(await readFile(file,'utf8')!==before)throw new SetupError('WORKSPACE_CHANGED','配置被另一进程修改，请重新读取。');await rename(tmp,file);}finally{await rm(tmp,{force:true});}
}
async function files(dir:string,base=dir):Promise<string[]>{const result:string[]=[];for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())result.push(...await files(file,base));else if(item.isFile())result.push(path.relative(base,file).split(path.sep).join('/'));}return result;}
export async function installAgent(workspace:string){
  await config(workspace);
  return withLock(workspace,async()=>{
    const source=path.join(root,'resources/workspace'),manifest=path.join(workspace,'.career/managed.json');await noSymlinks(manifest);
    let old:{files:Record<string,string>}={files:{}};try{old=await json(manifest);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    const installed:string[]=[],preserved:string[]=[],conflicts:string[]=[],digests={...old.files};
    for(const resource of await files(source)){
      const relative=resource==='gitignore.template'?'.gitignore':resource;
      const target=path.join(workspace,relative),bytes=await readFile(path.join(source,resource));await noSymlinks(target);
      let current:Buffer|undefined;try{current=await readFile(target);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
      if(current&&hash(current)!==hash(bytes)&&hash(current)!==old.files[relative]){conflicts.push(relative);continue;}
      if(current&&hash(current)===hash(bytes)){preserved.push(relative);}else{await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);installed.push(relative);}digests[relative]=hash(bytes);
    }
    await mkdir(path.dirname(manifest),{recursive:true});await writeFile(manifest,JSON.stringify({schema:'career-managed/v1',tool:await metadata(),files:digests},null,2)+'\n');
    return {installed,preserved,conflicts,next_reads:[path.join(workspace,'AGENTS.md'),path.join(workspace,'.agents/skills/career-setup/SKILL.md')]};
  });
}
export async function setup(workspace:string,install=true,packageSource?:string){
  await noSymlinks(workspace);
  // A program installation must never become the user's data directory.
  if(workspace===path.resolve(root)||workspace.startsWith(path.resolve(root)+path.sep))throw new SetupError('PROGRAM_DIRECTORY','请选择程序安装目录之外的独立个人目录。');
  try{const entries=await readdir(workspace);if(entries.length&&!entries.includes('career.json'))throw new SetupError('DIRECTORY_NOT_EMPTY','目录已有文件且不是 career 工作区；请选择新目录或先核对已有数据。');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const initialized=await initializeWorkspace(workspace),tool=await metadata();
  await withLock(workspace,async()=>{
    await updateConfig(workspace,value=>{value.tool??={name:tool.name,version:tool.version};value.onboarding??={sync:'undecided'};});
    const packageFile=path.join(workspace,'package.json');await noSymlinks(packageFile);
    try{const p=await json<any>(packageFile);const dep=p.dependencies?.[tool.name];const localPackage=packageSource&&typeof dep==='string'&&dep.startsWith('file:')&&path.resolve(workspace,dep.slice(5))===path.resolve(packageSource);if(p.private!==true||(dep!==tool.version&&!localPackage))throw new SetupError('TOOL_VERSION_MISMATCH','已有工作区工具版本不同或 package.json 已自定义；按锁定版本恢复，不自动覆盖。');}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await writeFile(packageFile,JSON.stringify({name:'my-career-workspace',private:true,scripts:{career:'career'},dependencies:{[tool.name]:tool.version}},null,2)+'\n',{flag:'wx'});}
  });
  const agent=await installAgent(workspace);
  if(install){if(packageSource)await npm(['install','--ignore-scripts','--no-audit','--no-fund','--save-exact',path.resolve(packageSource)],workspace);else {let locked=false;try{await stat(path.join(workspace,'package-lock.json'));locked=true;}catch{}await npm([locked?'ci':'install','--ignore-scripts','--no-audit','--no-fund'],workspace);}}
  const state=await config(workspace),nextAction=agent.conflicts.length?'resolve_agent_files':onboardingAction(state);
  // Installation clients hand off first; next_action remains the task for the workspace conversation.
  const handoff=install&&!agent.conflicts.length?{workspace,entrypoint:path.join(workspace,'AGENTS.md'),
    action:'open_workspace',prompt:'请读取当前工作区的 AGENTS.md，按已有进度引导我开始使用 career。',
    steps:['在 Agent 软件中打开此目录或添加为现有项目。','在该工作区中新建对话，发送 prompt。'],
    workspace_next_action:nextAction}:null;
  return {workspace,initialized,agent,tool,dependencies:install?'installed':'skipped',next_reads:agent.next_reads,next_action:nextAction,questions:nextAction==='choose_sync'?['是否把资料同步到自己的 GitHub 私人仓库？也可以先仅保存在本机。']:[],handoff};
}
function onboardingAction(state:Record<string,any>){
  const mode=state.onboarding?.sync;
  return !mode||mode==='undecided'?'choose_sync':mode==='connected'?'check_sync':'read_context';
}
export async function doctor(workspace?:string){
  const tool=await metadata(),git=await available('git'),gh=await available('gh');let state:any=null;if(workspace){try{state=await config(workspace);}catch{}}
  return {tool,node:process.version,node_supported:Number(process.versions.node.split('.')[0])>=22,git,github_cli:gh,workspace:workspace??null,initialized:Boolean(state),onboarding:state?.onboarding??null,tool_matches:!state?.tool||state.tool.version===tool.version,next_action:!state?'setup':onboardingAction(state)};
}
export async function localOnly(workspace:string){return withLock(workspace,async()=>{await updateConfig(workspace,c=>{c.onboarding={...c.onboarding,sync:'local'};});return {mode:'local',next_action:'resume_intake'};});}
