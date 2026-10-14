import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,readFile,writeFile,mkdir,rm,stat,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import os from 'node:os';
import path from 'node:path';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
const fixture=JSON.parse(await readFile(new URL('../examples/presentation/package.json',import.meta.url),'utf8'));
const run=promisify(execFile),sha=value=>createHash('sha256').update(value).digest('hex');
async function execute(...args){
  try{const {stdout,stderr}=await run(process.execPath,[cli,...args,'--json']);assert.equal(stderr,'');return {exit:0,...JSON.parse(stdout)};}
  catch(e){if(!e.stderr)throw e;assert.equal(e.stdout,'');return {exit:e.code,...JSON.parse(e.stderr)};}
}
async function setup(t){
  const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-agent-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const workspace=path.join(dir,'简历 工作区'),input=path.join(dir,'candidate.json');
  assert.equal((await execute('workspace','init','--workspace',workspace)).exit,0);
  const data=structuredClone(fixture);await writeFile(input,JSON.stringify(data));return {dir,workspace,input,data};
}
const missing=async file=>assert.rejects(stat(file),e=>e.code==='ENOENT');
const save=(workspace,input,...args)=>execute('resume','save','--input',input,'--workspace',workspace,...args);
const failure=(result,operation,code)=>{assert.equal(result.exit,1);assert.equal(result.operation,operation);assert.equal(result.status,'error');assert.equal(result.errors[0].code,code);};

test('Agent can discover callable commands, exact schema and verified platform fields',async()=>{
  const help=await execute('--help');assert.equal(help.schema_version,'career-cli/v1');assert.equal(help.data.content_author,'agent');
  for(const command of ['workspace status','workspace init','workspace check','workspace hash','resume save','resume schema','resume platforms','resume preview'])assert.ok(help.data.commands.some(c=>c.command==='career '+command));
  const scoped=await execute('resume','save','--help');assert.equal(scoped.data.commands.length,1);assert.ok(scoped.data.commands[0].options.includes('if-match'));
  const schema=await execute('resume','schema');assert.deepEqual(schema.data.json_schema,JSON.parse(await readFile(new URL('../schemas/resume-package.v1.schema.json',import.meta.url),'utf8')));assert.equal(schema.data.legacy_schema.properties.schema.const,'career-presentation/v1');
  const platforms=await execute('resume','platforms');assert.deepEqual(platforms.data.platforms.map(p=>p.id).sort(),['boss','job51','liepin','zhaopin']);
  const one=await execute('resume','platforms','--platform','liepin');assert.equal(one.data.platforms.length,1);assert.deepEqual(one.data.platforms[0],platforms.data.platforms.find(p=>p.id==='liepin'));
  failure(await execute('resume','platforms','--platform','invented'),'resume.platforms','INVALID_ARGUMENT');
  failure(await execute('resume','save'),'resume.save','INVALID_ARGUMENT');
  failure(await execute('workspace','hash','--path','x','--path','y'),'workspace.hash','INVALID_ARGUMENT');
});

test('workspace status is read-only and init/check preserve user data without claiming completion',async t=>{
  const {dir,workspace}=await setup(t);const empty=path.join(dir,'absent');
  const absent=await execute('workspace','status','--workspace',empty);assert.equal(absent.data.initialized,false);await missing(empty);
  const state=path.join(workspace,'context/state.md');await writeFile(state,'# 用户已记录的进度\n不覆盖\n');
  const init=await execute('workspace','init','--workspace',workspace);assert.deepEqual(init.data.created,[]);assert.ok(init.data.preserved.includes('context/state.md'));assert.match(await readFile(state,'utf8'),/不覆盖/);
  const status=await execute('workspace','status','--workspace',workspace);assert.equal(status.exit,0);assert.equal(status.data.completion,'not_assessed');assert.ok(status.data.next_reads.includes(state));assert.ok(status.data.missing_files.includes('resume/master-preview.md'));assert.equal(status.data.validation.valid,true);
  const valid=await execute('workspace','check','--workspace',workspace);assert.equal(valid.exit,0);assert.equal(valid.data.valid,true);assert.ok(valid.data.record_count>0);
  await writeFile(path.join(workspace,'resume/facts/profile.md'),'broken record');
  const invalid=await execute('workspace','check','--workspace',workspace);failure(invalid,'workspace.check','WORKSPACE_INVALID');assert.equal(invalid.data.valid,false);
  const inspection=await execute('workspace','status','--workspace',workspace);assert.equal(inspection.exit,0);assert.equal(inspection.data.validation.valid,false);
});

