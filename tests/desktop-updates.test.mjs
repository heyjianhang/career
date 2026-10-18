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
const portal='https://career.heyjianhang.top/api/downloads';
const api='https://api.github.com/repos/heyjianhang/career/releases?per_page=100';
const managed=v=>({manifest:staticManifest(v),notes:'公开更新说明',publishedAt:'2026-10-18T10:14:12Z',verification:{assets:{'mac-arm64':{size:123456}}}});
const unavailable=()=>new Response('',{status:503});
const apiOnly=fn=>(url,opts)=>url===api?fn(url,opts):unavailable();
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settled(svc){for(let i=0;i<100&&(await svc.state()).checking;i++)await tick();assert.equal((await svc.state()).checking,false);}

test('portal is the primary public source; concurrent checks deduplicate and preserve release details',async t=>{
 let calls=0,resolve;const gate=new Promise(r=>resolve=r),opened=[];
 const config=await setup(t,{fetchImpl:async url=>{calls++;assert.equal(url,portal);await gate;return response(managed('0.3.0-alpha.10'));},openExternal:async url=>opened.push(url)});
 const svc=await createUpdateService(config),first=svc.check(),second=svc.check();assert.equal((await svc.state()).checking,true);resolve();await Promise.all([first,second]);assert.equal(calls,1);
 const state=await svc.state();assert.equal(state.coverage,'public');assert.equal(state.error,'');assert.equal(state.publicSource,'portal');assert.equal(state.publicRelation,-1);assert.equal(state.latest.notes,'公开更新说明');assert.equal(state.latest.size,123456);assert.equal(state.lastChecked,null);
 await svc.openDownload(state.latest.tag);assert.equal(opened[0],state.latest.downloadUrl);await assert.rejects(svc.openDownload('desktop-v9.0.0'),/已变化/);
 assert.deepEqual(await Promise.all([svc.claimNotice(state.latest.tag),svc.claimNotice(state.latest.tag)]),[true,false]);
 const restored=await createUpdateService(config);assert.equal((await restored.state()).latest.version,'0.3.0-alpha.10');assert.equal(await restored.claimNotice(state.latest.tag),false);
 await restored.preferences({automatic:false});assert.equal((await restored.state()).automatic,false);await assert.rejects(restored.preferences({automatic:'true'}),/无效/);
});
test('matching and older public versions complete a scoped check without offering a downgrade',async t=>{
 for(const v of ['0.3.0-alpha.8','0.3.0-alpha.1']){
  const svc=await createUpdateService(await setup(t,{fetchImpl:async()=>response(managed(v))}));const s=await svc.check();assert.equal(s.latest,null);assert.equal(s.error,'');assert.equal(s.coverage,'public');assert.ok(s.checkedAt);assert.equal(s.publicRelation,v===options.currentVersion?0:1);
 }
});
test('repository snapshot is a validated fallback when the portal is unavailable',async t=>{
 const calls=[];const svc=await createUpdateService(await setup(t,{fetchImpl:async url=>{calls.push(url);return isManifest(url)?response(staticManifest('0.4.0')):unavailable();}}));
 const s=await svc.check();assert.equal(calls.length,2);assert.equal(s.error,'');assert.equal(s.publicSource,'repository');assert.match(s.warning,/官网/);assert.equal(s.latest.size,null);
});
test('missing architecture and excluded preview channel query release history for a usable installer',async t=>{
 for(const excluded of ['architecture','channel']){
  const data=managed('0.4.0-beta.1');if(excluded==='architecture')data.manifest.assets['mac-arm64']=null;
  const svc=await createUpdateService(await setup(t,{fetchImpl:async url=>url===portal?response(data):response([release('0.3.0')])}));
  if(excluded==='channel')await svc.preferences({preview:false});const s=await svc.check();assert.equal(s.coverage,'releases');assert.equal(s.latest.version,'0.3.0');assert.equal(s.publicCompatible,false);assert.equal(s.error,'');
 }
});
test('changing preview selection while fetching cannot expose an excluded preview',async t=>{
 let resolve;const gate=new Promise(r=>resolve=r);const svc=await createUpdateService(await setup(t,{fetchImpl:async url=>{if(url===portal){await gate;return response(managed('0.4.0-beta.1'));}return response([release('0.3.0')]);}}));
 const pending=svc.check();await svc.preferences({preview:false});resolve();const s=await pending;assert.equal(s.preview,false);assert.equal(s.latest.version,'0.3.0');
});
test('successful checks reuse five-minute cache; a changed channel invalidates public coverage',async t=>{
 let clock=Date.now(),calls=0;const svc=await createUpdateService(await setup(t,{now:()=>clock,fetchImpl:async url=>{calls++;return url===portal?response(managed('0.4.0-beta.1')):response([release('0.3.0')]);}}));
 await svc.check();await svc.check();await svc.preferences({preview:true});await svc.check();assert.equal(calls,1);
 clock+=300001;await svc.check();assert.equal(calls,2);await svc.preferences({preview:false});assert.equal((await svc.state()).coverage,null);await svc.check();assert.equal(calls,4);assert.equal((await svc.state()).latest.version,'0.3.0');
});
test('GitHub fallback uses ETag revalidation and accepts an empty public history',async t=>{
 let clock=Date.now(),calls=0;const svc=await createUpdateService(await setup(t,{now:()=>clock,fetchImpl:apiOnly(async(url,opts)=>{calls++;if(calls===1)return new Response('[]',{headers:{etag:'"v1"'}});assert.equal(opts.headers['If-None-Match'],'"v1"');return new Response(null,{status:304});})}));
 const first=await svc.check();assert.equal(first.error,'');assert.equal(first.coverage,'releases');clock+=300001;const second=await svc.check();assert.equal(calls,2);assert.ok(second.lastChecked>first.lastChecked);assert.equal(second.latest,null);
});
test('GitHub rate limits persist but do not prevent checking the independent website',async t=>{
 let clock=Date.now(),available=false;const reset=Math.ceil(clock/1000)+3600,calls=[];
 const config=await setup(t,{now:()=>clock,fetchImpl:async url=>{calls.push(url);if(url===portal&&available)return response(managed('0.4.0'));if(url===api)return new Response('',{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':String(reset)}});return unavailable();}});
 const first=await (await createUpdateService(config)).check();assert.match(first.error,/限流/);assert.equal(first.retryAt,reset*1000+1000);assert.equal(first.nextCheckAt,clock+60000);
 const restarted=await createUpdateService(config);await restarted.check();assert.equal(calls.length,3);clock+=60001;available=true;const s=await restarted.check();assert.equal(s.error,'');assert.equal(s.latest.version,'0.4.0');assert.equal(calls.filter(x=>x===api).length,1);
});
test('rate deadlines respect Retry-After seconds and dates; ordinary 403 stays an HTTP error',async t=>{
 for(const value of ['300',new Date(Date.now()+300000).toUTCString()]){const clock=Date.now();const svc=await createUpdateService(await setup(t,{now:()=>clock,fetchImpl:apiOnly(async()=>new Response('',{status:429,headers:{'retry-after':value}}))}));const s=await svc.check();assert.ok(s.retryAt>=clock+298000);assert.match(s.error,/限流/);}
 const svc=await createUpdateService(await setup(t,{fetchImpl:apiOnly(async()=>new Response('Forbidden',{status:403}))}));const s=await svc.check();assert.match(s.error,/HTTP 403/);assert.doesNotMatch(s.error,/限流/);assert.equal(s.retryAt,null);
});
test('legacy global cooldown migrates without blocking portal checks or discarding preferences',async t=>{
 const clock=Date.now(),config=await setup(t,{now:()=>clock,fetchImpl:async url=>{assert.equal(url,portal);return response(managed('0.4.0'));}});
 await writeFile(path.join(config.directory,'updates.json'),JSON.stringify({automatic:false,preview:true,nextCheckAt:clock+3600000,retryAt:clock+3600000,error:'旧版限流',manifest:staticManifest('0.3.0-alpha.1'),manifestChecked:clock-900000}));
 const svc=await createUpdateService(config);assert.equal((await svc.state()).nextCheckAt,null);const s=await svc.check();assert.equal(s.automatic,false);assert.equal(s.publicVersion,'0.4.0');assert.equal(s.error,'');assert.equal(s.retryAt,clock+3600000);
});
test('offline results keep dated downloads and higher known releases without claiming a fresh check',async t=>{
 let clock=Date.now(),mode='release';const svc=await createUpdateService(await setup(t,{now:()=>clock,fetchImpl:async url=>{if(mode==='offline')throw new TypeError('offline');if(mode==='release')return url===api?response([release('0.5.0')]):unavailable();return url===portal?response(managed('0.4.0')):unavailable();}}));
 const first=await svc.check();mode='portal';clock+=300001;const next=await svc.check();assert.equal(next.latest.version,'0.5.0');assert.equal(next.lastChecked,first.lastChecked);mode='offline';clock+=300001;const failed=await svc.check();assert.match(failed.error,/连接/);assert.doesNotMatch(failed.error,/存储/);assert.equal(failed.checkedAt,next.checkedAt);assert.equal(failed.publicChecked,next.publicChecked);assert.equal(failed.latest.version,'0.5.0');
});
test('invalid public manifests and nonofficial download links fail closed',async t=>{
 for(const modify of [d=>d.tag='desktop-v9.0.0',d=>d.assets['mac-arm64']='https://evil.example/app.dmg',d=>d.assets['mac-arm64']+='?redirect=evil',d=>d.assets.bad='https://evil.example',d=>d.version='nonsense']){
  const data=staticManifest('0.4.0');modify(data);assert.equal(publishedDownload(data,options),null);
  const svc=await createUpdateService(await setup(t,{fetchImpl:async url=>url===api?unavailable():response(url===portal?{manifest:data}:data)}));const s=await svc.check();assert.equal(s.latest,null);assert.equal(s.publicVersion,null);assert.equal(s.checkedAt,null);
 }
});
test('malformed, oversized and unknown responses never report a successful check',async t=>{
 for(const fetchImpl of [async()=>response({bad:true}),async()=>new Response('not json'),async()=>new Response('[]',{headers:{'content-length':String(5*1024*1024)}})]){const s=await (await createUpdateService(await setup(t,{fetchImpl}))).check();assert.ok(s.error);assert.equal(s.checkedAt,null);assert.equal(s.latest,null);}
});
test('corrupt settings pause automatic checks; a successful manual check recovers',async t=>{
 const config=await setup(t,{fetchImpl:async()=>response(managed('0.4.0'))});await writeFile(path.join(config.directory,'updates.json'),'{broken');const svc=await createUpdateService(config);assert.equal((await svc.state()).automatic,false);assert.match((await svc.state()).error,/设置/);const s=await svc.check();assert.equal(s.error,'');assert.equal(s.automatic,false);
});
test('cache write errors are separate from successful network checks and do not remove downloadable updates',async t=>{
 const config=await setup(t,{fetchImpl:async()=>response(managed('0.4.0'))});const svc=await createUpdateService(config);await rm(config.directory,{recursive:true});await writeFile(config.directory,'not a directory');const s=await svc.check();assert.equal(s.error,'');assert.match(s.warning,/缓存未能保存/);assert.equal(s.latest.version,'0.4.0');assert.ok(s.checkedAt);
});
test('automatic failures retry after backoff, not six hours; manual checks retain a short retry window',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});let clock=Date.now(),calls=0,online=false;
 const svc=await createUpdateService(await setup(t,{now:()=>clock,fetchImpl:async url=>{calls++;if(online&&url===portal)return response(managed('0.4.0'));throw new TypeError('offline');}}));t.after(()=>svc.close());
 svc.start();svc.start();assert.equal(calls,0);clock+=15000;t.mock.timers.tick(15000);await settled(svc);assert.equal(calls,3);
 clock+=45000;t.mock.timers.tick(45000);assert.equal(calls,3);clock+=60000;t.mock.timers.tick(60000);await settled(svc);assert.equal(calls,6);
 const failed=await svc.state();assert.equal(failed.nextCheckAt,clock+60000);clock+=60001;await svc.check();assert.equal(calls,9);
 online=true;clock+=240000;t.mock.timers.tick(300000);await settled(svc);assert.equal((await svc.state()).error,'');assert.equal(calls,10);
 clock+=60000;t.mock.timers.tick(60000);assert.equal(calls,10);
});
test('automatic-off makes no startup requests, and stable builds default to stable selection',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});let calls=0;const svc=await createUpdateService(await setup(t,{currentVersion:'0.3.0',fetchImpl:async()=>{calls++;return response(managed('0.4.0'));}}));t.after(()=>svc.close());assert.equal((await svc.state()).preview,false);await svc.preferences({automatic:false});svc.start();t.mock.timers.tick(21600000);assert.equal(calls,0);await svc.check();assert.equal(await svc.claimNotice('desktop-v0.4.0'),false);
});
