import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,mkdir,writeFile,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setup} from '../dist/workspace/setup.js';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
import {inventory,readMaterial} from '../dist/profile/store.js';
import {prepareProfileDemo} from '../scripts/prepare-profile-demo.mjs';
async function fixture(t){const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-profile-'));const workspace=path.join(dir,'workspace');await setup(workspace,false);const build=await buildCollection(workspace),server=await startPreview(build.directory,workspace,0,true);t.after(async()=>{await server.close();await rm(dir,{recursive:true,force:true});});return {dir,workspace,request:(route,init)=>fetch(server.url+route,init)};}
test('personal materials expose existing facts, preferences and sources without a second data store',async t=>{
 const f=await fixture(t);await prepareProfileDemo(f.workspace);
 const data=await inventory(f.workspace);assert.equal(data.files.filter(x=>x.group==='projects').length,2);assert.ok(data.groups.some(x=>x.id==='goals'));assert.ok(!data.groups.some(x=>x.id==='master'));
 const p='resume/facts/projects/project-demo-knowledge.md',doc=await readMaterial(f.workspace,p);assert.equal(doc.title,'企业知识助手');assert.ok(doc.fields.some(x=>x.label==='担任角色'));assert.match(doc.html,/data-document="resume\/sources\/source-demo-profile\/项目说明.pdf"/);assert.equal(doc.references.length,2);assert.match(doc.source,/synthetic: true/);
 await writeFile(path.join(f.workspace,'context/goals.md'),'# 求职偏好\n\n杭州或远程，新补充的目标。');const changed=await inventory(f.workspace);assert.notEqual(data.revision,changed.revision);assert.match((await readMaterial(f.workspace,'context/goals.md')).html,/新补充/);
 const html=await (await f.request('/profile')).text();assert.match(html,/我的资料/);assert.match(html,/material-outline/);const board=html.indexOf('aria-label="求职看板"'),resume=html.indexOf('aria-label="简历"');assert.ok(board>=0&&resume>board);assert.equal((await f.request('/api/profile/index')).status,200);
 const download=await f.request('/api/profile/file?path='+encodeURIComponent(p)+'&download=1');assert.match(download.headers.get('content-disposition'),/^attachment/);assert.equal(await download.text(),doc.source);
 assert.equal((await f.request('/api/profile/index',{method:'POST'})).status,405);
});
test('materials scope excludes configuration, secrets, snapshots, traversal and symlinks',async t=>{
 const f=await fixture(t);await mkdir(path.join(f.workspace,'resume/sources/safe'),{recursive:true});await writeFile(path.join(f.dir,'secret.txt'),'private');await symlink(path.join(f.dir,'secret.txt'),path.join(f.workspace,'resume/sources/safe/linked.txt'));await symlink(f.dir,path.join(f.workspace,'resume/sources/linked-dir'));await writeFile(path.join(f.workspace,'resume/sources/safe/.secret'),'private');
 const data=await inventory(f.workspace);assert.ok(!data.files.some(x=>x.path.includes('linked')||x.path.includes('.secret')));
 for(const p of ['career.json','.env','.git/config','resume/presentations/demo/package.json','../secret.txt','resume/facts/../../career.json','resume/facts/./profile.md','resume/sources/safe/linked.txt','resume/sources/linked-dir/secret.txt','resume/sources/safe/.secret','/etc/passwd','resume\\facts\\profile.md'])assert.equal((await f.request('/api/profile/file?'+new URLSearchParams({path:p}))).status,400,p);
 assert.equal((await f.request('/api/profile/index',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
 await writeFile(path.join(f.workspace,'resume/sources/safe/unsafe.html'),'<script>alert(1)</script>');const r=await f.request('/api/profile/file?path=resume/sources/safe/unsafe.html');assert.equal(r.headers.get('content-type'),'application/octet-stream');assert.match(r.headers.get('content-disposition'),/^attachment/);
});
test('reader escapes markup, preserves unknown fields in source, and handles empty or malformed facts',async t=>{
 const f=await fixture(t);await writeFile(path.join(f.workspace,'resume/facts/profile.md'),'---\nname: "<img src=x onerror=alert(1)>"\ncustom_field: original\n---\n# 基本资料\n\n## 空标题\n\n## 介绍\n<script>alert(1)</script>\n\n![tracking](https://example.com/track.png)');
 const d=await readMaterial(f.workspace,'resume/facts/profile.md');assert.ok(!d.html.includes('<script>'));assert.ok(!d.html.includes('src="https://'));assert.ok(!d.html.includes('空标题'));assert.match(d.source,/custom_field: original/);assert.equal(d.fields[0].value,'<img src=x onerror=alert(1)>');
 await writeFile(path.join(f.workspace,'resume/facts/profile.md'),'---\nname: A\nname: B\n---\n# 未解析');const malformed=await readMaterial(f.workspace,'resume/facts/profile.md');assert.ok(malformed.warning);assert.match(malformed.source,/name: B/);
});

test('JD research reports and sources share the materials reader with a bounded scope',async t=>{
 const f=await fixture(t),base='research/jd/demo';await mkdir(path.join(f.workspace,base,'sources'),{recursive:true});
 await writeFile(path.join(f.workspace,base,'report.md'),'# 方向研究\n\n[JD 原文](sources/jd-001.md)\n\n[补足计划](plan.md)');
 await writeFile(path.join(f.workspace,base,'plan.md'),'# 补足计划\n\n待核对本人贡献，不代表已经掌握。');
 await writeFile(path.join(f.workspace,base,'sources/jd-001.md'),'# 合成岗位原文\n\n负责客户服务。');
 await writeFile(path.join(f.workspace,'research/private.md'),'unrelated');
 await writeFile(path.join(f.workspace,base,'.env'),'SECRET=fixture');
 await symlink(path.join(f.workspace,'research/private.md'),path.join(f.workspace,base,'linked.md'));
 const data=await inventory(f.workspace);assert.equal(data.files.filter(x=>x.group==='research').length,3);
 assert.ok(data.groups.some(x=>x.id==='research'&&x.label==='岗位调研'));
 const report=await readMaterial(f.workspace,base+'/report.md');assert.match(report.html,/data-document="research\/jd\/demo\/sources\/jd-001.md"/);
 const source=await f.request('/api/profile/file?'+new URLSearchParams({path:base+'/sources/jd-001.md',download:'1'}));assert.equal(source.status,200);assert.match(await source.text(),/负责客户服务/);
 await writeFile(path.join(f.workspace,base,'plan.md'),'# 补足计划\n\n已核对，引用事实记录。');assert.notEqual((await inventory(f.workspace)).revision,data.revision);
 for(const file of ['research/private.md',base+'/.env',base+'/linked.md'])assert.equal((await f.request('/api/profile/file?'+new URLSearchParams({path:file}))).status,400,file);
});
