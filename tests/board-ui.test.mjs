import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,writeFile,mkdir,symlink,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setup} from '../dist/workspace/setup.js';
import * as store from '../dist/opportunities/store.js';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
import {renderMarkdown,localLink} from '../dist/board/markdown.js';

async function fixture(t){const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-board-ui-'));const workspace=path.join(dir,'workspace');await setup(workspace,false);const build=await buildCollection(workspace),server=await startPreview(build.directory,workspace);t.after(async()=>{await server.close();await rm(dir,{recursive:true,force:true});});const request=(route,init)=>fetch(server.url+route,init);const session=await (await request('/api/board/session')).json();return {dir,workspace,server,request,session,headers:{Origin:server.url,'Content-Type':'application/json','X-Career-Token':session.token}};}

test('board and resume share one server; an empty board is useful without a resume',async t=>{
 const f=await fixture(t);const home=await (await f.request('/')).text();assert.match(home,/还没有生成简历/);assert.match(home,/href="\/board"/);
 const page=await f.request('/board');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/object-src 'none'/);const html=await page.text();for(const text of ['data-tab="overview">职位描述','公司分析','岗位匹配','资料','file-tree'])assert.ok(html.includes(text));
 assert.deepEqual(f.session.documents.map(({label,path})=>({label,path})),[{label:'职位描述',path:'job.md'},{label:'公司分析',path:'analysis/company.md'},{label:'岗位匹配',path:'analysis/match.md'}]);
 assert.equal((await (await f.request('/api/board/overview')).json()).total,0);assert.equal(Object.keys(f.session.platforms).length,7);
 for(const asset of ['pdf.mjs','pdf.worker.mjs','standard_fonts/LiberationSans-Regular.ttf'])assert.equal((await f.request('/board-assets/pdf/'+asset)).status,200);
 assert.equal((await f.request('/board-assets/pdf/%2e%2e%2fapi.js')).status,400);
 assert.equal((await f.request('/api/board/session',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
});

test('Markdown, attachments and dedicated tabs read the same live files',async t=>{
 const f=await fixture(t),op=await store.add(f.workspace,{company:'测试（虚构）',title:'产品',body:'# 概况\n\n## 下一步\n研究公司'});const base=path.join(f.workspace,'opportunities',op.id);await mkdir(path.join(base,'analysis'));await writeFile(path.join(base,'analysis/company.md'),'# 公司分析\n\n## 产品\n第一版');
 const url='/api/board/file?'+new URLSearchParams({id:op.id,path:'analysis/company.md'});const doc=await (await f.request(url)).json();assert.match(doc.html,/<h1 id="公司分析">/);assert.equal(doc.toc[1].label,'产品');
 await writeFile(path.join(base,'analysis/company.md'),'# 公司分析\n\n## 产品\nAgent 更新后的第二版');const fresh=await (await f.request(url)).json();assert.notEqual(doc.sha256,fresh.sha256);assert.match(fresh.html,/Agent 更新/);
 const attachment=path.join(f.dir,'sample.pdf');await writeFile(attachment,'%PDF-1.7\nsynthetic');await store.attach(f.workspace,op.id,attachment);
 const pdf=await f.request('/api/board/file?'+new URLSearchParams({id:op.id,path:'attachments/sample.pdf'}));assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.match(await pdf.text(),/^%PDF/);
 const raw=await f.request(url+'&download=1');assert.match(raw.headers.get('content-disposition'),/^attachment/);assert.match(await raw.text(),/^# 公司分析/);
 const context=await (await f.request('/api/board/context?id='+op.id)).json();assert.match(context.prompt,/opportunity context/);assert.ok(context.prompt.includes(op.id));assert.ok(context.next_reads.some(x=>x.path.endsWith('analysis/company.md')));
 const detail=await (await f.request('/api/board/detail?id='+op.id)).json();assert.ok(detail.files.some(x=>x.path.endsWith('attachments/sample.pdf')));
});

test('UI rating and stage writes preserve facts, use session guards and reject stale hashes',async t=>{
 const f=await fixture(t),op=await store.add(f.workspace,{company:'测试',title:'产品',body:'用户原话'});const send=(route,body,headers=f.headers)=>f.request('/api/board/'+route+'?id='+op.id,{method:'POST',headers,body:JSON.stringify(body)});
 assert.equal((await send('rate',{stars:5,sha256:op.sha256},{...f.headers,Origin:'https://other.example'})).status,403);
 assert.equal((await send('rate',{stars:5,sha256:op.sha256},{...f.headers,'X-Career-Token':'bad'})).status,403);
 assert.equal((await send('rate',{stars:5,sha256:op.sha256})).status,200);
 assert.equal((await send('stage',{stage:'interviewing',sha256:op.sha256})).status,409);
 let detail=await store.show(f.workspace,op.id);assert.equal(detail.card.meta.user_rating,5);assert.equal(detail.card.body,'用户原话');
 assert.equal((await send('stage',{stage:'archived',sha256:detail.card.sha256})).status,400);
 assert.equal((await send('stage',{stage:'interviewing',sha256:detail.card.sha256})).status,200);
 detail=await store.show(f.workspace,op.id);assert.equal(detail.card.meta.stage,'interviewing');assert.equal(detail.recent_activity[0].meta.actor,'user');
 assert.equal((await send('rate',{stars:'none',sha256:detail.card.sha256})).status,200);
 assert.equal((await store.show(f.workspace,op.id)).card.meta.user_rating,null);
});

test('file preview cannot escape the card, follow links or execute HTML',async t=>{
 const f=await fixture(t),op=await store.add(f.workspace,{company:'测试',title:'产品'}),base=path.join(f.workspace,'opportunities',op.id);await writeFile(path.join(base,'.hidden'),'secret');await writeFile(path.join(f.dir,'private.txt'),'secret');await symlink(path.join(f.dir,'private.txt'),path.join(base,'link.txt'));
 for(const p of ['../../career.json','.hidden','link.txt','/etc/passwd','../'+op.id+'/card.md'])assert.equal((await f.request('/api/board/file?'+new URLSearchParams({id:op.id,path:p}))).status,400,p);
 const file=path.join(f.dir,'unsafe.html');await writeFile(file,'<script>alert(1)</script>');await store.attach(f.workspace,op.id,file);const raw=await f.request('/api/board/file?'+new URLSearchParams({id:op.id,path:'attachments/unsafe.html'}));assert.match(raw.headers.get('content-disposition'),/^attachment/);assert.equal(raw.headers.get('content-type'),'application/octet-stream');
});

test('Markdown supports headings, tables and local references while escaping untrusted markup',()=>{
 const doc=renderMarkdown('# 同名\n\n# 同名\n\n| 项 | 值 |\n|---|---|\n| A | B |\n\n<script>alert(1)</script>\n\n[坏链接](javascript:alert(1))\n\n[PDF](../attachments/a.pdf)\n\n![远端](https://example.com/track.png)\n\n![本地](../attachments/a.png)\n\n[官网](https://example.com)','opp-test','analysis/company.md');
 assert.equal(doc.toc[0].id,'同名');assert.equal(doc.toc[1].id,'同名-2');assert.match(doc.html,/<table>/);assert.ok(!doc.html.includes('<script>'));assert.ok(!doc.html.includes('href="javascript:'));assert.match(doc.html,/data-document="attachments\/a.pdf"/);assert.ok(!doc.html.includes('src="https://'));assert.match(doc.html,/rel="noopener noreferrer"/);assert.match(doc.html,/src="\/api\/board\/file/);
 for(const href of ['../../outside.md','%2e%2e/%2e%2e/secret','file:///etc/passwd','//evil','https://evil','../.hidden'])assert.equal(localLink('analysis/company.md',href),null);
});

test('UI preferences merge locally and protected interview writes retain document bodies',async t=>{
 const f=await fixture(t),op=await store.add(f.workspace,{company:'虚构公司',title:'产品'});
 const send=(route,data,headers=f.headers)=>f.request('/api/board/'+route,{method:'POST',headers,body:JSON.stringify(data)});
 await writeFile(path.join(f.workspace,'.local/ui-preferences.json'),JSON.stringify({resume:{zoom:90},board:{density:'compact'}}));
 assert.equal((await send('preferences',{drawer_width:900},{...f.headers,Origin:'https://evil.invalid'})).status,403);
 assert.equal((await send('preferences',{drawer_width:1})).status,400);
 assert.equal((await send('preferences',{drawer_width:910})).status,200);
 const prefs=await (await f.request('/api/board/preferences')).json();assert.deepEqual(prefs,{resume:{zoom:90},board:{density:'compact',drawer_width:910}});
 let r=await send('interview?id='+op.id,{title:'技术一面',scheduled_at:null,status:'planned'});assert.equal(r.status,200);const round=await r.json();
 const written=await store.saveInterview(f.workspace,op.id,{id:round.id,title:'技术一面',body:'用户的面试记录'},round.sha256);
 assert.equal((await send('interview?id='+op.id,{round:round.id,title:'旧版本',status:'completed',sha256:round.sha256})).status,409);
 assert.equal((await send('interview?id='+op.id,{round:round.id,title:'一面',status:'completed',sha256:written.sha256})).status,200);
 const ctx=await (await f.request('/api/board/interview-context?'+new URLSearchParams({id:op.id,round:round.id}))).json();assert.equal(ctx.selected_interview.body,'用户的面试记录');assert.equal(ctx.card.meta.stage,'inbox');
 r=await send('stage?id='+op.id,{stage:'ended',outcome:'withdrawn',sha256:op.sha256});assert.equal(r.status,200);let state=await r.json();
 r=await send('archive?id='+op.id,{archived:true,sha256:state.sha256});assert.equal(r.status,200);state=await r.json();
 assert.equal((await send('archive?id='+op.id,{archived:false,sha256:state.sha256})).status,200);assert.equal((await store.show(f.workspace,op.id)).card.meta.outcome,'withdrawn');
});