test('platform discovery provides a directly saveable section instead of qualified lookup keys',async t=>{
  const {workspace,input,data}=await setup(t);
  const discovered=await execute('resume','platforms');
  const section=discovered.data.input_contract.section_example;
  data.reports=Object.fromEntries(discovered.data.platforms.map(platform=>{
    for(const field of section.fields)assert.ok(platform.fields[section.kind+'.'+field.key]);
    return [platform.id,{sections:[section],notes:[]}];
  }));
  await writeFile(input,JSON.stringify(data));
  const saved=await save(workspace,input);assert.equal(saved.exit,0);
  assert.deepEqual(JSON.parse(await readFile(saved.data.file,'utf8')).reports,data.reports);
  for(const report of Object.values(data.reports))report.sections[0]=structuredClone(section);
  data.reports.boss.sections[0].fields[0].key=section.kind+'.'+section.fields[0].key;
  await writeFile(input,JSON.stringify(data));
  const invalid=await save(workspace,input,'--if-match',saved.data.sha256);
  assert.equal(invalid.exit,1);assert.match(invalid.errors[0].message,/fields\/0\/key/);
});

test('workspace hash handles text and binary paths while rejecting escape and symlink reads',async t=>{
  const {dir,workspace}=await setup(t);const relative='resume/assets/照片 原件.png',bytes=Buffer.from([0,1,127,255]);await writeFile(path.join(workspace,relative),bytes);
  const result=await execute('workspace','hash','--workspace',workspace,'--path',relative);assert.deepEqual(result.data,{path:relative,sha256:sha(bytes),bytes:4});
  for(const unsafe of ['../outside',path.join(dir,'outside'),'https://example.com/a','resume\\a'])failure(await execute('workspace','hash','--workspace',workspace,'--path',unsafe),'workspace.hash','INVALID_PATH');
  await writeFile(path.join(dir,'outside'),'private');await symlink(path.join(dir,'outside'),path.join(workspace,'linked'));
  const linked=await execute('workspace','hash','--workspace',workspace,'--path','linked');assert.equal(linked.exit,1);assert.match(linked.errors[0].message,/链接/);
});

test('save validates Agent content, prevents lost updates, and retains exact previous package',async t=>{
  const {workspace,input,data}=await setup(t);const first=await save(workspace,input);assert.equal(first.exit,0);assert.equal(first.data.changed,true);assert.equal(first.data.backup,null);
  const expected=path.join(workspace,'resume/presentations',data.id,'package.json');assert.equal(first.data.file,expected);
  const old=await readFile(expected,'utf8');assert.equal(first.data.sha256,sha(old));assert.deepEqual(JSON.parse(old),data);
  const unchanged=await save(workspace,input);assert.equal(unchanged.data.changed,false);assert.equal(unchanged.data.backup,null);
  data.title='保留事实，仅更新成品标题';await writeFile(input,JSON.stringify(data));
  failure(await save(workspace,input),'resume.save','PACKAGE_EXISTS');assert.equal(await readFile(expected,'utf8'),old);
  failure(await save(workspace,input,'--if-match','0'.repeat(64)),'resume.save','PACKAGE_CONFLICT');assert.equal(await readFile(expected,'utf8'),old);
  const updated=await save(workspace,input,'--if-match',first.data.sha256);assert.equal(updated.exit,0);assert.equal(await readFile(updated.data.backup,'utf8'),old);assert.deepEqual(JSON.parse(await readFile(expected,'utf8')),data);
  failure(await save(workspace,input,'--if-match',first.data.sha256),'resume.save','PACKAGE_CONFLICT');
  const listing=await execute('resume','list','--workspace',workspace);assert.equal(listing.data.entries.length,1);assert.equal(listing.data.entries[0].title,data.title);assert.deepEqual(listing.warnings,[]);
});

test('save rejects stale sources and unsupported fields before replacing a saved package',async t=>{
  const {workspace,input,data}=await setup(t);const source='resume/master-preview.md';await writeFile(path.join(workspace,source),'合成母版 v1');data.source.files=[{path:source,sha256:sha('合成母版 v1')}];await writeFile(input,JSON.stringify(data));
  const first=await save(workspace,input);assert.equal(first.exit,0);const old=await readFile(first.data.file,'utf8');
  await writeFile(path.join(workspace,source),'合成母版 v2');const stale=await save(workspace,input,'--if-match',first.data.sha256);assert.equal(stale.exit,1);assert.match(stale.errors[0].message,/来源已变化/);assert.equal(await readFile(first.data.file,'utf8'),old);
  data.source.files[0].sha256=sha('合成母版 v2');data.reports.boss.sections[0].fields.push({key:'not-a-real-field',value:'不可丢弃'});await writeFile(input,JSON.stringify(data));
  const bad=await save(workspace,input,'--if-match',first.data.sha256);assert.equal(bad.exit,1);assert.match(bad.errors[0].message,/未支持的字段/);assert.equal(await readFile(first.data.file,'utf8'),old);
});

