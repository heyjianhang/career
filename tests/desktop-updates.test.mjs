import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import updates from '../desktop/updates.cjs';
const {compare,selectRelease,createUpdateService,publishedDownload}=updates;
const staticManifest=v=>({version:v,tag:'desktop-v'+v,assets:Object.fromEntries(release(v).assets.map(a=>[a.name.match(/(mac|win)-(arm64|x64)/)[0],a.browser_download_url]))});
const isManifest=url=>url.includes('raw.githubusercontent.com');
const repo='https://github.com/heyjianhang/career/releases';
const release=(v,extra={})=>({tag_name:'desktop-v'+v,draft:false,prerelease:v.includes('-'),html_url:repo+'/tag/desktop-v'+v,body:'更新说明',assets:['mac-arm64.dmg','mac-x64.dmg','win-arm64.exe','win-x64.exe'].map(suffix=>({name:`career-${v}-${suffix}`,state:'uploaded',size:1000,browser_download_url:`${repo}/download/desktop-v${v}/career-${v}-${suffix}`})),...extra});
const options={currentVersion:'0.3.0-alpha.8',platform:'darwin',arch:'arm64',preview:true};
const response=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
async function setup(t,extras={}){const directory=await mkdtemp(path.join(os.tmpdir(),'career-updates-'));t.after(()=>rm(directory,{recursive:true,force:true}));return {directory,...options,openExternal:async()=>{},...extras};}
test('desktop version comparison handles preview numbers, stable releases and build metadata',()=>{
 assert.equal(compare('0.3.0-alpha.10','0.3.0-alpha.9'),1);
 assert.equal(compare('0.3.0','0.3.0-rc.99'),1);
 assert.equal(compare('0.3.0-beta','0.3.0-alpha.10'),1);
 assert.equal(compare('0.3.0+foo','0.3.0+bar'),0);
 assert.equal(compare('0.3.0-alpha','0.3.0-alpha.1'),-1);
 assert.equal(compare('0.3.0-1','0.3.0-alpha'),-1);
 assert.throws(()=>compare('0.3.0-alpha.01','0.3.0'));
});
test('release channels and exact architecture use only public uploaded desktop installers',()=>{
 const all=[release('0.4.0-alpha.1'),release('0.3.0'),release('0.5.0',{draft:true}),release('0.6.0',{tag_name:'v0.6.0'})];
 assert.equal(selectRelease(all,options).version,'0.4.0-alpha.1');
 assert.equal(selectRelease(all,{...options,preview:false}).version,'0.3.0');
 assert.equal(selectRelease([release('0.3.0-alpha.8')],options),null);
 assert.equal(selectRelease([release('0.3.0-alpha.1')],options),null);
 for(const [platform,arch,suffix] of [['darwin','arm64','mac-arm64.dmg'],['darwin','x64','mac-x64.dmg'],['win32','arm64','win-arm64.exe'],['win32','x64','win-x64.exe']])assert.ok(selectRelease(all,{...options,platform,arch}).name.endsWith(suffix));
 const missing=release('0.4.0');missing.assets=missing.assets.filter(a=>!a.name.endsWith('mac-arm64.dmg'));
 assert.equal(selectRelease([missing],options),null);
 for(const mutate of [r=>r.assets[0].browser_download_url='https://evil.example/app.dmg',r=>r.html_url='https://evil.example/',r=>r.assets[0].state='new',r=>r.assets[0].size=0]){const r=release('0.4.0');mutate(r);assert.equal(selectRelease([r],options),null);}
 assert.equal(selectRelease(all,{...options,platform:'linux'}),null);
});
test('checking is deduplicated; preview selection, settings and notice receipt persist across restarts',async t=>{
 let calls=0,resolve;const gate=new Promise(r=>resolve=r),opened=[];
 const config=await setup(t,{fetchImpl:async()=>{calls++;await gate;return response([release('0.3.0-alpha.10')]);},openExternal:async url=>opened.push(url)});
 const svc=await createUpdateService(config);assert.equal((await svc.state()).preview,true);
 const first=svc.check(),second=svc.check();assert.equal((await svc.state()).checking,true);resolve();await Promise.all([first,second]);assert.equal(calls,1);
 const latest=(await svc.state()).latest;assert.equal(latest.version,'0.3.0-alpha.10');
 await svc.openDownload(latest.tag);assert.equal(opened[0],latest.downloadUrl);
 await assert.rejects(svc.openDownload('desktop-v0.4.0'),/已变化/);
 assert.deepEqual(await Promise.all([svc.claimNotice(latest.tag),svc.claimNotice(latest.tag)]),[true,false]);
 await svc.preferences({automatic:false,preview:false});assert.equal((await svc.state()).latest,null);
 const restored=await createUpdateService(config);assert.equal((await restored.state()).automatic,false);assert.equal((await restored.state()).preview,false);
 await restored.preferences({automatic:true,preview:true});assert.equal((await restored.state()).latest.tag,latest.tag);assert.equal(await restored.claimNotice(latest.tag),false);
 assert.equal(JSON.parse(await readFile(path.join(config.directory,'updates.json'),'utf8')).notified.length,1);
 await assert.rejects(restored.preferences({automatic:'true'}),/无效/);await assert.rejects(restored.preferences({url:'https://evil.example'}),/无效/);
});
test('a failed or rate-limited check preserves the last successful release and never reports current',async t=>{
 let mode='ok',clock=Date.now();const config=await setup(t,{now:()=>clock,fetchImpl:async()=>mode==='ok'?response([release('0.3.0-alpha.9')]):mode==='limit'?new Response('',{status:403,headers:{'x-ratelimit-remaining':'0'}}):Promise.reject(new TypeError('fetch failed'))});
 const svc=await createUpdateService(config);const first=await svc.check();mode='limit';clock+=300001;const second=await svc.check();assert.match(second.error,/限流/);assert.equal(second.latest.tag,first.latest.tag);assert.equal(second.lastChecked,first.lastChecked);
 mode='offline';clock=second.nextCheckAt+1;const third=await svc.check();assert.match(third.error,/无法检查/);assert.equal(third.checking,false);
});
test('channel changes during an in-flight request cannot leak a preview update into stable',async t=>{
 let resolve;const gate=new Promise(r=>resolve=r);const svc=await createUpdateService(await setup(t,{fetchImpl:async()=>{await gate;return response([release('0.4.0-beta.1')]);}}));
 const checking=svc.check();await svc.preferences({preview:false});resolve();const result=await checking;assert.equal(result.latest,null);assert.equal(result.preview,false);
});
test('invalid remote responses fail closed, while empty public releases are a successful check',async t=>{
 let payload={bad:true},clock=Date.now();const svc=await createUpdateService(await setup(t,{now:()=>clock,fetchImpl:async()=>response(payload)}));
 assert.match((await svc.check()).error,/格式/);payload=[];clock+=60001;const result=await svc.check();assert.equal(result.error,'');assert.equal(result.latest,null);assert.ok(result.lastChecked);
 const big=await createUpdateService(await setup(t,{fetchImpl:async()=>new Response('[]',{headers:{'content-length':String(5*1024*1024)}})}));assert.match((await big.check()).error,/过大/);
});
test('stable builds default to stable, automatic-off suppresses notices, and startup does not check immediately',async t=>{
 let calls=0;const svc=await createUpdateService(await setup(t,{currentVersion:'0.3.0',fetchImpl:async()=>{calls++;return response([release('0.4.0')]);}}));
 assert.equal((await svc.state()).preview,false);svc.start();svc.start();svc.close();assert.equal(calls,0);
 await svc.check();await svc.preferences({automatic:false});assert.equal(await svc.claimNotice('desktop-v0.4.0'),false);
});
test('a corrupt preference file does not block app startup or silently re-enable automatic checks',async t=>{
 const config=await setup(t,{fetchImpl:async()=>response([])});await writeFile(path.join(config.directory,'updates.json'),'{broken');
 const svc=await createUpdateService(config);assert.equal((await svc.state()).automatic,false);assert.match((await svc.state()).error,/设置/);
 assert.equal((await svc.check()).error,'');
});

