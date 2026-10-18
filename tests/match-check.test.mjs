import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {outreachFixture} from './helpers/outreach.mjs';
import {matchMetadata} from './helpers/match.mjs';
import {encode} from '../dist/opportunities/files.js';
import {checkMatchReport,readMatchSummary} from '../dist/opportunities/match.js';
import * as jobs from '../dist/opportunities/store.js';
import * as resumes from '../dist/resumes/store.js';
import {renderMarkdown} from '../dist/board/markdown.js';

const run=promisify(execFile),cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
const body='# 匹配结论\n建议进一步了解，接口集成有直接证据；评估方法尚需补充。\n\n## 优先修改\n前移知识助手项目，先核实是否有质量评估记录。';
async function fixture(t){const f=await outreachFixture();t.after(f.close);return {...f,input:path.join(f.w,'match-candidate.md')};}
async function command(f,...args){
 try{const {stdout,stderr}=await run(process.execPath,[cli,'opportunity','match-check','--workspace',f.w,'--id',f.op.id,...args,'--json']);assert.equal(stderr,'');return {exit:0,...JSON.parse(stdout)};}
 catch(e){if(e.code!==1)throw e;assert.equal(e.stdout,'');return {exit:e.code,...JSON.parse(e.stderr)};}
}
test('candidate check is read-only and agrees with persisted reader results',async t=>{
 const f=await fixture(t),meta=matchMetadata(f),card=(await jobs.show(f.w,f.op.id)).card;
 await f.write('analysis/match.md','# 原有文字分析\n用户原笔记');
 const old=await jobs.readDocument(f.w,f.op.id,'analysis/match.md');
 await writeFile(f.input,encode(meta,body));const checked=await command(f,'--input',f.input);
 assert.equal(checked.exit,0);assert.equal(checked.data.valid,true);assert.equal(checked.data.semantic_review,'not_assessed');
 assert.deepEqual(checked.data.score,{value:75,coverage:70,lower:52.5,upper:82.5});
 assert.equal((await jobs.readDocument(f.w,f.op.id,'analysis/match.md')).sha256,old.sha256);
 assert.equal((await jobs.show(f.w,f.op.id)).card.sha256,card.sha256);
 await jobs.writeDocument(f.w,f.op.id,'analysis/match.md',f.input,old.sha256);
 const saved=await command(f),page=await readMatchSummary(f.w,f.op.id);
 assert.equal(saved.exit,0);assert.deepEqual(saved.data.score,page.score);assert.equal(saved.data.state,'current');
});
test('CLI rejects missing, prose-only and frontmatter-only reports without inventing a score',async t=>{
 const f=await fixture(t),missing=await command(f);assert.equal(missing.exit,1);assert.equal(missing.data.state,'missing');
 for(const content of ['# 文本报告\n建议投递，个人五星',encode(matchMetadata(f),'   '),encode(matchMetadata(f),'<!-- draft pending -->')]){
  await writeFile(f.input,content);const r=await command(f,'--input',f.input);
  assert.equal(r.exit,1);assert.equal(r.errors[0].code,'MATCH_REPORT_INCOMPLETE');assert.equal(r.data.valid,false);assert.equal(r.data.score,undefined);
 }
 const noFile=await command(f,'--input',path.join(f.w,'missing.md'));assert.equal(noFile.exit,1);assert.equal(noFile.errors[0].code,'INPUT_MISSING');
 assert.equal((await readMatchSummary(f.w,f.op.id)).exists,false);
});
test('fresh all-unknown evidence is valid but changed inputs or binding fail completion',async t=>{
 const f=await fixture(t),meta=matchMetadata(f);meta.criteria=meta.criteria.map(c=>({...c,score:null}));
 await writeFile(f.input,encode(meta,body));const unknown=await checkMatchReport(f.w,f.op.id,f.input);
 assert.equal(unknown.valid,true);assert.deepEqual(unknown.score,{value:null,coverage:0,lower:0,upper:100});
 await f.write('job.md','# JD 更新\n新增职责');
 const stale=await command(f,'--input',f.input);assert.equal(stale.exit,1);assert.equal(stale.data.state,'stale');
 const card=(await jobs.show(f.w,f.op.id)).card;await resumes.selectResume(f.w,f.op.id,null,card.sha256);
 const unbound=await checkMatchReport(f.w,f.op.id,f.input);assert.equal(unbound.valid,false);assert.ok(unbound.warnings.some(w=>w.includes('尚未关联')));
});
test('report preview hides provenance metadata while preserving readable evidence and raw source',async t=>{
 const f=await fixture(t),meta=matchMetadata(f),content=encode(meta,body+'\n[招聘原文](../job.md)').toString();
 await writeFile(f.input,content);const rendered=renderMarkdown(content,f.op.id,'analysis/match.md');
 assert.ok(rendered.html.includes('匹配结论'));assert.ok(rendered.html.includes('data-document="job.md"'));
 for(const technical of [meta.jd_sha256,meta.resume_sha256,meta.resume_id,'career-match/v1'])assert.ok(!rendered.html.includes(technical));
 assert.equal(await readFile(f.input,'utf8'),content);
});
