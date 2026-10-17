import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {summarizeCorpus,canonicalUrl} from '../.agents/skills/jd-research/scripts/summarize-corpus.mjs';
import {setup,installAgent} from '../dist/workspace/setup.js';
import {corpusFixture,exerciseJdResearch} from './helpers/jd-research.mjs';

test('statistics count unique reviewed full samples and preserve optional, negative and gate distinctions',()=>{
 const result=summarizeCorpus(corpusFixture());
 assert.deepEqual(result.counts,{records:7,body_records:6,completeness:{full:5,partial:1,lead:1},decisions:{include:5,exclude:1,review:1},core_samples:2,core_records:3});
 const [analysis,budget,degree]=result.overall.categories;
 assert.equal(analysis.positive_samples,2);assert.equal(analysis.by_modality.preferred.count,1);assert.equal(analysis.by_modality.must.count,0);
 assert.equal(budget.positive_percent,50);assert.equal(budget.by_modality.negated.count,1);
 assert.equal(degree.kind,'gate');assert.equal(degree.by_modality.must.count,1);
 assert.equal(result.by_family.length,2);assert.equal(result.outside_core.length,4);
});

test('zero complete samples return null percentages rather than fabricated certainty',()=>{
 const data=corpusFixture();data.jobs=data.jobs.filter(j=>j.completeness==='lead');
 const result=summarizeCorpus(data);assert.equal(result.counts.core_samples,0);assert.equal(result.overall.categories[0].positive_percent,null);
});

test('a duplicate source with unknown company does not create another employer sample',()=>{
 const data=corpusFixture();data.jobs[1].company=null;
 const result=summarizeCorpus(data);
 assert.equal(result.company_labels.reduce((sum,row)=>sum+row.samples,0),2);
 assert.equal(result.company_labels.some(row=>row.label===null),false);
});

test('source dedup preserves job query IDs and SPA routes, and rejects split source identities',()=>{
 assert.equal(canonicalUrl('https://example.com/jobs?id=123&utm_source=x#job/456'),'https://example.com/jobs?id=123#job/456');
 assert.notEqual(canonicalUrl('https://example.com/jobs?id=1'),canonicalUrl('https://example.com/jobs?id=2'));
 const data=corpusFixture();data.jobs[1].sample_group='wrong';
 assert.throws(()=>summarizeCorpus(data),/duplicate source/);
 data.jobs[1].source.url='https://example.com/different-url';assert.throws(()=>summarizeCorpus(data),/duplicate source/);
});

test('unknown categories, invented quotations, missing decisions and mixed company groups fail',()=>{
 for(const [mutate,pattern] of [
  [d=>d.jobs[0].requirements[0].category='invented',/category/],
  [d=>d.jobs[0].requirements[0].quote='不存在的业绩',/quote not found/],
  [d=>delete d.jobs[0].decision,/decision/],
  [d=>d.jobs[1].company='另一家公司',/company labels/],
  [d=>d.jobs[1].family='另一类岗位',/role families/]
 ]){const data=corpusFixture();mutate(data);assert.throws(()=>summarizeCorpus(data),pattern);}
});

test('NFKC and whitespace normalization do not become keyword inference',()=>{
 const data=corpusFixture();data.jobs[0].text+=' 使用 Ｐｙｔｈｏｎ\n  分析。';data.jobs[0].requirements.push({category:'analysis',modality:'unclear',quote:'使用 Python 分析',locator:'附注'});
 assert.equal(summarizeCorpus(data).overall.categories[0].by_modality.unclear.count,1);
 data.jobs.forEach(j=>{j.requirements=[];});
 assert.equal(summarizeCorpus(data).overall.categories[0].positive_samples,0);
});

test('session-bearing URLs are rejected without echoing secrets',()=>{
 for(const url of ['https://example.com/job?securityId=private-value','https://user:secret@example.com/job','file:///private/file']){
  let error;try{canonicalUrl(url);}catch(e){error=e;}
  assert.ok(error);assert.ok(!error.message.includes('private-value'));assert.ok(!error.message.includes('secret'));
 }
});

test('Skill installs and upgrades without overwriting custom instructions; helper runs outside source checkout',async t=>{
 const dir=await realpath(await mkdtemp(path.join(os.tmpdir(),'career-jd-research-')));t.after(()=>rm(dir,{recursive:true,force:true}));
 const workspace=path.join(dir,'资料库');await setup(workspace,false);
 const skill=path.join(workspace,'.agents/skills/jd-research');await exerciseJdResearch(skill,dir);
 await rm(skill,{recursive:true});
 const manifestFile=path.join(workspace,'.career/managed.json'),manifest=JSON.parse(await readFile(manifestFile,'utf8'));
 for(const key of Object.keys(manifest.files))if(key.startsWith('.agents/skills/jd-research/'))delete manifest.files[key];
 await writeFile(manifestFile,JSON.stringify(manifest));
 const entry=path.join(workspace,'AGENTS.md');await writeFile(entry,'# 用户自己的入口\n');
 const upgraded=await installAgent(workspace);assert.ok(upgraded.installed.includes('.agents/skills/jd-research/SKILL.md'));assert.ok(upgraded.conflicts.includes('AGENTS.md'));
 assert.equal(await readFile(entry,'utf8'),'# 用户自己的入口\n');
 const guide=path.join(skill,'SKILL.md');await writeFile(guide,'# 用户自己的方法\n');
 assert.ok((await installAgent(workspace)).conflicts.includes('.agents/skills/jd-research/SKILL.md'));
 assert.equal(await readFile(guide,'utf8'),'# 用户自己的方法\n');
});