test('successful responses are reused for five minutes and conditionally revalidated with ETag',async t=>{
 let clock=Date.now(),calls=0;
 const svc=await createUpdateService(await setup(t,{now:()=>clock,fetchImpl:async(url,options)=>{
  calls++;assert.equal(isManifest(url),false);
  if(calls===1)return new Response(JSON.stringify([release('0.4.0')]),{headers:{etag:'"release-1"'}});
  assert.equal(options.headers['If-None-Match'],'"release-1"');return new Response(null,{status:304});
 }}));
 const first=await svc.check();await svc.check();await svc.preferences({preview:false});await svc.check();assert.equal(calls,1);
 clock+=300001;const next=await svc.check();assert.equal(calls,2);assert.equal(next.latest.tag,first.latest.tag);assert.equal(next.error,'');assert.ok(next.lastChecked>first.lastChecked);
});
test('rate reset deadline survives restart and channel toggles without extra network calls',async t=>{
 let clock=Date.now(),calls=0;const reset=Math.ceil(clock/1000)+3600;
 const config=await setup(t,{now:()=>clock,fetchImpl:async url=>{
  calls++;if(isManifest(url))return response(staticManifest('0.3.0-alpha.1'));
  return new Response('',{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':String(reset)}});
 }});
 const svc=await createUpdateService(config),first=await svc.check();assert.equal(first.retryAt,reset*1000+1000);assert.equal(first.lastChecked,null);assert.equal(first.publicVersion,'0.3.0-alpha.1');assert.equal(first.latest,null);
 const restarted=await createUpdateService(config);await restarted.preferences({preview:false});await restarted.check();await svc.check();assert.equal(calls,2);
 assert.match((await restarted.state()).error,/限流/);clock=first.retryAt+1;await restarted.check();assert.equal(calls,4);
});
test('Retry-After seconds and HTTP dates are respected; other 403 responses are not called rate limits',async t=>{
 for(const value of ['300',new Date(Date.now()+300000).toUTCString()]){
  const clock=Date.now();const svc=await createUpdateService(await setup(t,{now:()=>clock,fetchImpl:async url=>isManifest(url)?response(staticManifest('0.3.0-alpha.1')):new Response('',{status:429,headers:{'retry-after':value}})}));
  const state=await svc.check();assert.ok(state.retryAt>=clock+298000);assert.match(state.error,/限流/);
 }
 const svc=await createUpdateService(await setup(t,{fetchImpl:async()=>new Response('Forbidden',{status:403})}));const state=await svc.check();assert.match(state.error,/HTTP 403/);assert.doesNotMatch(state.error,/限流/);assert.equal(state.retryAt,null);
});
test('public manifest fallback offers only the exact published architecture and preserves channel selection',async t=>{
 const opened=[];const config=await setup(t,{fetchImpl:async url=>isManifest(url)?response(staticManifest('0.4.0-beta.1')):new Response('',{status:429}),openExternal:async url=>opened.push(url)});
 const svc=await createUpdateService(config);const state=await svc.check();assert.equal(state.lastChecked,null);assert.equal(state.latest.version,'0.4.0-beta.1');assert.equal(state.latest.size,null);assert.match(state.error,/限流/);
 await svc.openDownload(state.latest.tag);assert.match(opened[0],/mac-arm64\.dmg$/);
 await svc.preferences({preview:false});assert.equal((await svc.state()).latest,null);assert.equal((await svc.state()).publicVersion,'0.4.0-beta.1');
 const missing=staticManifest('0.4.0');missing.assets['mac-arm64']=null;assert.equal(publishedDownload(missing,options).candidate,null);
 for(const [platform,arch,suffix] of [['darwin','arm64','mac-arm64.dmg'],['darwin','x64','mac-x64.dmg'],['win32','arm64','win-arm64.exe'],['win32','x64','win-x64.exe']])assert.ok(publishedDownload(staticManifest('0.4.0'),{...options,platform,arch}).candidate.name.endsWith(suffix));
});
test('fallback never erases a newer full-list release or the last complete check',async t=>{
 let clock=Date.now(),offline=false;
 const svc=await createUpdateService(await setup(t,{now:()=>clock,fetchImpl:async url=>isManifest(url)?response(staticManifest('0.4.0')):offline?new Response('',{status:429}):response([release('0.5.0')])}));
 const first=await svc.check();clock+=300001;offline=true;const next=await svc.check();assert.equal(next.latest.version,'0.5.0');assert.equal(next.lastChecked,first.lastChecked);assert.equal(next.publicVersion,'0.4.0');
});
test('invalid or redirected manifest links fail closed and cannot add a download',async t=>{
 for(const modify of [d=>d.tag='desktop-v9.0.0',d=>d.assets['mac-arm64']='https://evil.example/app.dmg',d=>d.assets['mac-arm64']+='?redirect=evil',d=>d.assets.bad='https://evil.example',d=>d.version='nonsense']){
  const data=staticManifest('0.4.0');modify(data);assert.equal(publishedDownload(data,options),null);
  const svc=await createUpdateService(await setup(t,{fetchImpl:async url=>isManifest(url)?response(data):new Response('',{status:429})}));
  const result=await svc.check();assert.equal(result.latest,null);assert.equal(result.publicVersion,null);assert.equal(result.lastChecked,null);
 }
});
test('offline attempts back off exponentially and retain explicitly dated fallback data',async t=>{
 let clock=Date.now(),calls=0,offline=false;
 const config=await setup(t,{now:()=>clock,fetchImpl:async url=>{calls++;if(isManifest(url)&&!offline)return response(staticManifest('0.4.0'));throw new TypeError('offline');}});
 const svc=await createUpdateService(config);const first=await svc.check();assert.equal(first.nextCheckAt-clock,60000);assert.equal(calls,2);
 await svc.check();assert.equal(calls,2);offline=true;clock=first.nextCheckAt+1;const second=await svc.check();assert.equal(second.nextCheckAt-clock,120000);assert.equal(second.publicChecked,first.publicChecked);assert.equal(second.latest.version,'0.4.0');
 const restored=await createUpdateService(config);await restored.check();assert.equal(calls,4);assert.equal((await restored.state()).publicChecked,first.publicChecked);
});
