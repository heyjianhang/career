// Public release discovery only. Installing/restarting is always the user's action.
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const API='https://api.github.com/repos/heyjianhang/career/releases?per_page=100';
const REPO='https://github.com/heyjianhang/career/releases';
const INTERVAL=6*60*60*1000;
const PORTAL='https://career.heyjianhang.top/api/downloads';
const MANIFEST='https://raw.githubusercontent.com/heyjianhang/career/main/site/downloads.json';
const CACHE_TIME=5*60*1000;
const MAX_BYTES=4*1024*1024;
function version(value){
 if(typeof value!=='string')return null;
 const m=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.exec(value);
 if(!m||m.slice(1,4).some(n=>!Number.isSafeInteger(Number(n))))return null;
 const pre=m[4]?.split('.')??[];
 if(pre.some(n=>/^\d+$/.test(n)&&n.length>1&&n[0]==='0'))return null;
 return {core:m.slice(1,4).map(Number),pre};
}
function compare(a,b){
 const x=version(a),y=version(b);if(!x||!y)throw new Error('无效版本号');
 for(let i=0;i<3;i++)if(x.core[i]!==y.core[i])return x.core[i]>y.core[i]?1:-1;
 if(!x.pre.length||!y.pre.length)return x.pre.length===y.pre.length?0:x.pre.length?-1:1;
 for(let i=0;i<Math.max(x.pre.length,y.pre.length);i++){
  const u=x.pre[i],v=y.pre[i];if(u===v)continue;if(u===undefined)return -1;if(v===undefined)return 1;
  const un=/^\d+$/.test(u),vn=/^\d+$/.test(v);
  if(un&&vn)return BigInt(u)>BigInt(v)?1:-1;
  if(un!==vn)return un?-1:1;return u>v?1:-1;
 }return 0;
}
function selectRelease(releases,{currentVersion,platform,arch,preview}){
 const os=platform==='darwin'?'mac':platform==='win32'?'win':null;
 if(!os||!['arm64','x64'].includes(arch))return null;
 const candidates=[];
 for(const r of releases){
  if(!r||r.draft!==false||typeof r.tag_name!=='string'||!r.tag_name.startsWith('desktop-v'))continue;
  const v=r.tag_name.slice(9),parsed=version(v);
  if(!parsed||compare(v,currentVersion)<=0||(!preview&&(r.prerelease||parsed.pre.length)))continue;
  const releaseUrl=REPO+'/tag/'+r.tag_name;
  if(r.html_url!==releaseUrl)continue;
  const name=`career-${v}-${os}-${arch}.${os==='mac'?'dmg':'exe'}`;
  const downloadUrl=REPO+'/download/'+r.tag_name+'/'+name;
  const asset=Array.isArray(r.assets)&&r.assets.find(a=>a?.name===name&&a.state==='uploaded'&&a.size>0&&a.browser_download_url===downloadUrl);
  if(!asset)continue;
  candidates.push({version:v,tag:r.tag_name,name,downloadUrl,releaseUrl,notes:typeof r.body==='string'?r.body.slice(0,16000):'',publishedAt:typeof r.published_at==='string'?r.published_at:null,size:asset.size});
 }
 return candidates.sort((a,b)=>compare(b.version,a.version))[0]??null;
}
function publicError(message,retryAt=null){return Object.assign(new Error(message),{publicMessage:message,retryAt});}
async function readText(response){
 if(Number(response.headers.get('content-length'))>MAX_BYTES)throw publicError('版本信息过大，请稍后重试。');
 if(!response.body)return '';
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES)throw publicError('版本信息过大，请稍后重试。');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks).toString('utf8');
}
function json(text){try{return JSON.parse(text);}catch{throw publicError('版本信息格式异常，请稍后重试。');}}
function rateLimit(response,text,now){
 const remaining=response.headers.get('x-ratelimit-remaining'),retry=response.headers.get('retry-after');
 if(![403,429].includes(response.status)||!(response.status===429||remaining==='0'||retry!==null||/rate limit|abuse detection/i.test(text)))return null;
 const dates=[now+60000];
 if(retry!==null){const value=/^\d+(?:\.\d+)?$/.test(retry)?now+Number(retry)*1000:Date.parse(retry);if(Number.isFinite(value))dates.push(value);}
 if(remaining==='0'){const reset=Number(response.headers.get('x-ratelimit-reset'))*1000;if(Number.isFinite(reset))dates.push(reset+1000);}
 return Math.max(...dates);
}
async function readReleases(fetchImpl,{etag,cached,now}){
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 if(etag&&cached)headers['If-None-Match']=etag;
 const response=await fetchImpl(API,{headers,signal:AbortSignal.timeout(15000)});
 if(response.status===304){if(!cached)throw publicError('版本信息缓存缺失，请稍后重试。');return {unchanged:true,etag};}
 const text=await readText(response);
 if(!response.ok){
  const retryAt=rateLimit(response,text,now());
  if(retryAt)throw publicError('GitHub 公开版本接口暂时限流，将按服务端要求等待后再检查。',retryAt);
  throw publicError(`无法读取公开版本（HTTP ${response.status}），请稍后重试。`);
 }
 const data=json(text);if(!Array.isArray(data))throw publicError('版本信息格式异常，请稍后重试。');
 return {releases:data,etag:response.headers.get('etag')||''};
}
// A public download record describes the website's current offering, not every
// release in a channel. Keep that scope visible, including missing architectures.
function publishedDownload(data,{currentVersion,platform,arch,preview}){
 if(!data||!version(data.version)||data.tag!=='desktop-v'+data.version||!data.assets||typeof data.assets!=='object'||Array.isArray(data.assets))return null;
 for(const key of Object.keys(data.assets)){
  if(!['mac-arm64','mac-x64','win-arm64','win-x64'].includes(key))return null;
  const expected=`${REPO}/download/${data.tag}/career-${data.version}-${key}.${key.startsWith('mac-')?'dmg':'exe'}`;
  if(data.assets[key]!==null&&data.assets[key]!==expected)return null;
 }
 const os=platform==='darwin'?'mac':platform==='win32'?'win':null;
 const url=os&&['arm64','x64'].includes(arch)?data.assets[os+'-'+arch]:null;
 const candidate=url&&compare(data.version,currentVersion)>0&&(preview||!version(data.version).pre.length)?{
  version:data.version,tag:data.tag,name:url.slice(url.lastIndexOf('/')+1),downloadUrl:url,releaseUrl:REPO+'/tag/'+data.tag,
  notes:typeof data.notes==='string'?data.notes.slice(0,16000):'此版本来自公开下载清单。',publishedAt:typeof data.publishedAt==='string'?data.publishedAt:null,size:Number.isFinite(data.sizes?.[os+'-'+arch])&&data.sizes[os+'-'+arch]>0?data.sizes[os+'-'+arch]:null
 }:null;
 return {version:data.version,candidate,compatible:!!url&&(preview||!version(data.version).pre.length)};
}
function networkError(error,label){
 if(error.publicMessage)return error.publicMessage;
 if(error.name==='TimeoutError'||error.name==='AbortError')return label+'连接超时，请稍后重试。';
 return label+'暂时无法连接，请检查网络后重试。';
}
async function readManifest(fetchImpl,options,source){
 const response=await fetchImpl(source==='portal'?PORTAL:MANIFEST,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw publicError(`公开下载清单暂时无法读取（HTTP ${response.status}）。`);
 const body=json(await readText(response)),data=source==='portal'?body?.manifest:body;
 if(!publishedDownload(data,options))throw publicError('公开下载清单格式异常。');
 const sizes=source==='portal'?Object.fromEntries(Object.entries(body.verification?.assets??{}).map(([key,value])=>[key,value?.size])):{};
 return {version:data.version,tag:data.tag,assets:data.assets,notes:source==='portal'&&typeof body.notes==='string'?body.notes.slice(0,16000):undefined,publishedAt:source==='portal'&&Number.isFinite(Date.parse(body.publishedAt))?body.publishedAt:null,sizes};
}
async function createUpdateService({directory,currentVersion,platform,arch,fetchImpl=fetch,openExternal,onChange=()=>{},now=Date.now}){
 if(!version(currentVersion))throw new Error('当前应用版本无效');
 const file=path.join(directory,'updates.json');
 let saved={},loadError='';try{saved=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT'){saved={automatic:false};loadError='本机更新设置暂时无法读取，已暂停自动检查。可手动检查或重新保存设置。';}}
 if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};
 const time=value=>Number.isFinite(value)&&value>0?value:null;
 let prefs={automatic:typeof saved.automatic==='boolean'?saved.automatic:true,preview:typeof saved.preview==='boolean'?saved.preview:!!version(currentVersion).pre.length};
 let releases=Array.isArray(saved.releases)?saved.releases:[],lastChecked=time(saved.lastChecked),lastAttempt=time(saved.lastAttempt);
 let etag=typeof saved.etag==='string'?saved.etag:'',retryAt=time(saved.retryAt);
 // Version 1 applied GitHub's rate limit to every source. A migrated client may
 // immediately check the website, while still respecting the GitHub deadline.
 let nextCheckAt=saved.cacheVersion===2?time(saved.nextCheckAt):null;
 let automaticRetryAt=saved.cacheVersion===2?time(saved.automaticRetryAt):null;
 let checkedAt=saved.cacheVersion===2?time(saved.checkedAt):null;
 let coverage=['public','releases'].includes(saved.coverage)?saved.coverage:null;
 let failures=Number.isSafeInteger(saved.failures)?Math.max(0,Math.min(10,saved.failures)):0;
 let manifest=saved.manifest,manifestChecked=time(saved.manifestChecked),manifestSource=saved.manifestSource==='portal'?'portal':'repository';
 const notified=new Set(Array.isArray(saved.notified)?saved.notified.filter(v=>typeof v==='string').slice(-100):[]);
 let warning=typeof saved.warning==='string'?saved.warning.slice(0,500):'';
 let checking=false,error=loadError||(typeof saved.error==='string'?saved.error.slice(0,500):''),pending=null,queue=Promise.resolve(),startTimer,timer,closed=false;
 const options=()=>({currentVersion,platform,arch,preview:prefs.preview});
 const fallback=()=>publishedDownload(manifest,options());
 const latest=()=>[selectRelease(releases,options()),fallback()?.candidate].filter(Boolean).sort((a,b)=>compare(b.version,a.version))[0]??null;
 const snapshot=()=>({currentVersion,platform,arch,...prefs,checking,lastChecked,checkedAt,coverage,warning,latest:latest(),error,nextCheckAt,retryAt,publicVersion:manifestChecked?fallback()?.version??null:null,publicChecked:fallback()?manifestChecked:null,publicSource:manifestSource,publicRelation:fallback()?compare(currentVersion,fallback().version):null,publicCompatible:fallback()?.compatible??false});
 const emit=()=>{if(!closed)onChange(snapshot());};
 const locked=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 async function persist(){
  await fs.mkdir(directory,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify({cacheVersion:2,...prefs,lastChecked,lastAttempt,checkedAt,coverage,warning,nextCheckAt,automaticRetryAt,retryAt,failures,etag,error,manifest,manifestChecked,manifestSource,notified:[...notified].slice(-100),releases},null,2)+'\n',{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
 }
 async function check(){
  if(pending)return pending;
  if(nextCheckAt&&now()<nextCheckAt)return snapshot();
  checking=true;lastAttempt=now();emit();
  pending=(async()=>{
   let publicOk=false,fullOk=false,publicFailure='',releaseFailure='';
   warning='';
   try{
    // The portal is independently published and has no anonymous GitHub quota.
    for(const source of ['portal','repository']){
     try{
      manifest=await readManifest(fetchImpl,options(),source);manifestChecked=now();manifestSource=source;publicOk=true;
      if(source==='repository')warning='官网暂时无法连接，已核对发布仓库的下载清单。';
      break;
     }catch(e){publicFailure=networkError(e,source==='portal'?'官网更新服务':'发布仓库');}
    }
    if(!publicOk||!fallback()?.compatible){
     if(retryAt&&now()<retryAt)releaseFailure='GitHub 公开版本接口暂时限流，将按服务端要求等待后再检查。';
     else try{
      const fetched=await readReleases(fetchImpl,{etag,cached:lastChecked!==null,now});
      if(!fetched.unchanged)releases=fetched.releases.filter(r=>r?.draft===false&&typeof r.tag_name==='string'&&r.tag_name.startsWith('desktop-v')).map(r=>({draft:false,prerelease:!!r.prerelease,tag_name:r.tag_name,html_url:r.html_url,body:typeof r.body==='string'?r.body.slice(0,16000):'',published_at:r.published_at,assets:Array.isArray(r.assets)?r.assets.map(a=>({name:a?.name,state:a?.state,size:a?.size,browser_download_url:a?.browser_download_url})):[]}));
      lastChecked=now();etag=fetched.etag;retryAt=null;fullOk=true;
     }catch(e){retryAt=e.retryAt??null;releaseFailure=networkError(e,'GitHub 版本服务');}
    }
    if(fullOk||(publicOk&&fallback()?.compatible)){
     checkedAt=now();coverage=fullOk?'releases':'public';failures=0;error='';nextCheckAt=now()+CACHE_TIME;automaticRetryAt=null;
    }else{
     error=(publicOk?'官网当前下载记录未提供所选渠道或本机架构的安装包。':publicFailure+' ')+releaseFailure;
     failures=Math.min(failures+1,10);nextCheckAt=now()+60000;
     automaticRetryAt=now()+Math.min(60000*2**(failures-1),60*60*1000);
    }
    try{await locked(persist);}catch{warning+=(warning?' ':'')+'本次结果可查看，但本机更新缓存未能保存，请检查存储权限。';}
   }finally{checking=false;pending=null;emit();}
   return snapshot();
  })();return pending;
 }
 return {
  state:async()=>snapshot(),check,
  preferences:patch=>locked(async()=>{
   if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!['automatic','preview'].includes(k)||typeof patch[k]!=='boolean'))throw new Error('更新设置无效');
   const before={prefs,nextCheckAt,checkedAt,coverage};const changed=typeof patch.preview==='boolean'&&patch.preview!==prefs.preview;prefs={...prefs,...patch};if(changed){nextCheckAt=null;checkedAt=null;coverage=null;}try{await persist();}catch(e){({prefs,nextCheckAt,checkedAt,coverage}=before);throw e;}emit();return snapshot();
  }),
  claimNotice:tag=>locked(async()=>{
   if(!prefs.automatic||latest()?.tag!==tag||notified.has(tag))return false;
   notified.add(tag);try{await persist();}catch(e){notified.delete(tag);throw e;}return true;
  }),
  openDownload:async tag=>{const release=latest();if(!release||release.tag!==tag)throw new Error('版本信息已变化，请重新检查更新。');await openExternal(release.downloadUrl);return true;},
  start(){if(startTimer||timer)return;const tick=()=>{const due=error?(automaticRetryAt??nextCheckAt??0):(checkedAt?checkedAt+INTERVAL:0);if(prefs.automatic&&!closed&&now()>=due)void check();};startTimer=setTimeout(tick,15000);startTimer.unref?.();timer=setInterval(tick,60000);timer.unref?.();},
  close(){closed=true;clearTimeout(startTimer);clearInterval(timer);},
 };
}
module.exports={createUpdateService,selectRelease,compare,publishedDownload};
