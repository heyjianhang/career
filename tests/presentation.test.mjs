import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,realpath,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {check,hash,readPreference,readDefaultTheme,savePreference} from '../dist/presentation/io.js';
import {build,loadBuild} from '../dist/presentation/build.js';
import {startPreview} from '../dist/presentation/server.js';
const fixture=JSON.parse(await readFile(new URL('../examples/presentation/package.json',import.meta.url),'utf8'));
async function setup(t) {const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-presentation-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'input.json');await writeFile(file,JSON.stringify(fixture));return {dir,file};}
async function change(file,fn) {const data=structuredClone(fixture);fn(data);await writeFile(file,JSON.stringify(data));return data;}

test('validates the complete synthetic package and distinguishes partial platform coverage',async t=>{
  const {file}=await setup(t);const result=await check(file);assert.equal(result.input.id,fixture.id);assert.equal(result.warnings.filter(x=>x.code==='PARTIAL_PLATFORM').length,4);
});
test('rejects invented platform fields and duplicate entries instead of silently dropping them',async t=>{
  const {file}=await setup(t);await change(file,d=>d.reports.zhaopin.sections[2].fields.push({key:'role',value:'研发'}));await assert.rejects(check(file),/未支持的字段/);
  await change(file,d=>d.resume.sections[1].items[0].id=d.resume.sections[0].items[0].id);await assert.rejects(check(file),/重复 ID/);
});
test('preserves long content and reports estimated length without truncation',async t=>{
  const {file}=await setup(t);const text='测试'.repeat(600);await change(file,d=>d.reports.liepin.sections[0].fields[0].value=text);const result=await check(file);assert.equal(result.input.reports.liepin.sections[0].fields[0].value,text);assert.ok(result.warnings.some(w=>w.code==='LENGTH_REVIEW'));
});
test('requires provenance for real packages and detects stale source files',async t=>{
  const {file,dir}=await setup(t);await change(file,d=>d.synthetic=false);await assert.rejects(check(file,dir),/来源文件/);
  const source='已核对的母版';await writeFile(path.join(dir,'master.md'),source);await change(file,d=>{d.synthetic=false;d.source.files=[{path:'master.md',sha256:hash(source)}];});await check(file,dir);
  await writeFile(path.join(dir,'master.md'),'新内容');await assert.rejects(check(file,dir),/来源已变化/);
  await change(file,d=>d.source.files=[{path:'../outside.md',sha256:hash('x')}]);await assert.rejects(check(file,dir),/工作区内/);
});
test('one missing platform remains visibly missing; no content is fabricated',async t=>{
  const {file,dir}=await setup(t);await change(file,d=>delete d.reports.liepin);const result=await build(file,dir);const page=await readFile(result.html,'utf8');assert.ok(page.includes('还没有猎聘填写稿'));assert.ok(result.warnings.some(x=>x.code==='MISSING_PLATFORM'));
});
test('escapes HTML payloads and keeps provenance out of exported HTML',async t=>{
  const {file,dir}=await setup(t);const payload='<img src=x onerror="alert(1)">';await change(file,d=>{d.resume.name=payload;d.source.resume_id='private-internal-source';});const result=await build(file,dir);const page=await readFile(result.html,'utf8');assert.ok(!page.includes(payload));assert.ok(page.includes('&lt;img'));assert.ok(!page.includes('private-internal-source'));
});
test('builds do not overwrite existing directories and detect modified files',async t=>{
  const {file,dir}=await setup(t);const out=path.join(dir,'build');const result=await build(file,dir,out);await assert.rejects(build(file,dir,out),/EEXIST/);await writeFile(result.html,'hand edit');await assert.rejects(loadBuild(out),/产物已改变/);assert.equal(await readFile(result.html,'utf8'),'hand edit');
});
test('preferences preserve unknown configuration and are used on the next build',async t=>{
  const {file,dir}=await setup(t);const config={schema:'career-workspace/v1',resume_dir:'resume',extensions:{keep:true},presentation:{custom:'keep'}};await writeFile(path.join(dir,'career.json'),JSON.stringify(config));await savePreference(dir,'compact');const after=JSON.parse(await readFile(path.join(dir,'career.json'),'utf8'));assert.deepEqual(after.extensions,config.extensions);assert.equal(after.presentation.custom,'keep');assert.equal(await readPreference(dir),'compact');assert.equal((await build(file,dir)).manifest.theme,'compact');await assert.rejects(savePreference(dir,'invalid'),/未知样式/);
  await savePreference(dir,null);const cleared=JSON.parse(await readFile(path.join(dir,'career.json'),'utf8'));assert.equal(cleared.presentation.default_theme,undefined);assert.equal(cleared.presentation.custom,'keep');assert.deepEqual(cleared.extensions,config.extensions);assert.equal(await readDefaultTheme(dir),null);assert.equal(await readPreference(dir),'classic');assert.equal((await build(file,dir)).manifest.theme,'classic');
});
test('CLI preferences persist across invocations, preserve config and control future builds',async t=>{
  const {file,dir}=await setup(t);const run=promisify(execFile);
  const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
  const execute=async(...args)=>JSON.parse((await run(process.execPath,[cli,'resume',...args,'--json'])).stdout);
  const missing=path.join(dir,'workspace with spaces');
  assert.deepEqual((await execute('preferences','--workspace',missing)).data,{saved_theme:null,effective_theme:'classic'});
  await assert.rejects(readFile(path.join(missing,'career.json')),e=>e.code==='ENOENT');
  const configPath=path.join(dir,'career.json');
  await writeFile(configPath,JSON.stringify({schema:'career-workspace/v1',resume_dir:'resume',extensions:{keep:true},presentation:{custom:'keep'}}));
  const set=await execute('preferences','--workspace',dir,'--theme','compact');assert.equal(set.operation,'resume.preferences');
  assert.deepEqual((await execute('preferences','--workspace',dir)).data,{saved_theme:'compact',effective_theme:'compact'});
  assert.equal((await execute('build','--input',file,'--workspace',dir)).data.manifest.theme,'compact');
  assert.equal((await execute('build','--input',file,'--workspace',dir,'--theme','classic')).data.manifest.theme,'classic');
  const before=await readFile(configPath,'utf8');
  for(const args of [['--theme','unknown'],['--theme','classic','--clear']])await assert.rejects(execute('preferences','--workspace',dir,...args),e=>e.code===1&&JSON.parse(e.stderr).status==='error');
  assert.equal(await readFile(configPath,'utf8'),before);
  assert.deepEqual((await execute('preferences','--workspace',dir,'--clear')).data,{saved_theme:null,effective_theme:'classic'});
  const after=JSON.parse(await readFile(configPath,'utf8'));assert.deepEqual(after.extensions,{keep:true});assert.equal(after.presentation.custom,'keep');
  assert.equal((await execute('build','--input',file,'--workspace',dir)).data.manifest.theme,'classic');
});
test('each resume keeps its applied style independently from the default and frozen builds',async t=>{
  const {file,dir}=await setup(t);
  await savePreference(dir,'compact');
  const snapshot=await build(file,dir);
  await savePreference(dir,'blue-tab',fixture.id);
  assert.equal(await readPreference(dir,fixture.id),'blue-tab');
  assert.equal(await readPreference(dir,'resume-other'),'compact');
  assert.equal(await readDefaultTheme(dir),'compact');
  assert.equal((await build(file,dir)).manifest.theme,'blue-tab');
  assert.equal((await build(file,dir,undefined,'classic')).manifest.theme,'classic');
  assert.equal((await loadBuild(snapshot.directory)).manifest.theme,'compact');
  await savePreference(dir,null);
  assert.equal(await readPreference(dir,fixture.id),'blue-tab');
  assert.equal(await readPreference(dir,'resume-other'),'classic');
  const before=await readFile(path.join(dir,'career.json'),'utf8');
  await assert.rejects(savePreference(dir,'invalid',fixture.id),/未知样式/);
  await assert.rejects(savePreference(dir,'classic','../oops'),/无效简历/);
  assert.equal(await readFile(path.join(dir,'career.json'),'utf8'),before);
});
test('local preview serves only public HTML and protects configuration writes',async t=>{
  const {file,dir}=await setup(t);const result=await build(file,dir);const preview=await startPreview(result.directory,dir);t.after(()=>preview.close());assert.equal((await fetch(preview.url)).status,200);
  assert.equal((await fetch(preview.url+'/.package.json')).status,404);
  const session=await (await fetch(preview.url+'/api/session')).json();
  const send=(origin,token)=>fetch(preview.url+'/api/preference',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-Career-Token':token},body:JSON.stringify({theme:'compact'})});
  assert.equal((await send('https://other.example',session.token)).status,403);assert.equal((await send(preview.url,'invalid')).status,403);assert.equal((await send(preview.url,session.token)).status,200);assert.equal(await readPreference(dir),'compact');
  const headers={'Content-Type':'application/json',Origin:preview.url,'X-Career-Token':session.token};
  assert.equal((await fetch(preview.url+'/api/preference',{method:'POST',headers,body:JSON.stringify({theme:null})})).status,200);
  assert.equal((await (await fetch(preview.url+'/api/session')).json()).savedDefaultTheme,null);
  assert.equal((await fetch(preview.url+'/api/pdf',{method:'POST',headers,body:JSON.stringify({theme:null})})).status,400);
});

test('template registry is the shared source for CLI metadata, selector and snapshot manifest',async t=>{
  const {templateMetadata}=await import('../dist/presentation/templates/registry.js');
  const {file,dir}=await setup(t);const result=await build(file,dir);const page=await readFile(result.html,'utf8');
  assert.deepEqual(result.manifest.templates,templateMetadata.map(({id,version})=>({id,version})));
  for(const metadata of templateMetadata){assert.ok(page.includes(`data-gallery-choice="${metadata.id}"`));assert.ok(page.includes(`id="template-${metadata.id}"`));assert.ok(result.manifest.files[`.print-${metadata.id}.html`]);}
});
test('photos are workspace assets, fingerprinted and embedded without exposing their path',async t=>{
  const {file,dir}=await setup(t);const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8iQAAAAASUVORK5CYII=','base64');
  await writeFile(path.join(dir,'private-photo.png'),png);
  await change(file,d=>d.resume.photo={path:'private-photo.png',sha256:hash(png),alt:'个人照片',position:{x:50,y:25}});
  const checked=await check(file,dir);assert.ok(checked.assets.photo.dataUrl.startsWith('data:image/png;base64,'));
  const result=await build(file,dir);const page=await readFile(result.html,'utf8');assert.ok(page.includes('class="resume-photo"'));assert.ok(!page.includes('private-photo.png'));
  await rm(path.join(dir,'private-photo.png'));await loadBuild(result.directory);
});
test('photo contract rejects remote/escaping paths, wrong hashes, wrong media and invalid crop positions',async t=>{
  const {file,dir}=await setup(t);
  for(const photo of [{path:'https://example.com/x.jpg',sha256:hash('x'),alt:'头像'},{path:'../photo.jpg',sha256:hash('x'),alt:'头像'}]){await change(file,d=>d.resume.photo=photo);await assert.rejects(check(file,dir),/照片路径/);}
  await writeFile(path.join(dir,'photo.jpg'),'not an image');await change(file,d=>d.resume.photo={path:'photo.jpg',sha256:hash('different'),alt:'头像'});await assert.rejects(check(file,dir),/照片已变化/);
  await change(file,d=>d.resume.photo={path:'photo.jpg',sha256:hash('not an image'),alt:'头像'});await assert.rejects(check(file,dir),/PNG\/JPEG/);
  await change(file,d=>d.resume.photo={path:'photo.jpg',sha256:hash('x'),alt:'头像',position:{x:101,y:50}});await assert.rejects(check(file,dir),/内容包格式/);
});
test('legacy snapshots remain readable while missing or unsafe template snapshots fail',async t=>{
  const {file,dir}=await setup(t);const result=await build(file,dir);const manifestFile=path.join(result.directory,'build.json');
  const legacy=structuredClone(result.manifest);delete legacy.templates;await writeFile(manifestFile,JSON.stringify(legacy));await loadBuild(result.directory);
  const unsafe=structuredClone(result.manifest);unsafe.templates[0].id='../outside';await writeFile(manifestFile,JSON.stringify(unsafe));await assert.rejects(loadBuild(result.directory),/无效模板快照/);
  await writeFile(manifestFile,JSON.stringify(result.manifest));await rm(path.join(result.directory,'.print-compact.html'));await assert.rejects(loadBuild(result.directory),/ENOENT/);
});

async function packageFolder(dir,id='resume-demo-ai',title='AI 应用开发 · 通用版',root='resume') {
  const folder=path.join(dir,root,'presentations',id);await mkdir(folder,{recursive:true});
  const data=structuredClone(fixture);data.id=id;data.title=title;
  await writeFile(path.join(folder,'package.json'),JSON.stringify(data));return folder;
}
test('directory discovery uses configured resume_dir and reports malformed packages',async t=>{
  const {listPresentations}=await import('../dist/presentation/collection.js');const {dir}=await setup(t);
  assert.equal((await listPresentations(dir)).entries.length,0);
  await writeFile(path.join(dir,'career.json'),JSON.stringify({schema:'career-workspace/v1',resume_dir:'my-resume'}));
  await packageFolder(dir,'resume-one','第一份','my-resume');await packageFolder(dir,'resume-two','第二份','my-resume');
  const invalid=await packageFolder(dir,'resume-bad','无效','my-resume');await writeFile(path.join(invalid,'package.json'),'{}');
  const listed=await listPresentations(dir);assert.equal(listed.entries.length,2);assert.equal(listed.warnings.length,1);
  await writeFile(path.join(dir,'career.json'),JSON.stringify({schema:'career-workspace/v1',resume_dir:'../outside'}));
  await assert.rejects(listPresentations(dir),/工作区内/);
});
test('duplicate package IDs cannot silently replace another resume in a collection',async t=>{
  const {listPresentations,buildCollection}=await import('../dist/presentation/collection.js');const {dir}=await setup(t);
  await packageFolder(dir);const second=await packageFolder(dir,'resume-second');await writeFile(path.join(second,'package.json'),JSON.stringify(fixture));
  const listed=await listPresentations(dir);assert.equal(listed.entries.length,0);assert.equal(listed.warnings.length,2);await assert.rejects(buildCollection(dir),/ID 重复/);
});
test('collections link independent snapshots and retain content when source packages change',async t=>{
  const {buildCollection,loadCollection}=await import('../dist/presentation/collection.js');const {dir}=await setup(t);
  await packageFolder(dir);const second=await packageFolder(dir,'resume-second','第二份');
  const result=await buildCollection(dir);assert.equal(result.count,2);
  assert.ok((await readFile(result.html,'utf8')).includes('href="resumes/resume-second/index.html"'));
  const child=await readFile(path.join(result.directory,'resumes/resume-second/index.html'),'utf8');assert.ok(child.includes('data-resume-id="resume-second"'));assert.ok(child.includes('href="../resume-demo-ai/index.html"'));
  await writeFile(path.join(second,'package.json'),'changed');await loadCollection(result.directory);
  result.manifest.entries[0].href='../outside.html';await writeFile(path.join(result.directory,'collection.json'),JSON.stringify(result.manifest));await assert.rejects(loadCollection(result.directory),/无效简历集合/);
});
test('collection server isolates resume requests and hides input and snapshot files',async t=>{
  const {buildCollection}=await import('../dist/presentation/collection.js');const {dir}=await setup(t);await packageFolder(dir);await packageFolder(dir,'resume-second','第二份');
  const result=await buildCollection(dir),preview=await startPreview(result.directory,dir);t.after(()=>preview.close());
  assert.equal((await fetch(preview.url+'/resumes/resume-second/index.html')).status,200);
  for(const file of ['.package.json','build.json','.print-classic.html'])assert.equal((await fetch(preview.url+'/resumes/resume-second/'+file)).status,404);
  assert.equal((await fetch(preview.url+'/resumes/unknown/index.html')).status,404);
  assert.equal((await (await fetch(preview.url+'/api/resumes')).json()).entries.length,2);
  const session=await (await fetch(preview.url+'/api/session?resume=resume-second')).json();
  const response=await fetch(preview.url+'/api/pdf',{method:'POST',headers:{'Content-Type':'application/json',Origin:preview.url,'X-Career-Token':session.token},body:JSON.stringify({theme:'classic',resumeId:'unknown'})});assert.equal(response.status,400);
});

test('empty collections serve onboarding without accepting a fake resume; invalid data still fails',async t=>{
  const {buildCollection,loadCollection}=await import('../dist/presentation/collection.js');const {dir}=await setup(t);
  const result=await buildCollection(dir);assert.equal(result.count,0);assert.deepEqual((await loadCollection(result.directory)).entries,[]);
  const preview=await startPreview(result.directory,dir);t.after(()=>preview.close());
  const html=await (await fetch(preview.url)).text();assert.ok(html.includes('还没有生成简历'));assert.ok(html.includes('建立简历母版'));assert.ok(!html.includes('id="export-pdf"'));assert.ok(!html.includes('id="open-resumes"'));
  assert.deepEqual((await (await fetch(preview.url+'/api/resumes')).json()).entries,[]);
  assert.equal((await fetch(preview.url+'/api/session')).status,400);
  const invalid=await packageFolder(dir);await writeFile(path.join(invalid,'package.json'),'{}');await assert.rejects(buildCollection(dir),/内容目录需要修正/);
});


test('optional webpage, project and common links validate without changing legacy packages',async t=>{
  const {file}=await setup(t);
  const valid=await change(file,d=>{
    d.resume.contacts.push({label:'个人主页',value:'作品集',url:'https://example.com/portfolio?a=1&b=2#works'});
    d.resume.sections[0].items[0].links=[{label:'演示',url:'https://example.com/demo'}];
    d.common={sections:[{id:'certificates',title:'证书',fields:[{label:'证书说明',value:'示例',url:'https://example.com/certificate'}]}]};
  });
  assert.deepEqual((await check(file)).input,valid);
  await change(file,d=>{delete d.common;d.resume.contacts.forEach(c=>delete c.url);d.resume.sections.forEach(s=>s.items.forEach(i=>delete i.links));});
  await check(file);
});

test('invalid or executable link targets are rejected at every public link input',async t=>{
  const {file}=await setup(t);
  const setters=[(d,url)=>d.resume.contacts[0].url=url,(d,url)=>d.resume.sections[0].items[0].links=[{label:'项目链接',url}],(d,url)=>d.common={sections:[{id:'works',title:'作品',fields:[{label:'作品',value:'作品',url}]}]}];
  for(const set of setters)for(const url of ['javascript:alert(1)','data:text/html,x','file:///tmp/secret','//example.com','https://','https://example.com/with space','https://user:password@example.com','https://example.com/\\evil','']){
    await change(file,d=>set(d,url));await assert.rejects(check(file),/内容包格式|无效网页链接/);
  }
  await change(file,d=>d.common={sections:[{id:'skills',title:'技能',fields:[{label:'技能',value:'Python'}]},{id:'skills',title:'技能',fields:[{label:'技能',value:'SQL'}]}]});
  await assert.rejects(check(file),/通用资料重复/);
});
