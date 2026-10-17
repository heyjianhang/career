// Public release discovery only. Installing/restarting is always the user's action.
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const API='https://api.github.com/repos/heyjianhang/career/releases?per_page=100';
const REPO='https://github.com/heyjianhang/career/releases';
const INTERVAL=6*60*60*1000;
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
async function readReleases(fetchImpl){
 const response=await fetchImpl(API,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(response.status===403||response.status===429?'GitHub 暂时限制了检查频率，请稍后重试。':`无法读取公开版本（HTTP ${response.status}），请稍后重试。`);
 // Bound untrusted remote data before parsing; notes are displayed as plain text.
 if(Number(response.headers.get('content-length'))>4*1024*1024)throw new Error('版本信息过大，请稍后重试。');
 const reader=response.body.getReader();const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024)throw new Error('版本信息过大，请稍后重试。');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!Array.isArray(data))throw new Error('版本信息格式异常，请稍后重试。');
 return data;
}
async function createUpdateService({directory,currentVersion,platform,arch,fetchImpl=fetch,openExternal,onChange=()=>{},now=Date.now}){
 if(!version(currentVersion))throw new Error('当前应用版本无效');
 const file=path.join(directory,'updates.json');
 let saved={},loadError='';try{saved=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT'){saved={automatic:false};loadError='本机更新设置暂时无法读取，已暂停自动检查。可手动检查或重新保存设置。';}}
 if(!saved||typeof saved!=='object')saved={};
 let prefs={automatic:typeof saved.automatic==='boolean'?saved.automatic:true,preview:typeof saved.preview==='boolean'?saved.preview:!!version(currentVersion).pre.length};
 let releases=Array.isArray(saved.releases)?saved.releases:[],lastChecked=typeof saved.lastChecked==='number'?saved.lastChecked:null;
 const notified=new Set(Array.isArray(saved.notified)?saved.notified.filter(v=>typeof v==='string').slice(-100):[]);
 let checking=false,error=loadError,pending=null,queue=Promise.resolve(),startTimer,timer,closed=false;
 const latest=()=>selectRelease(releases,{currentVersion,platform,arch,preview:prefs.preview});
 const snapshot=()=>({currentVersion,platform,arch,...prefs,checking,lastChecked,latest:latest(),error});
 const emit=()=>{if(!closed)onChange(snapshot());};
 const locked=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 async function persist(){
  await fs.mkdir(directory,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify({...prefs,lastChecked,notified:[...notified].slice(-100),releases},null,2)+'\n',{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
 }
 async function check(){
  if(pending)return pending;
  checking=true;error='';emit();
  pending=(async()=>{
   try{const fetched=await readReleases(fetchImpl);await locked(async()=>{
    // Cache only the fields needed to reselect after a channel change.
    const old=releases,oldTime=lastChecked;
    releases=fetched.filter(r=>r?.draft===false&&typeof r.tag_name==='string'&&r.tag_name.startsWith('desktop-v')).map(r=>({draft:false,prerelease:!!r.prerelease,tag_name:r.tag_name,html_url:r.html_url,body:typeof r.body==='string'?r.body.slice(0,16000):'',published_at:r.published_at,assets:Array.isArray(r.assets)?r.assets.map(a=>({name:a?.name,state:a?.state,size:a?.size,browser_download_url:a?.browser_download_url})):[]}));
    lastChecked=now();try{await persist();}catch(e){releases=old;lastChecked=oldTime;throw e;}
   });}catch(e){error=e.name==='TimeoutError'||e.name==='AbortError'?'检查超时，请确认网络后重试。':e.message?.startsWith('GitHub')||e.message?.startsWith('版本信息')||e.message?.startsWith('无法读取公开版本')?e.message:'暂时无法检查更新，请确认网络和本机存储权限后重试。';}
   finally{checking=false;pending=null;emit();}
   return snapshot();
  })();return pending;
 }
 return {
  state:async()=>snapshot(),check,
  preferences:patch=>locked(async()=>{
   if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!['automatic','preview'].includes(k)||typeof patch[k]!=='boolean'))throw new Error('更新设置无效');
   const before=prefs;prefs={...prefs,...patch};try{await persist();}catch(e){prefs=before;throw e;}emit();return snapshot();
  }),
  claimNotice:tag=>locked(async()=>{
   if(!prefs.automatic||latest()?.tag!==tag||notified.has(tag))return false;
   notified.add(tag);try{await persist();}catch(e){notified.delete(tag);throw e;}return true;
  }),
  openDownload:async tag=>{const release=latest();if(!release||release.tag!==tag)throw new Error('版本信息已变化，请重新检查更新。');await openExternal(release.downloadUrl);return true;},
  start(){if(startTimer||timer)return;const tick=()=>{if(prefs.automatic&&!closed&&(!lastChecked||now()-lastChecked>=INTERVAL))void check();};startTimer=setTimeout(tick,15000);startTimer.unref?.();timer=setInterval(tick,INTERVAL);timer.unref?.();},
  close(){closed=true;clearTimeout(startTimer);clearInterval(timer);},
 };
}
module.exports={createUpdateService,selectRelease,compare};
