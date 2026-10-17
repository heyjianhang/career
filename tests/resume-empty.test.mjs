import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {emptyOptionalResume} from './fixtures/resume-empty.mjs';
import {blankExperience,projectPackage} from '../dist/resumes/model.js';
import {initializeWorkspace} from '../dist/agent-api.js';
import {savePackage,readResume} from '../dist/resumes/store.js';
import {rules,check} from '../dist/presentation/io.js';
import {html} from '../dist/presentation/render.js';
import {templates,renderTemplate} from '../dist/presentation/templates/registry.js';
import {build} from '../dist/presentation/build.js';

async function workspace(t){const w=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-empty-'));t.after(()=>rm(w,{recursive:true,force:true}));await initializeWorkspace(w);return w;}
test('all layouts omit empty sections and rows while preserving partial and custom content',async()=>{
  const b=emptyOptionalResume();b.content.summary='　\n';b.content.profile.headline=' ';
  b.content.profile.contacts.push({label:'手机',value:'\t'}, {label:'',value:'',url:'https://example.com/portfolio'});
  b.content.sections.push({id:'custom',title:'自定义记录',items:[
    {...blankExperience('other','title-only'),title:'技术分享奖'},
    {...blankExperience('other','paragraph-only'),description:'只有说明的真实内容'},
    {...blankExperience('other','date-only'),start:'2024-01'},
    {...blankExperience('other','subtitle-only'),subtitle:'协作负责人'},
    {...blankExperience('other','link-only'),links:[{label:'',url:'https://example.com/demo'}]}
  ]});
  const before=structuredClone(b),p=projectPackage(b,await rules());
  for(const t of templates){
    const markup=renderTemplate(t.id,{resume:p.resume,assets:{},synthetic:false});
    for(const absent of ['核心技能','荣誉与绩效','资格证书','个人简介','手机','求职方向'])assert.ok(!markup.includes(absent),`${t.id}: ${absent}`);
    for(const present of ['知识助手','技术分享奖','只有说明的真实内容','2024-01','协作负责人','https://example.com/demo','https://example.com/portfolio'])assert.ok(markup.includes(present),`${t.id}: ${present}`);
    assert.doesNotMatch(markup,/<(h2|h3|p|li)\b[^>]*>\s*<\/\1>/);
  }
  assert.deepEqual(b,before);
});
test('saved drafts keep empty fields while HTML, common fields and print snapshots hide them',async t=>{
  const w=await workspace(t),b=emptyOptionalResume(),before=structuredClone(b.content);
  const saved=await savePackage(w,b),checked=await check(saved.file,w),markup=await html(checked);
  for(const absent of ['核心技能','荣誉与绩效','资格证书','证书名称'])assert.ok(!markup.includes(absent),absent);
  assert.match(markup,/知识助手/);assert.deepEqual((await readResume(w,b.id)).package.content,before);
  const built=await build(saved.file,w);
  for(const t of templates){const print=await readFile(path.join(built.directory,`.print-${t.id}.html`),'utf8');assert.ok(!print.includes('荣誉与绩效'));assert.ok(print.includes('知识助手'));}
  assert.deepEqual(JSON.parse(await readFile(path.join(built.directory,'.package.json'),'utf8')).content,before);
  const invalid=structuredClone(b);invalid.content.sections[1].items=[{...blankExperience('other','bad-link'),links:[{label:'',url:'javascript:alert(1)'}]}];
  await assert.rejects(savePackage(w,invalid,saved.sha256),/无效网页链接/);
});
test('legacy presentations accept empty section lists and retain their original source',async t=>{
  const w=await workspace(t),input=JSON.parse(await readFile('examples/presentation/package.json','utf8'));
  input.resume.sections.push({id:'empty-skills',title:'核心技能',items:[]});
  const file=path.join(w,'legacy.json');await writeFile(file,JSON.stringify(input));
  const checked=await check(file,w);assert.ok(!(await html(checked,'classic',true)).includes('核心技能'));
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')),input);
  input.resume.sections=[];await writeFile(file,JSON.stringify(input));await check(file,w);
});
test('explicit negative statements and zero values are content, and empty platform drafts explain the empty state',async t=>{
  const w=await workspace(t),b=emptyOptionalResume();b.content.summary='';b.content.sections=[];
  b.content.common.sections=[{id:'custom',title:'补充说明',fields:[{label:'待办',value:'0'},{label:'说明',value:'暂无公开作品'}]}];
  const saved=await savePackage(w,b),markup=await html(await check(saved.file,w));
  assert.match(markup,/暂无公开作品/);assert.match(markup,/>0</);assert.match(markup,/暂无可填写内容/);
});
