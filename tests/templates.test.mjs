import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {templates,renderTemplate,templateCss} from '../dist/presentation/templates/registry.js';
import {escape} from '../dist/presentation/escape.js';
import {build,loadBuild} from '../dist/presentation/build.js';
import {savePreference} from '../dist/presentation/io.js';

const selected=templates.filter(t=>!['classic','compact'].includes(t.id));
const fixture=JSON.parse(await readFile('examples/presentation/package.json','utf8'));

test('twelve selected layouts preserve arbitrary sections and escape every content field',()=>{
  assert.equal(selected.length,12);
  const resume=structuredClone(fixture.resume);
  resume.name='<script>alert("name")</script>';
  resume.headline='方向 & 岗位';resume.contacts=[{label:'自定义 <标签>',value:'https://example.com/?a=1&b=2'}];
  resume.sections.push({id:'research',title:'论文 <自定义章节>',items:[{id:'custom',title:'标题 <img onerror=alert(1)>',subtitle:'副标题 &',period:'2024 — 2026',paragraphs:['第一段\n保留换行','x'.repeat(9000)],bullets:['要点 A','要点 B']}]});
  const values=[resume.name,resume.headline,...resume.summary,...resume.contacts.flatMap(c=>[c.label,c.value]),...resume.sections.flatMap(s=>[s.title,...s.items.flatMap(i=>[i.title,i.subtitle,i.period,...i.paragraphs,...i.bullets].filter(Boolean))])];
  for(const t of selected){
    const markup=renderTemplate(t.id,{resume,assets:{},synthetic:true});
    for(const value of values)assert.ok(markup.includes(escape(value)),`${t.id}: ${value.slice(0,25)}`);
    assert.ok(!markup.includes('<script>'));assert.ok(!markup.includes('class="resume-photo"'));
    assert.ok(!markup.includes('class="design-photo-frame"'));
    assert.equal((markup.match(/class="design-section"/g)||[]).length,resume.sections.length+1);
  }
});

test('selected layouts consume only the provided offline portrait and preserve crop focus',()=>{
  const photo={dataUrl:'data:image/png;base64,dGVzdA==',alt:'测试 "照片"',x:31,y:72};
  for(const t of selected){
    const markup=renderTemplate(t.id,{resume:fixture.resume,assets:{photo},synthetic:false});
    assert.equal((markup.match(/class="resume-photo"/g)||[]).length,1);
    assert.ok(markup.includes('object-position:31% 72%'));
    assert.ok(markup.includes('alt="测试 &quot;照片&quot;"'));
    assert.ok(!markup.includes('虚构示例'));assert.ok(!markup.includes('src="http'));
  }
  assert.ok(templateCss.includes('data:image/jpeg;base64,'));
  assert.ok(!/url\(["']?https?:/.test(templateCss));
});

test('new default appears in subsequent builds and every layout is retained as an immutable print snapshot',async t=>{
  const workspace=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-templates-'));
  t.after(()=>rm(workspace,{recursive:true,force:true}));
  const file=path.join(workspace,'package.json');await writeFile(file,JSON.stringify(fixture));
  await savePreference(workspace,'skyline');
  const result=await build(file,workspace);
  assert.equal(result.manifest.theme,'skyline');assert.equal(result.manifest.templates.length,14);
  for(const template of templates){
    const print=await readFile(path.join(result.directory,`.print-${template.id}.html`),'utf8');
    assert.ok(print.includes(`data-template="${template.id}"`));
    assert.ok(print.includes('业务工单 Agent'));assert.ok(print.includes('青川大学'));
  }
  await loadBuild(result.directory);
  const snapshot=path.join(result.directory,'.print-skyline.html');await writeFile(snapshot,'modified');
  await assert.rejects(loadBuild(result.directory),/构建产物已改变/);
});


test('every template preserves explicit links and omits absent link rows',()=>{
  const resume=structuredClone(fixture.resume);
  resume.contacts=[{label:'主页',value:'我的作品 <精选>',url:'https://example.com/?a=1&b=2'}];
  resume.sections[0].items[0].links=[{label:'项目 <演示>',url:'https://example.com/demo#intro'}];
  for(const t of templates){
    const markup=renderTemplate(t.id,{resume,assets:{},synthetic:true});
    assert.ok(markup.includes('href="https://example.com/?a=1&amp;b=2"'));
    assert.ok(markup.includes('href="https://example.com/demo#intro"'));
    assert.ok(markup.includes('我的作品 &lt;精选&gt;'));assert.ok(markup.includes('项目 &lt;演示&gt;'));
    const absent=structuredClone(resume);absent.contacts.forEach(c=>delete c.url);absent.sections.forEach(s=>s.items.forEach(i=>delete i.links));
    const legacy=renderTemplate(t.id,{resume:absent,assets:{},synthetic:true});
    assert.ok(!legacy.includes('resume-item-links'));assert.ok(!legacy.includes('class="resume-web-link"'));
    absent.sections[0].items[0].links=[];
    assert.ok(!renderTemplate(t.id,{resume:absent,assets:{},synthetic:true}).includes('resume-item-links'));
  }
});
