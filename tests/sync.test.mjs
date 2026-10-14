import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,writeFile,readFile,mkdir,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setup,updateConfig} from '../dist/workspace/setup.js';
import {git,initHistory,saveHistory,restore} from '../dist/workspace/git.js';
import {runSync,syncOverview,syncPreferences,SyncScheduler} from '../dist/workspace/sync.js';
import {SetupError} from '../dist/workspace/process.js';
const verify=async()=> 'fixture/private';
async function fixture(t){
 const root=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-sync-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const a=path.join(root,'a'),b=path.join(root,'b'),remote=path.join(root,'cloud.git');
 await setup(a,false);await initHistory(a,'Fixture','fixture@example.invalid');await updateConfig(a,c=>{c.sync={repository:'fixture/private',mode:'ask'};});await saveHistory(a,'initial');
 await git(root,'init','--bare','--initial-branch=main',remote);await git(a,'remote','add','origin',remote);await git(a,'push','--set-upstream','origin','main');
 await git(root,'clone',remote,b);await initHistory(b,'Other fixture','other@example.invalid');
 return {root,a,b,remote};
}
async function write(w,file,text){await writeFile(path.join(w,'context',file),text);}
const read=(w,file)=>readFile(path.join(w,'context',file),'utf8');
const head=w=>git(w,'rev-parse','HEAD');
test('sync saves edits automatically; update fetches without uploading; merges disjoint edits',async t=>{
 const {a,b,remote}=await fixture(t);await write(a,'state.md','# A edits');await runSync(a,'sync',verify);
 await write(b,'goals.md','# B edits');const previous=await git(remote,'rev-parse','main');const update=await runSync(b,'update',verify);
 assert.equal(update.updated,true);assert.equal(update.synced,false);assert.equal(await git(remote,'rev-parse','main'),previous);
 assert.equal(await read(b,'state.md'),'# A edits');assert.equal(await read(b,'goals.md'),'# B edits');
 await runSync(b,'sync',verify);assert.equal(await head(b),await git(remote,'rev-parse','main'));await runSync(a,'update',verify);assert.equal(await read(a,'goals.md'),'# B edits');
 assert.equal((await syncOverview(b)).last_result.ok,true);
});
test('same-file conflicts preserve both histories and local content with no merge left pending',async t=>{
 const {a,b,remote}=await fixture(t);await write(a,'state.md','# A');await runSync(a,'sync',verify);await write(b,'state.md','# B');
 const cloud=await git(remote,'rev-parse','main');await assert.rejects(runSync(b,'sync',verify),e=>e.code==='SYNC_CONFLICT'&&e.details.files.includes('context/state.md'));
 assert.equal(await read(b,'state.md'),'# B');assert.equal(await git(remote,'rev-parse','main'),cloud);assert.equal(await git(b,'show','refs/remotes/origin/main:context/state.md'),'# A');
 await assert.rejects(access(path.join(b,'.git/MERGE_HEAD')));assert.equal((await syncOverview(b)).paused,true);
});
test('offline sync saves a local version and can retry; local-only files never upload',async t=>{
 const {a,remote}=await fixture(t);await write(a,'state.md','# Offline change');await writeFile(path.join(a,'.local/private.txt'),'local secret');await writeFile(path.join(a,'unmanaged.txt'),'outside scope');
 const before=await head(a);await assert.rejects(runSync(a,'sync',async()=>{throw new SetupError('COMMAND_FAILED','offline');}),/offline/);assert.notEqual(await head(a),before);
 const state=await syncOverview(a);assert.equal(state.last_result.ok,false);assert.equal(state.last_sync,undefined);
 await runSync(a,'sync',verify);assert.equal(await head(a),await git(remote,'rev-parse','main'));assert.doesNotMatch(await git(a,'ls-files'),/private.txt|unmanaged.txt|sync.json/);
});
test('invalid and unsafe remote trees never replace working files',async t=>{
 const {a,b}=await fixture(t);await writeFile(path.join(b,'career.json'),'{}');await git(b,'add','career.json');await git(b,'commit','-m','invalid');await git(b,'push');const before=await head(a);
 await assert.rejects(runSync(a,'update',verify));assert.equal(await head(a),before);assert.match(await readFile(path.join(a,'career.json'),'utf8'),/career-workspace/);
});
test('restore uses a new directory, handles empty repo, rejects existing target and keeps auto-sync off',async t=>{
 const {a,root,remote}=await fixture(t);await syncPreferences(a,{automatic:true,interval_minutes:2});const restored=path.join(root,'restored');
 await restore(restored,'fixture/private',async()=>({empty:false,url:remote}));assert.equal((await syncPreferences(restored)).automatic,false);await assert.rejects(restore(restored,'fixture/private'),e=>e.code==='DIRECTORY_EXISTS');
 const empty=path.join(root,'empty');await restore(empty,'fixture/empty',async()=>({empty:true,url:path.join(root,'empty.git')}));assert.equal(JSON.parse(await readFile(path.join(empty,'career.json'))).sync.repository,'fixture/empty');assert.equal(await git(empty,'branch','--show-current'),'main');
});
test('scheduler opt-in, quiet period, opening update, timed sync, and disabling',async t=>{
 const {a}=await fixture(t);let now=100000;const calls=[];const scheduler=new SyncScheduler(a,async(w,op)=>{calls.push(op);},()=>now);
 await scheduler.tick();assert.equal(calls.length,0);await syncPreferences(a,{automatic:true,interval_minutes:1});await scheduler.tick();now+=31000;await scheduler.tick();assert.deepEqual(calls,['update']);
 now+=61000;await scheduler.tick();assert.deepEqual(calls,['update','sync']);await syncPreferences(a,{automatic:false});now+=61000;await scheduler.tick();assert.equal(calls.length,2);await scheduler.stop();
 await assert.rejects(syncPreferences(a,{automatic:'yes'}));await assert.rejects(syncPreferences(a,{interval_minutes:0}));
});
