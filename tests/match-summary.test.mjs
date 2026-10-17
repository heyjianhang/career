import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {matchScore,readMatchSummary} from '../dist/opportunities/match.js';
import {scoreCriteria} from '../.agents/skills/career-board/scripts/score-opportunity.mjs';
import {outreachFixture} from './helpers/outreach.mjs';
import {matchMetadata} from './helpers/match.mjs';
import {encode} from '../dist/opportunities/files.js';
import * as resumes from '../dist/resumes/store.js';
import * as jobs from '../dist/opportunities/store.js';
async function fixture(t){const f=await outreachFixture();t.after(f.close);return {...f,saveMatch:(meta=matchMetadata(f))=>f.write('analysis/match.md',encode(meta,'# 详细分析\n检索与工单接口接入有直接证据；模型评测需要补充。'))};}
test('match summary calculates documented scores and never borrows personal stars',async t=>{
 const f=await fixture(t);assert.equal((await readMatchSummary(f.w,f.op.id)).state,'missing');
 await f.write('analysis/match.md','# 旧分析\n非常适合，个人五星');assert.equal((await readMatchSummary(f.w,f.op.id)).state,'unscored');
 const before=(await jobs.show(f.w,f.op.id)).card.sha256;await f.saveMatch();
 const pair=await Promise.all([readMatchSummary(f.w,f.op.id),readMatchSummary(f.w,f.op.id)]);
 for(const r of pair){assert.equal(r.state,'current');assert.deepEqual(r.score,{value:75,coverage:70,lower:52.5,upper:82.5});assert.equal(r.resumeTitle,'Agent 应用 · 合成简历');}
 assert.equal((await jobs.show(f.w,f.op.id)).card.sha256,before);
 for(const scores of [[0,0],[1,4],[4,null],[null,null]]){
  const criteria=matchMetadata(f).criteria.map((r,i)=>({...r,score:scores[i]}));const local=matchScore(criteria),shared=scoreCriteria({criteria});
  assert.deepEqual(local,{value:shared.known_score,coverage:shared.evidence_coverage,lower:shared.missing_extremes.lower,upper:shared.missing_extremes.upper});
 }
});
test('malformed or unsubstantiated scores stay unavailable while analysis is preserved',async t=>{
 const f=await fixture(t),meta=matchMetadata(f);
 for(const change of [{opportunity_id:'opp-other'},{criteria:meta.criteria.map(r=>({...r,weight:40}))},{criteria:meta.criteria.map(r=>({...r,id:'重复'}))},{criteria:meta.criteria.map(r=>({...r,score:5}))},{criteria:meta.criteria.map(r=>({...r,evidence:[]}))},{jd_sha256:'guessed'},{summary:' '}]){
  await f.saveMatch({...meta,...change});const r=await readMatchSummary(f.w,f.op.id);assert.equal(r.state,'invalid');assert.equal(r.score,undefined);assert.ok((await jobs.readDocument(f.w,f.op.id,'analysis/match.md')).content.includes('详细分析'));
 }
});
test('changed or missing inputs and binding are not presented as current matching',async t=>{
 const f=await fixture(t);await f.saveMatch();const p=path.join(f.w,'opportunities',f.op.id,'analysis/match.md'),original=await readFile(p,'utf8');
 await f.write('job.md','# JD\n新增训练要求');assert.match((await readMatchSummary(f.w,f.op.id)).warnings.join(),/职位描述已更新/);
 const r=await resumes.readResume(f.w,f.r.id);r.package.content.summary+='更新';await resumes.savePackage(f.w,r.package,r.sha256);assert.match((await readMatchSummary(f.w,f.op.id)).warnings.join(),/简历内容已更新/);
 const card=(await jobs.show(f.w,f.op.id)).card;await resumes.selectResume(f.w,f.op.id,null,card.sha256);assert.equal((await readMatchSummary(f.w,f.op.id)).state,'stale');assert.equal(await readFile(p,'utf8'),original);
});
test('unreadable JD leaves the previous score unverified, and all unknown stays unscored',async t=>{
 const f=await fixture(t),meta=matchMetadata(f);await f.saveMatch({...meta,criteria:meta.criteria.map(r=>({...r,score:null}))});
 assert.deepEqual((await readMatchSummary(f.w,f.op.id)).score,{value:null,coverage:0,lower:0,upper:100});
 await rm(path.join(f.w,'opportunities',f.op.id,'job.md'));assert.equal((await readMatchSummary(f.w,f.op.id)).state,'unverified');
});
