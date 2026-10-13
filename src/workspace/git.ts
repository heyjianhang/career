import {mkdir,stat,realpath,readdir} from 'node:fs/promises';
import path from 'node:path';
import {config,withLock,updateConfig} from './setup.js';
import {run,SetupError} from './process.js';
import {inspectWorkspace} from '../agent-api.js';
import {noSymlinks} from '../presentation/io.js';
const git=(dir:string,...args:string[])=>run('git',['-c','core.hooksPath=','-c','commit.gpgsign=false','-c','core.quotepath=false',...args],dir);
const managed=['career.json','package.json','package-lock.json','AGENTS.md','README.md','.gitignore','.gitattributes','.career','.agents','docs','schemas','examples','context','resume','job-search','archive'];
function allowed(file:string){return managed.includes(file.split('/')[0]!)&&!/(^|\/)(\.env(?:\..*)?|\.npmrc|\.DS_Store|node_modules|build|\.local|\.cache)(\/|$)/.test(file)&&!/(\.log|\.tmp|\.lock)$/.test(file);}
async function hasHead(w:string){try{await git(w,'rev-parse','--verify','HEAD');return true;}catch{return false;}}
export async function assertRepo(w:string){
  await config(w);await noSymlinks(path.join(w,'.git'));
  let top:string;try{top=await git(w,'rev-parse','--show-toplevel');}catch{throw new SetupError('GIT_NOT_INITIALIZED','先运行 career history init 初始化本地版本。');}
  if(await realpath(top)!==await realpath(w))throw new SetupError('FOREIGN_REPOSITORY','工作区不能复用上级目录的 Git 仓库。');
  if(await git(w,'branch','--show-current')!=='main')throw new SetupError('BRANCH_MISMATCH','个人资料仓库需要 main；已有分支与历史未更改。');
  for(const marker of ['MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD','rebase-merge','rebase-apply']){try{await stat(path.join(w,'.git',marker));throw new SetupError('GIT_OPERATION_PENDING','已有 Git 合并或恢复未完成，请先处理。');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
}
export async function initHistory(w:string,name?:string,email?:string){
  await config(w);await noSymlinks(path.join(w,'.git'));
  return withLock(w,async()=>{
    let top:string|null=null;try{top=await git(w,'rev-parse','--show-toplevel');}catch{}
    if(top&&await realpath(top)!==await realpath(w))throw new SetupError('FOREIGN_REPOSITORY','此目录位于另一个 Git 仓库内；请使用独立目录。');
    if(!top)await git(w,'init','--initial-branch=main');
    await assertRepo(w);
    if(name){if(/[\r\n]/.test(name))throw new SetupError('INVALID_IDENTITY','提交姓名不能换行');await git(w,'config','--local','user.name',name);}
    if(email){if(!/^[^\s@]+@[^\s@]+$/.test(email))throw new SetupError('INVALID_IDENTITY','请提供有效提交邮箱，可使用 GitHub 的隐私邮箱。');await git(w,'config','--local','user.email',email);}
    let identity=true;try{await git(w,'var','GIT_AUTHOR_IDENT');}catch{identity=false;}
    return {initialized:true,branch:'main',identity_ready:identity,next_action:identity?'history_save':'provide_commit_identity'};
  });
}
async function scan(dir:string){await noSymlinks(dir);const info=await stat(dir);if(info.isDirectory()){for(const item of await readdir(dir))await scan(path.join(dir,item));}else if(info.size>25*1024*1024)throw new SetupError('FILE_TOO_LARGE','有超过 25 MiB 的文件，请选择单独保存或缩小后再同步。');}
async function validate(w:string){const result=await inspectWorkspace(w);if(!result.valid)throw new SetupError('WORKSPACE_INVALID','资料结构未通过检查；原文件保留。',{errors:result.errors});return result;}
async function checkTracked(w:string){
  const tracked=(await git(w,'ls-files','-z')).split('\0').filter(Boolean);
  if(tracked.some(f=>!allowed(f)))throw new SetupError('UNMANAGED_TRACKED_FILES','仓库跟踪了管理范围以外的文件，请先检查，未自动提交或上传。');
}
export async function saveHistory(w:string,message:string){
  if(!message.trim()||message.length>200||/[\r\n]/.test(message))throw new SetupError('INVALID_MESSAGE','提供不超过 200 字的一行版本说明。');
  return withLock(w,async()=>{
    await assertRepo(w);await validate(w);
    try{await git(w,'var','GIT_AUTHOR_IDENT');}catch{throw new SetupError('GIT_IDENTITY_REQUIRED','先通过 history init --name 和 --email 设置本仓库提交身份。');}
    await checkTracked(w);
    const candidates=(await git(w,'ls-files','--cached','--others','--exclude-standard','-z')).split('\0').filter(Boolean);
    const selected=[...new Set(candidates.filter(allowed))];
    for(const file of selected){try{await scan(path.join(w,file));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
    // Exact file arguments include tracked deletions; unmanaged files are left untouched.
    for(let i=0;i<selected.length;i+=100)await git(w,'add','-A','--',...selected.slice(i,i+100));
    const changed=Boolean(await git(w,'diff','--cached','--name-only'));
    if(changed)await git(w,'commit','-m',message);
    return {saved:changed,commit:await hasHead(w)?await git(w,'rev-parse','HEAD'):null,ignored_unmanaged:candidates.filter(f=>!allowed(f)),next_action:'offer_sync_at_milestone'};
  });
}
export async function historyList(w:string){await assertRepo(w);if(!await hasHead(w))return {entries:[]};const text=await git(w,'log','-30','--format=%H%x09%aI%x09%s');return {entries:text.split('\n').map(line=>{const [commit,date,...title]=line.split('\t');return {commit,date,title:title.join('\t')};})};}
export async function gitStatus(w:string){
  await assertRepo(w);const dirty=Boolean(await git(w,'status','--porcelain'));
  let ahead=0,behind=0,remote=false;
  if(await hasHead(w)){try{const counts=await git(w,'rev-list','--left-right','--count','HEAD...refs/remotes/origin/main');[ahead,behind]=counts.split(/\s+/).map(Number) as [number,number];remote=true;}catch{}}
  return {dirty,ahead,behind,remote_head_known:remote,diverged:ahead>0&&behind>0};
}
export function githubRepo(value:string){
  const match=value.match(/^(?:https:\/\/github\.com\/|git@github\.com:)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if(!match||!/[A-Za-z0-9]/.test(match[1]![0]!)||!/[A-Za-z0-9_]/.test(match[2]![0]!))throw new SetupError('INVALID_REMOTE','提供 GitHub 的 owner/repository 或标准仓库地址。');
  return `${match[1]}/${match[2]}`;
}
export function requirePrivateRepository(data:any){
  if(data.private!==true||data.permissions?.push!==true)throw new SetupError('PRIVATE_REPOSITORY_REQUIRED','仅连接当前账号有写权限的 GitHub 私人仓库。');return data;
}
async function remoteInfo(w:string,repo:string){
  const data=JSON.parse(await run('gh',['api',`repos/${repo}`],w));
  return requirePrivateRepository(data);
}
async function verifyRemote(w:string){
  const c=await config(w);if(!c.sync?.repository)throw new SetupError('SYNC_NOT_CONNECTED','尚未连接远程仓库；运行 sync connect 或先仅保存本地。');
  const repo=githubRepo(c.sync.repository);await remoteInfo(w,repo);
  const fetchUrl=await git(w,'remote','get-url','--all','origin'),pushUrl=await git(w,'remote','get-url','--push','--all','origin');
  if(fetchUrl.includes('\n')||pushUrl.includes('\n')||githubRepo(fetchUrl)!==repo||githubRepo(pushUrl)!==repo)throw new SetupError('REMOTE_CHANGED','远端地址已改变，请重新核对同步目标。');
  return repo;
}
export async function connect(w:string,repository:string,create=false){
  const repo=githubRepo(repository);
  return withLock(w,async()=>{
    await assertRepo(w);
    let origin:string|null=null;try{origin=await git(w,'remote','get-url','--all','origin');}catch{}
    if(origin&&(origin.includes('\n')||githubRepo(origin)!==repo))throw new SetupError('REMOTE_EXISTS','已有不同的 origin；未替换。');
    if(create)await run('gh',['repo','create',repo,'--private'],w);
    await remoteInfo(w,repo);
    const branches=JSON.parse(await run('gh',['api',`repos/${repo}/branches?per_page=1`],w));
    if(branches.length&&(await config(w)).sync?.repository!==repo)throw new SetupError('REMOTE_NOT_EMPTY','远端已有内容，请使用 workspace restore 恢复到新目录，再合并需要保留的本机资料。');
    if(!origin)await git(w,'remote','add','origin',`https://github.com/${repo}.git`);
    // HTTPS credentials remain in gh's credential store; no tokens in repository files.
    await git(w,'config','--local','credential.https://github.com.helper','!gh auth git-credential');
    await updateConfig(w,c=>{c.sync={...c.sync,repository:repo,mode:'ask'};c.onboarding={...c.onboarding,sync:'connected'};});
    return {repository:repo,visibility:'private',mode:'ask',pushed:false,next_action:'save_then_sync_push'};
  });
}
async function fetch(w:string){await git(w,'fetch','--prune','origin');}
export async function syncStatus(w:string,refresh=false){const read=async()=>{await assertRepo(w);if(refresh){await verifyRemote(w);await fetch(w);}return {repository:(await config(w)).sync?.repository??null,...await gitStatus(w),refreshed:refresh,next_action:'pull_if_behind_or_offer_push'};};return refresh?withLock(w,read):read();}
export async function pull(w:string,verify=verifyRemote){return withLock(w,async()=>{
  await assertRepo(w);await verify(w);await fetch(w);const status=await gitStatus(w);
  if(status.dirty)throw new SetupError('LOCAL_CHANGES','本地有未保存修改；先创建本地版本，再检查同步。');
  if(status.diverged)throw new SetupError('SYNC_DIVERGED','两处都有新版本；已保留双方历史，需 Agent 对比并处理后再同步。',status);
  if(status.behind){
    // Refuse a remote tree containing unmanaged paths or symlinks before updating files.
    const tree=await git(w,'ls-tree','-r','refs/remotes/origin/main');
    for(const line of tree.split('\n').filter(Boolean)){const file=line.slice(line.indexOf('\t')+1);if(line.startsWith('120000 ')||!allowed(file))throw new SetupError('REMOTE_CONTENT_REVIEW','远端含不受管文件或符号链接；请先核对。');}
    await git(w,'merge','--ff-only','refs/remotes/origin/main');await validate(w);
  }
  return {updated:status.behind>0,...await gitStatus(w),next_action:'read_context'};
});}
export async function push(w:string,verify=verifyRemote){return withLock(w,async()=>{
  await assertRepo(w);await verify(w);await validate(w);await checkTracked(w);await fetch(w);const s=await gitStatus(w);
  if(s.dirty)throw new SetupError('LOCAL_CHANGES','先用 history save 保存本轮修改。');
  if(s.behind)throw new SetupError(s.diverged?'SYNC_DIVERGED':'REMOTE_AHEAD','远端有更新，先处理同步，未上传。',s);
  if(!await hasHead(w))throw new SetupError('NO_SAVED_VERSION','先保存首个本地版本。');
  await git(w,'push','--set-upstream','origin','main:main');return {synced:true,commit:await git(w,'rev-parse','HEAD'),repository:(await config(w)).sync.repository};
});}
export async function restore(w:string,repository:string){
  await noSymlinks(w);try{await stat(w);throw new SetupError('DIRECTORY_EXISTS','恢复目标必须是不存在的新目录。');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const parent=path.dirname(w);await mkdir(parent,{recursive:true});const repo=githubRepo(repository);await remoteInfo(parent,repo);
  await run('git',['-c','core.hooksPath=','-c','credential.helper=!gh auth git-credential','clone','--branch','main','--single-branch','--',`https://github.com/${repo}.git`,w],parent,300_000);
  await assertRepo(w);await validate(w);const value=await config(w);
  await git(w,'config','--local','credential.https://github.com.helper','!gh auth git-credential');
  return {workspace:w,tool:value.tool??null,next_action:'install_locked_dependencies_then_read_agents',next_reads:[path.join(w,'AGENTS.md'),path.join(w,'.agents/skills/career-setup/SKILL.md')],guidance:'先核对 package.json 和锁文件的 career 版本及来源，再 npm ci --ignore-scripts；不要覆盖为最新工具版本。'};
}
