import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import updates from '../desktop/updates.cjs';
const {compare,selectRelease,createUpdateService}=updates;
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
 let mode='ok';const config=await setup(t,{fetchImpl:async()=>mode==='ok'?response([release('0.3.0-alpha.9')]):mode==='limit'?new Response('',{status:403}):Promise.reject(new TypeError('fetch failed'))});
 const svc=await createUpdateService(config);const first=await svc.check();mode='limit';const second=await svc.check();assert.match(second.error,/限制/);assert.equal(second.latest.tag,first.latest.tag);assert.equal(second.lastChecked,first.lastChecked);
 mode='offline';const third=await svc.check();assert.match(third.error,/无法检查/);assert.equal(third.checking,false);
});
test('channel changes during an in-flight request cannot leak a preview update into stable',async t=>{
 let resolve;const gate=new Promise(r=>resolve=r);const svc=await createUpdateService(await setup(t,{fetchImpl:async()=>{await gate;return response([release('0.4.0-beta.1')]);}}));
 const checking=svc.check();await svc.preferences({preview:false});resolve();const result=await checking;assert.equal(result.latest,null);assert.equal(result.preview,false);
});
test('invalid remote responses fail closed, while empty public releases are a successful check',async t=>{
 let payload={bad:true};const svc=await createUpdateService(await setup(t,{fetchImpl:async()=>response(payload)}));
 assert.match((await svc.check()).error,/格式/);payload=[];const result=await svc.check();assert.equal(result.error,'');assert.equal(result.latest,null);assert.ok(result.lastChecked);
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
