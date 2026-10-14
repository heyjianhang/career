import {readFile,writeFile,rename,mkdir,rm,stat} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {config,withLock} from './setup.js';
import {git,allowed,gitStatus,synchronize,verifyRemote} from './git.js';
import {noSymlinks} from '../presentation/io.js';
import {SetupError} from './process.js';

type Preferences={automatic:boolean;interval_minutes:number};
type Result={at:string;operation:'update'|'sync';ok:boolean;message:string;code?:string;details?:unknown;commit?:string;updated?:boolean};
type State={schema:'career-sync-local/v1';preferences:Preferences;last_result?:Result;last_sync?:string;last_update?:string;paused?:boolean};
const defaults=():State=>({schema:'career-sync-local/v1',preferences:{automatic:false,interval_minutes:5}});
const statePath=(w:string)=>path.join(w,'.local/sync.json');
export async function readSyncState(w:string):Promise<State>{
 await config(w);await noSymlinks(statePath(w));
 try{const value=JSON.parse(await readFile(statePath(w),'utf8'));if(value.schema!=='career-sync-local/v1'||typeof value.preferences?.automatic!=='boolean'||!Number.isInteger(value.preferences.interval_minutes)||value.preferences.interval_minutes<1||value.preferences.interval_minutes>60)throw new Error('本机同步设置格式有误，请保留文件并检查。');return value;}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return defaults();throw e;}
}
async function writeState(w:string,value:State){
 await noSymlinks(statePath(w));await mkdir(path.dirname(statePath(w)),{recursive:true});
 const temp=statePath(w)+'.'+randomUUID()+'.tmp';
 try{await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temp,statePath(w));}finally{await rm(temp,{force:true});}
}
export async function syncPreferences(w:string,change?:Partial<Preferences>){
 if(change===undefined)return (await readSyncState(w)).preferences;
 if((change.automatic!==undefined&&typeof change.automatic!=='boolean')||(change.interval_minutes!==undefined&&(!Number.isInteger(change.interval_minutes)||change.interval_minutes<1||change.interval_minutes>60)))throw new SetupError('INVALID_SYNC_PREFERENCES','自动同步需为开关值，间隔需为 1–60 分钟。');
 return withLock(w,async()=>{const state=await readSyncState(w);if(change.automatic&&!(await config(w)).sync?.repository)throw new SetupError('SYNC_NOT_CONNECTED','请先连接私人仓库。');state.preferences={...state.preferences,...change};await writeState(w,state);return state.preferences;});
}
export async function syncOverview(w:string){
 const value=await config(w),state=await readSyncState(w);let local=null,error=null;
 try{local=await gitStatus(w);}catch(e){error={code:(e as SetupError).code,message:(e as Error).message};}
 return {repository:value.sync?.repository??null,...state,local,error};
}
const active=new Map<string,Promise<any>>();
export async function runSync(w:string,operation:'update'|'sync'='sync',verify=verifyRemote){
 if(!['update','sync'].includes(operation))throw new SetupError('INVALID_OPERATION','请选择更新或同步');
 if(active.has(w))throw new SetupError('SYNC_BUSY','当前工作区正在同步，请稍候。');
 const task=(async()=>{
  try{
   const result=await synchronize(w,operation==='sync',verify);
   await withLock(w,async()=>{const state=await readSyncState(w),at=new Date().toISOString();state.last_result={at,operation,ok:true,message:operation==='sync'?'已同步':'已更新',commit:result.commit,updated:result.updated};state.last_update=at;if(operation==='sync')state.last_sync=at;state.paused=false;await writeState(w,state);});return result;
  }catch(e){
   const error=e as SetupError;
   // A concurrent editor owns the workspace lock; don't compete to record a transient busy error.
   if(error.code!=='WORKSPACE_BUSY')await withLock(w,async()=>{const state=await readSyncState(w);state.last_result={at:new Date().toISOString(),operation,ok:false,message:error.message,code:error.code,details:error.details};state.paused=['SYNC_CONFLICT','SYNC_HISTORY_MISMATCH','REMOTE_CHANGED','WORKSPACE_INVALID','REMOTE_CONTENT_REVIEW','PRIVATE_REPOSITORY_REQUIRED'].includes(error.code);await writeState(w,state);});
   throw e;
  }
 })();active.set(w,task);try{return await task;}finally{active.delete(w);}
}
// One service per local workspace server, never a browser tab timer. Closed apps
// have no background upload; .local preferences are deliberately not Git-tracked.
export class SyncScheduler {
 private timer?:ReturnType<typeof setInterval>;private running?:Promise<void>;private stopped=false;
 private next=0;private first=true;private fingerprint='';private stableSince=0;
 constructor(readonly workspace:string,private execute=runSync,private now=Date.now){}
 start(){if(this.timer)return;this.timer=setInterval(()=>{void this.tick();},15_000);this.timer.unref();void this.tick();}
 async tick(){if(this.stopped||this.running)return;this.running=this.check().catch(async(e)=>{if((e as SetupError).code==='WORKSPACE_BUSY')return;try{await withLock(this.workspace,async()=>{const state=await readSyncState(this.workspace);state.last_result={at:new Date().toISOString(),operation:'sync',ok:false,message:(e as Error).message,code:(e as SetupError).code};state.paused=true;await writeState(this.workspace,state);});}catch{}});try{await this.running;}finally{this.running=undefined;}}
 private async check(){
  const state=await readSyncState(this.workspace),now=this.now();
  if(!state.preferences.automatic){this.first=true;this.next=0;return;}
  if(state.paused||now<this.next||active.has(this.workspace))return;
  if(!(await config(this.workspace)).sync?.repository)return;
  // Wait until tracked and new data stop changing, so a multi-file Agent save can finish.
  const names=(await git(this.workspace,'ls-files','--cached','--others','--exclude-standard','-z')).split('\0').filter(f=>f&&allowed(f));
  const digest=createHash('sha256');
  for(const file of [...new Set(names)].sort()){await noSymlinks(path.join(this.workspace,file));digest.update(file);try{if((await stat(path.join(this.workspace,file))).size>25*1024*1024)throw new SetupError('FILE_TOO_LARGE','有超过 25 MiB 的文件，自动同步已等待处理。');digest.update(await readFile(path.join(this.workspace,file)));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;digest.update('deleted');}}
  const current=digest.digest('hex');if(current!==this.fingerprint){this.fingerprint=current;this.stableSince=now;return;}
  if(now-this.stableSince<30_000)return;
  this.next=now+state.preferences.interval_minutes*60_000;
  // First launch updates without uploading; subsequent ticks sync under the user's opt-in.
  const operation=this.first?'update':'sync';this.first=false;
  try{await this.execute(this.workspace,operation);}catch{this.next=now+Math.max(state.preferences.interval_minutes,5)*60_000;}
 }
 async stop(){this.stopped=true;if(this.timer)clearInterval(this.timer);await this.running;await active.get(this.workspace)?.catch(()=>{});}
}