test('save handles configured directories and refuses collisions, locks and symlink destinations',async t=>{
  const {workspace,input,data}=await setup(t);const configPath=path.join(workspace,'career.json'),config=JSON.parse(await readFile(configPath,'utf8'));config.resume_dir='other-resumes';config.extensions={keep:true};const configText=JSON.stringify(config);await writeFile(configPath,configText);
  const first=await save(workspace,input);assert.equal(first.exit,0);assert.equal(first.data.file,path.join(workspace,'other-resumes/presentations',data.id,'package.json'));assert.equal(await readFile(configPath,'utf8'),configText);
  const lock=path.join(path.dirname(first.data.file),'.save-lock');await writeFile(lock,'other writer');failure(await save(workspace,input),'resume.save','PACKAGE_BUSY');assert.equal(await readFile(lock,'utf8'),'other writer');await rm(lock);
  const alias=path.join(workspace,'other-resumes/presentations/another-directory');await mkdir(alias);await writeFile(path.join(alias,'package.json'),JSON.stringify(data));failure(await save(workspace,input),'resume.save','PACKAGE_CONFLICT');await rm(alias,{recursive:true});
  await rm(first.data.file);await symlink(input,first.data.file);const symlinked=await save(workspace,input);assert.equal(symlinked.exit,1);assert.match(symlinked.errors[0].message,/链接/);assert.deepEqual(JSON.parse(await readFile(input,'utf8')),data);
});

test('save rejects oversized packages before creating an undiscoverable entry',async t=>{
  const {workspace,input,data}=await setup(t);data.resume.summary=['x'.repeat(16*1024*1024)];await writeFile(input,JSON.stringify(data));
  failure(await save(workspace,input),'resume.save','PACKAGE_TOO_LARGE');
  await missing(path.join(workspace,'resume/presentations',data.id));
});

test('documented CLI pipeline hashes sources/photo, saves, builds and serves the same content',async t=>{
  const {workspace,input,data}=await setup(t);const source='resume/master-preview.md',photo='resume/assets/photo.png';
  await writeFile(path.join(workspace,source),'# 虚构母版\n只用于命令回归。');await writeFile(path.join(workspace,photo),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8iQAAAAASUVORK5CYII=','base64'));
  const sourceHash=(await execute('workspace','hash','--workspace',workspace,'--path',source)).data.sha256;
  const photoHash=(await execute('workspace','hash','--workspace',workspace,'--path',photo)).data.sha256;
  data.source.files=[{path:source,sha256:sourceHash}];data.resume.photo={path:photo,sha256:photoHash,alt:'测试图片'};await writeFile(input,JSON.stringify(data));
  const saved=await save(workspace,input);assert.equal(saved.exit,0);assert.equal((await execute('resume','validate','--workspace',workspace,'--input',saved.data.file)).exit,0);
  assert.equal((await execute('resume','preferences','--workspace',workspace,'--theme','compact')).exit,0);
  const built=await execute('resume','build','--workspace',workspace,'--collection');assert.equal(built.exit,0);assert.equal(built.data.count,1);const html=await readFile(built.data.html,'utf8');assert.ok(html.includes(data.resume.name));assert.ok(html.includes('data:image/png;base64,'));
  const child=spawn(process.execPath,[cli,'resume','preview','--workspace',workspace,'--build',built.data.directory,'--json'],{stdio:['ignore','pipe','pipe']});
  let errors='';child.stderr.on('data',chunk=>errors+=chunk);
  t.after(async()=>{if(child.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}});
  const ready=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('preview did not start: '+errors)),15000);child.stdout.on('data',chunk=>{text+=chunk;if(text.includes('\n')){clearTimeout(timer);resolve(JSON.parse(text.trim()));}});child.once('exit',code=>{clearTimeout(timer);reject(new Error('preview exited '+code+': '+errors));});child.once('error',reject);});
  assert.equal(ready.status,'success');assert.equal((await fetch(ready.data.url)).status,200);const catalog=await (await fetch(ready.data.url+'/api/resumes')).json();assert.equal(catalog.entries[0].id,data.id);
  await writeFile(path.join(workspace,source),'# 合成资料已变更');const stale=await execute('resume','build','--workspace',workspace,'--collection');assert.equal(stale.exit,1);assert.match(stale.errors[0].message,/来源已变化/);assert.equal(await readFile(built.data.html,'utf8'),html);
});
