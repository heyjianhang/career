import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm,symlink} from 'node:fs/promises';
import path from 'node:path';
import {readOutreach,outreachVariants} from '../dist/opportunities/outreach.js';
import * as resumes from '../dist/resumes/store.js';
import * as jobs from '../dist/opportunities/store.js';
import {outreachFixture,message,short} from './helpers/outreach.mjs';
async function fixture(t){const f=await outreachFixture();t.after(f.close);return f;}
test('outreach is optional; generated drafts preserve stages and original content',async t=>{
 const f=await fixture(t);assert.equal((await readOutreach(f.w,f.op.id)).state,'missing');
 const before=await jobs.show(f.w,f.op.id);await f.save();const [draft,concurrent]=await Promise.all([readOutreach(f.w,f.op.id),readOutreach(f.w,f.op.id)]);assert.equal(concurrent.state,'current');
 assert.equal(draft.state,'current');assert.deepEqual(draft.variants.map(v=>v.text),[message,short]);
 assert.equal((await jobs.show(f.w,f.op.id)).card.sha256,before.card.sha256);
 assert.equal((await jobs.context(f.w,f.op.id)).next_reads.some(r=>r.path.endsWith('/analysis/outreach.md')),true);
});
test('JD and resume edits invalidate freshness without changing saved draft',async t=>{
 const f=await fixture(t);await f.save();const file=path.join(f.w,'opportunities',f.op.id,'analysis/outreach.md'),original=await readFile(file,'utf8');
 await f.write('job.md','# JD\n新增模型评测职责');let draft=await readOutreach(f.w,f.op.id);assert.equal(draft.state,'stale');assert.match(draft.warnings.join(),/JD 已更新/);
 const r=await resumes.readResume(f.w,f.r.id);r.package.content.summary='用户修改过的项目介绍';await resumes.savePackage(f.w,r.package,r.sha256);
 draft=await readOutreach(f.w,f.op.id);assert.match(draft.warnings.join(),/简历内容已更新/);assert.equal(await readFile(file,'utf8'),original);
});
test('switching or unlinking resume warns, unreadable source never counts as current',async t=>{
 const f=await fixture(t);await f.save();const r=await resumes.createResume(f.w,'其他方向（虚构）');let card=(await jobs.show(f.w,f.op.id)).card;
 await resumes.selectResume(f.w,f.op.id,r.id,card.sha256);assert.equal((await readOutreach(f.w,f.op.id)).state,'stale');
 card=(await jobs.show(f.w,f.op.id)).card;await resumes.selectResume(f.w,f.op.id,null,card.sha256);assert.match((await readOutreach(f.w,f.op.id)).warnings.join(),/未关联/);
 card=(await jobs.show(f.w,f.op.id)).card;await resumes.selectResume(f.w,f.op.id,f.r.id,card.sha256);
 await rm(path.join(f.w,'opportunities',f.op.id,'job.md'));assert.equal((await readOutreach(f.w,f.op.id)).state,'unverified');
});
test('untrusted or ambiguous drafts cannot expose internal rationale as copyable text',async t=>{
 const f=await fixture(t);
 for(const [meta,body] of [[{...f.meta,opportunity_id:'opp-another'},f.body],[{...f.meta,resume_sha256:'invented'},f.body],[f.meta,f.body+'\n## 推荐稿\n重复正文'],[f.meta,'# 草稿\n内部分析，没有消息区'],[f.meta,'## 推荐稿\n```text\n不能从不明确格式复制\n```']]){
  await f.save(meta,body);const d=await readOutreach(f.w,f.op.id);assert.equal(d.state,'invalid');assert.deepEqual(d.variants,[]);
 }
 assert.deepEqual(outreachVariants('## 推荐稿\n您好\n\n第二段\n## 依据\n不要复制'),[{label:'推荐稿',text:'您好\n\n第二段'}]);
 assert.deepEqual(outreachVariants('## 推荐稿\n<script>alert(1)</script>\n## 依据\nsecret'),[{label:'推荐稿',text:'<script>alert(1)</script>'}]);
});
test('draft writer keeps optimistic concurrency and card-directory boundaries',async t=>{
 const f=await fixture(t),first=await f.save();await f.save(f.meta,f.body.replace(message,'用户手动修改的开场消息'));
 await assert.rejects(jobs.writeDocument(f.w,f.op.id,'analysis/outreach.md',path.join(f.w,'candidate.md'),first.sha256),e=>e.code==='RECORD_CONFLICT');
 const file=path.join(f.w,'opportunities',f.op.id,'analysis/outreach.md');await rm(file);
 try{await symlink(path.join(f.w,'career.json'),file);}catch(e){if(e.code==='EPERM')return t.diagnostic('symlink boundary check unavailable without OS symlink permission');throw e;}
 const draft=await readOutreach(f.w,f.op.id);assert.equal(draft.state,'missing');assert.deepEqual(draft.variants,[]);
});
