import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,readFile,writeFile,mkdir,rename,symlink,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {WorkspaceManager} from '../dist/workspace/local.js';
import {setup,config,updateConfig} from '../dist/workspace/setup.js';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
import {root} from '../dist/presentation/io.js';
async function fixture(t){const base=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-local-'));t.after(()=>rm(base,{force:true,recursive:true}));return {base,manager:new WorkspaceManager(path.join(base,'settings/workspaces.json'))};}
const readJson=async f=>JSON.parse(await readFile(f,'utf8'));

test('named folder creation installs Agent context and a usable local CLI without downloading',async t=>{
 const {base,manager}=await fixture(t),entry=await manager.create(base,'我的求职');
 assert.equal(entry.path,path.join(base,'我的求职'));assert.equal((await config(entry.path)).name,'我的求职');
 for(const file of ['AGENTS.md','.agents/skills/career-setup/SKILL.md','.agents/skills/career-git/SKILL.md','context/goals.md','resume/facts/profile.md','.career/run.mjs'])await access(path.join(entry.path,file));
 assert.equal((await readJson(path.join(entry.path,'package.json'))).scripts.career,'node .career/run.mjs');
 assert.match(await readFile(path.join(entry.path,'.gitignore'),'utf8'),/\.local\//);
 const result=JSON.parse(execFileSync(process.execPath,[path.join(entry.path,'.career/run.mjs'),'doctor','--json'],{cwd:base,encoding:'utf8'}));
 assert.equal(result.initialized??result.data?.initialized,true);
 await updateConfig(entry.path,c=>{c.custom={keep:true};});
 await manager.renameWorkspace(entry.path,'春季机会','我的求职');
 assert.equal((await config(entry.path)).name,'春季机会');assert.deepEqual((await config(entry.path)).custom,{keep:true});
 assert.equal((await manager.list(entry.path)).current.path,entry.path);
 await assert.rejects(manager.renameWorkspace(entry.path,'另一个名称','我的求职'),/名称已改变/);
 // A relocated folder can resolve the installed package if the original runtime no longer exists.
 const runtime=path.join(entry.path,'.local/runtime.json');await writeFile(runtime,JSON.stringify({node:'/nonexistent/node',cli:'/nonexistent/cli'}));
 await mkdir(path.join(entry.path,'node_modules/@heyjianhang/career/dist'),{recursive:true});
 await writeFile(path.join(entry.path,'node_modules/@heyjianhang/career/dist/cli.js'),"console.log('installed fallback')");
 assert.equal(execFileSync(process.execPath,[path.join(entry.path,'.career/run.mjs')],{encoding:'utf8'}).trim(),'installed fallback');
});

test('creation is non-destructive and rejects nesting, unsafe names, links and program directories',async t=>{
 const {base,manager}=await fixture(t);await mkdir(path.join(base,'existing'));await writeFile(path.join(base,'existing/notes.md'),'keep');
 await assert.rejects(manager.create(base,'existing'),/同名文件夹/);assert.equal(await readFile(path.join(base,'existing/notes.md'),'utf8'),'keep');
 const current=await manager.create(base,'workspace');await mkdir(path.join(current.path,'child'));
 await assert.rejects(manager.create(path.join(current.path,'child'),'nested'),/不能嵌套/);
 for(const name of ['../outside','a/b','a\\b','CON','NUL.txt','末尾.','', 'x'.repeat(61)])await assert.rejects(manager.create(base,name));
 const child='forbidden-local-workspace-'+process.pid;await assert.rejects(manager.create(root,child),/程序安装目录/);await assert.rejects(access(path.join(root,child)));
 if(process.platform!=='win32'){await symlink(current.path,path.join(base,'linked'));await assert.rejects(manager.entry(path.join(base,'linked')),/符号链接/);await assert.rejects(manager.browse(path.join(base,'linked')),/符号链接/);}
});

test('registry survives restarts, concurrent remembers, missing paths and explicit relocation',async t=>{
 const {base,manager}=await fixture(t),a=await manager.create(base,'a'),b=await manager.create(base,'b');
 await Promise.all([manager.remember(a.path),manager.remember(b.path)]);
 const reloaded=new WorkspaceManager(manager.registryFile);assert.equal((await reloaded.list(a.path)).recent.length,2);
 const moved=path.join(base,'relocated');await rename(b.path,moved);
 assert.equal((await reloaded.list(a.path)).recent.find(e=>e.id===b.id).available,false);
 await reloaded.remember(moved,b.id);const listed=await reloaded.list(a.path);assert.equal(listed.recent.length,2);assert.equal(listed.recent[0].path,moved);assert.equal(listed.recent[0].name,'b');
 await writeFile(manager.registryFile,'broken');await assert.rejects(manager.remember(a.path));assert.equal(await readFile(manager.registryFile,'utf8'),'broken');
});

test('workspace API authenticates changes and keeps old tabs pinned to their own files',async t=>{
 const {base,manager}=await fixture(t),workspace=path.join(base,'original');await setup(workspace,false);
 const built=await buildCollection(workspace),server=await startPreview(built.directory,workspace,0,true,{registryFile:manager.registryFile});
 let closed=false;t.after(async()=>{if(!closed)await server.close();});
 const session=await(await fetch(server.url+'/api/workspaces/session')).json();
 const post=async(origin,token,route,data)=>fetch(origin+'/api/'+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Career-Token':token},body:JSON.stringify(data)});
 assert.equal((await post(server.url,'bad','workspaces/create',{parent:base,name:'denied'})).status,403);await assert.rejects(access(path.join(base,'denied')));
 assert.equal((await fetch(server.url+'/api/workspaces/session',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
 assert.equal((await fetch(server.url+'/api/workspaces/browse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:base})})).status,403);
 const created=await post(server.url,session.token,'workspaces/create',{parent:base,name:'第二份资料'});assert.equal(created.status,200);const other=await created.json(),otherOrigin=new URL(other.url).origin;assert.notEqual(otherOrigin,server.url);
 const otherSession=await(await fetch(otherOrigin+'/api/workspaces/session')).json();assert.equal(otherSession.current.name,'第二份资料');assert.notEqual(otherSession.token,session.token);
 assert.equal((await post(otherOrigin,session.token,'workspaces/rename',{name:'wrong',previous:'第二份资料'})).status,403);
 assert.equal((await post(server.url,session.token,'library/create',{title:'仅在第一份资料'})).status,200);
 assert.equal((await(await fetch(server.url+'/api/library/list')).json()).entries.length,1);
 assert.equal((await(await fetch(otherOrigin+'/api/library/list')).json()).entries.length,0);
 const reopened=await(await post(server.url,session.token,'workspaces/open',{path:other.path})).json();assert.equal(reopened.url,other.url);
 const back=await(await post(otherOrigin,otherSession.token,'workspaces/open',{path:workspace})).json();assert.equal(back.url,server.url+'/board');
 await server.close();closed=true;
 await assert.rejects(fetch(otherOrigin+'/api/workspaces/session'));await assert.rejects(fetch(server.url+'/api/workspaces/session'));
});
