import {mkdir,stat,realpath,readdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {config,withLock,updateConfig,setup} from './setup.js';
import {run,SetupError,available,executable} from './process.js';
import {inspectWorkspace} from '../agent-api.js';
import {noSymlinks} from '../presentation/io.js';
export const git=(dir:string,...args:string[])=>run('git',['-c','core.hooksPath=','-c','commit.gpgsign=false','-c','core.quotepath=false',...args],dir);
const credentialHelper=async()=>"!"+"'"+(await executable('gh')).replaceAll('\\','/').replaceAll("'","'\\''")+"' auth git-credential";
const managed=['career.json','package.json','package-lock.json','AGENTS.md','README.md','.gitignore','.gitattributes','.career','.agents','docs','schemas','examples','context','resume','opportunities','job-search','archive'];
export function allowed(file:string){return (managed.includes(file.split('/')[0]!)||file.startsWith('research/jd/')||file.startsWith('research/companies/'))&&!/(^|\/)(\.env(?:\..*)?|\.npmrc|\.DS_Store|node_modules|build|\.local|\.cache)(\/|$)/.test(file)&&!/(\.log|\.tmp|\.lock)$/.test(file);}
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
export async function validate(w:string){const result=await inspectWorkspace(w);if(!result.valid)throw new SetupError('WORKSPACE_INVALID','资料结构未通过检查；原文件保留。',{errors:result.errors});return result;}
async function checkTracked(w:string){
  const tracked=(await git(w,'ls-files','-z')).split('\0').filter(Boolean);
  if(tracked.some(f=>!allowed(f)))throw new SetupError('UNMANAGED_TRACKED_FILES','仓库跟踪了管理范围以外的文件，请先检查，未自动提交或上传。');
}
async function saveUnlocked(w:string,message:string){
  if(!message.trim()||message.length>200||/[\r\n]/.test(message))throw new SetupError('INVALID_MESSAGE','提供不超过 200 字的一行版本说明。');

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
}
export async function saveHistory(w:string,message:string){return withLock(w,()=>saveUnlocked(w,message));}
export async function historyList(w:string){await assertRepo(w);if(!await hasHead(w))return {entries:[]};const text=await git(w,'log','-30','--format=%H%x09%aI%x09%s');return {entries:text.split('\n').map(line=>{const [commit,date,...title]=line.split('\t');return {commit,date,title:title.join('\t')};})};}
export async function gitStatus(w:string){
  await assertRepo(w);const dirty=Boolean((await git(w,'ls-files','--modified','--deleted','--others','--exclude-standard','-z')).split('\0').filter(allowed).filter(Boolean).length||await git(w,'diff','--cached','--name-only'));
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
export async function remoteInfo(w:string,repo:string){
  const data=JSON.parse(await run('gh',['api',`repos/${repo}`],w));
  return requirePrivateRepository(data);
}
export async function verifyRemote(w:string){
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
    await git(w,'config','--local','credential.https://github.com.helper',await credentialHelper());
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
export async function restore(w:string,repository:string,inspect=async(parent:string,repo:string)=>{
 if(!await available('git'))throw new SetupError('DEPENDENCY_MISSING','尚未安装 Git，请在同步环境提示中安装后重新检测。');
 if(!await available('gh'))throw new SetupError('DEPENDENCY_MISSING','尚未安装 GitHub CLI，请安装并登录后重新检测。');
 await remoteInfo(parent,repo);
 const branches=JSON.parse(await run('gh',['api',`repos/${repo}/branches?per_page=100`],parent));
 if(branches.length&&!branches.some((b:any)=>b.name==='main'))throw new SetupError('BRANCH_MISMATCH','这个仓库没有 main 分支，请先核对仓库地址。');
 return {empty:!branches.length,url:`https://github.com/${repo}.git`};
}){
 await noSymlinks(w);try{await stat(w);throw new SetupError('DIRECTORY_EXISTS','恢复目标必须是不存在的新目录。');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const parent=path.dirname(w);await mkdir(parent,{recursive:true});const repo=githubRepo(repository),remote=await inspect(parent,repo);
 if(remote.empty){
  await mkdir(w); // Claim a new directory even if the remote lookup took time.
  await setup(w,false);await initHistory(w);
  await git(w,'remote','add','origin',remote.url);
 }else{
  await run('git',['-c','core.hooksPath=','-c','credential.helper='+await credentialHelper(),'clone','--no-checkout','--branch','main','--single-branch','--',remote.url,w],parent,300_000);
  await checkTree(w,'HEAD');await git(w,'checkout','main');await assertRepo(w);await validate(w);
  const value=await config(w);if(value.sync?.repository&&githubRepo(value.sync.repository)!==repo)throw new SetupError('REMOTE_CHANGED','仓库内记录的同步地址不一致；已保留恢复目录，请先核对。');
 }
 await git(w,'config','--local','credential.https://github.com.helper',await credentialHelper());
 await withLock(w,()=>updateConfig(w,c=>{c.sync={...c.sync,repository:repo,mode:'ask'};c.onboarding={...c.onboarding,sync:'connected'};}));
 const value=await config(w);
 return {workspace:w,empty_repository:remote.empty,tool:value.tool??null,next_action:'install_locked_dependencies_then_read_agents',next_reads:[path.join(w,'AGENTS.md'),path.join(w,'.agents/skills/career-setup/SKILL.md')],guidance:'先核对 package.json 和锁文件的 career 版本及来源，再 npm ci --ignore-scripts；不要覆盖为最新工具版本。'};
}

// Build and validate an incoming version in an isolated checkout. Conflicts never
// write markers into the user's working files or leave an in-progress merge there.
export async function checkTree(w:string,ref:string){
 const tree=await git(w,'ls-tree','-r','-l','-z',ref);
 for(const line of tree.split('\0').filter(Boolean)){
  const [meta,file]=line.split('\t'),[mode,type,,size]=meta!.trim().split(/\s+/);
  if(!file||type!=='blob'||!['100644','100755'].includes(mode!)||!allowed(file)||Number(size)>25*1024*1024)throw new SetupError('REMOTE_CONTENT_REVIEW','远端包含不支持的文件、符号链接或过大附件，已保留本地资料。');
 }
}
export async function synchronize(w:string,upload=true,verify=verifyRemote){return withLock(w,async()=>{
 await assertRepo(w);
 const saved=await saveUnlocked(w,`sync: 保存资料 ${new Date().toISOString().slice(0,16).replace('T',' ')}`);
 const repository=await verify(w);await fetch(w);
 const before=await gitStatus(w),head=await git(w,'rev-parse','HEAD');let updated=false;
 if(before.behind){
  await checkTree(w,'refs/remotes/origin/main');
  const remoteHead=await git(w,'rev-parse','refs/remotes/origin/main');
  const temp=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-sync-'));
  try{
   await git(w,'clone','--no-hardlinks','--no-checkout','--single-branch','--branch','main','--',w,temp);
   await git(temp,'checkout','main');
   for(const key of ['user.name','user.email'])await git(temp,'config','--local',key,await git(w,'config','--get',key));
   await git(temp,'fetch','--',w,'refs/remotes/origin/main:refs/remotes/incoming/main');
   try{await git(temp,'merge','--no-edit','--no-commit','refs/remotes/incoming/main');}
   catch{
    const files=(await git(temp,'diff','--name-only','--diff-filter=U','-z')).split('\0').filter(Boolean);
    throw new SetupError(files.length?'SYNC_CONFLICT':'SYNC_HISTORY_MISMATCH',files.length?'同一份资料在两处修改，已暂停同步。双方版本均保留，请交给 Agent 协助合并。':'两处版本无法安全合并，已保留双方资料。',{files,local_commit:head,remote_commit:remoteHead});
   }
   if(before.diverged)await git(temp,'commit','-m','sync: 合并另一台设备的资料');
   await checkTree(temp,'HEAD');await validate(temp);
   // A fetched workspace may not silently redirect later uploads to another repository.
   const incoming=await config(temp);
   if(incoming.sync?.repository&&githubRepo(incoming.sync.repository)!==repository)throw new SetupError('REMOTE_CHANGED','远端资料中的仓库地址不同，未更新本地资料。');
   const candidate=await git(temp,'rev-parse','HEAD');await git(w,'fetch','--',temp,'main');
   if(await git(w,'rev-parse','HEAD')!==head||(await gitStatus(w)).dirty)throw new SetupError('WORKSPACE_CHANGED','同步期间资料又有修改，已保留，请稍后重试。');
   await git(w,'merge','--ff-only',candidate);updated=true;
  }finally{await rm(temp,{recursive:true,force:true});}
 }
 if(upload){
  // Revalidate the exact saved snapshot, not files an external Agent may still be editing.
  const uploadHead=await git(w,'rev-parse','HEAD');
  if(!updated){
   await checkTree(w,uploadHead);const snapshot=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-sync-check-'));
   try{await git(w,'clone','--no-hardlinks','--no-checkout','--single-branch','--branch','main','--',w,snapshot);await git(snapshot,'checkout','--detach',uploadHead);await validate(snapshot);}finally{await rm(snapshot,{recursive:true,force:true});}
  }
  if(await git(w,'rev-parse','HEAD')!==uploadHead||(await gitStatus(w)).dirty)throw new SetupError('WORKSPACE_CHANGED','资料正在修改，请稍后再同步。');
  // A concurrent remote push is rejected by Git; never force or retry blindly.
  await git(w,'push','--set-upstream','origin','main:main');
 }
 return {saved:saved.saved,updated,synced:upload,repository,commit:await git(w,'rev-parse','HEAD'),...await gitStatus(w)};
});}
