import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,symlink,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parse,stringify} from 'yaml';
import * as board from '../dist/opportunities/store.js';
import {setup,withLock} from '../dist/workspace/setup.js';
import {initHistory,saveHistory} from '../dist/workspace/git.js';
const run=promisify(execFile),cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t){const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-board-')),w=path.join(dir,'个人 工作区');t.after(()=>rm(dir,{recursive:true,force:true}));await setup(w,false);return {dir,w};}
async function command(w,...args){try{return JSON.parse((await run(process.execPath,[cli,...args,'--workspace',w,'--json'])).stdout);}catch(e){if(e.stderr)return JSON.parse(e.stderr);throw e;}}
const create=w=>board.add(w,{company:'远山（虚构）',title:'产品经理',sources:[{platform:'referral',label:'朋友介绍'}],body:'## 当前判断\n尚待核实。'});
const rejects=(p,code)=>assert.rejects(p,e=>e.code===code);
async function input(dir,name,text){const p=path.join(dir,name);await writeFile(p,text);return p;}

test('empty board is read-only; discovery covers seven sources and input contracts',async t=>{
 const {w}=await fixture(t),r=await command(w,'board','overview');assert.equal(r.status,'success');assert.equal(r.data.total,0);assert.ok(r.data.empty_message);await assert.rejects(stat(path.join(w,'opportunities')),e=>e.code==='ENOENT');
 const help=JSON.parse((await run(process.execPath,[cli,'--help','--json'])).stdout);for(const name of ['board overview','opportunity context','task save'])assert.ok(help.data.commands.some(c=>c.command==='career '+name));
 const schema=JSON.parse((await run(process.execPath,[cli,'opportunity','schema','--json'])).stdout);assert.equal(Object.keys(schema.data.platforms).length,7);
 const op=await board.add(w,schema.data.examples.create);assert.ok(op.id.startsWith('opp-'));assert.equal((await board.overview(w)).total,1);
 const bad=await command(w,'opportunity','show','--id','../../bad');assert.equal(bad.errors[0].code,'INVALID_ARGUMENT');
});

test('user rating stays independent from Agent recommendation; stale writes cannot overwrite',async t=>{
 const {w}=await fixture(t),op=await create(w);const stars=await board.rate(w,op.id,'5',op.sha256);
 const recommended=await board.update(w,op.id,{recommendation:{rating:3,reason:'需核实出差要求',evidence:['job.md 中的出差要求待确认'],assessed_at:new Date().toISOString()},extensions:{custom:'keep'}},stars.sha256);
 assert.equal((await board.show(w,op.id)).card.meta.user_rating,5);
 await rejects(board.update(w,op.id,{title:'不能覆盖'},op.sha256),'RECORD_CONFLICT');await rejects(board.update(w,op.id,{user_rating:2},recommended.sha256),'INVALID_RECORD');
 const moved=await board.update(w,op.id,{stage:'interviewing'},recommended.sha256);const state=await board.show(w,op.id);assert.equal(state.card.meta.title,'产品经理');assert.equal(state.card.body,'## 当前判断\n尚待核实。');assert.equal(state.card.meta.extensions.custom,'keep');
 await rejects(board.update(w,op.id,{stage:'archived'},moved.sha256),'INVALID_RECORD');const archived=await board.update(w,op.id,{stage:'ended',outcome:'withdrawn',archived:true},moved.sha256);const reopened=await board.update(w,op.id,{stage:'inbox',archived:false},archived.sha256);await board.rate(w,op.id,'none',reopened.sha256);
 assert.equal((await board.show(w,op.id)).card.meta.archived_reason,null);assert.equal((await board.list(w,{minRating:'1'})).cards.length,0);
});

test('two Agents can continue a job through tasks, documents, resume relations and context',async t=>{
 const {w,dir}=await fixture(t),op=await create(w);const jd=await input(dir,'jd.md','# 原始 JD\n需要跨部门协作。');await board.writeDocument(w,op.id,'job.md',jd);
 const task=await board.saveTask(w,op.id,{title:'岗位匹配',status:'in_progress',owner:'agent',assigned_to:'agent-a',body:'已读取 JD，下一步核对项目事实。'});
 const handoff=await board.context(w,op.id);assert.equal(handoff.pending_tasks[0].meta.assigned_to,'agent-a');assert.match(handoff.pending_tasks[0].body,/下一步/);assert.ok(handoff.next_reads.some(r=>r.path.endsWith('/job.md')));
 const analysis=await input(dir,'match.md','# 匹配分析\n用户确认跨部门经验，出差条件待核实。');const doc=await board.writeDocument(w,op.id,'analysis/match.md',analysis,undefined,'agent-b');
 const resume='resume/versions/version-test/resume.md';await mkdir(path.dirname(path.join(w,resume)),{recursive:true});await writeFile(path.join(w,resume),'冻结正文（合成占位，本测试不调用 v2 校验）');
 const completed=await board.saveTask(w,op.id,{id:task.id,title:'岗位匹配',status:'done',owner:'agent',assigned_to:'agent-b',outcome:'完成分析，待用户确认出差。',links:[{kind:'document',target:'analysis/match.md',sha256:doc.sha256}]},handoff.pending_tasks[0].sha256);
 assert.ok(completed.event);await board.update(w,op.id,{next_action:{title:'确认出差接受度',owner:'user',due:'2026-10-16'},links:[{kind:'resume',target:resume}]},op.sha256);
 const next=await board.context(w,op.id);assert.equal(next.pending_tasks.length,0);assert.equal(next.card.meta.next_action.owner,'user');assert.ok(next.relations.some(r=>r.kind==='resume'));assert.ok(next.recent_activity.some(e=>e.meta.actor==='agent-b'));
 const global=await board.overview(w);assert.ok(global.relations.some(r=>r.target.endsWith('analysis/match.md')));assert.equal(global.issues.length,0);
 await writeFile(path.join(w,doc.path),'已修改分析');assert.ok((await board.overview(w)).issues.some(i=>i.code==='STALE_LINK'));
});

test('task dependencies reject missing links, cycles and premature completion',async t=>{
 const {w}=await fixture(t),op=await create(w);const a=await board.saveTask(w,op.id,{title:'分析',owner:'agent',status:'pending'});
 await rejects(board.saveTask(w,op.id,{title:'不存在依赖',owner:'agent',status:'pending',depends_on:['task-missing']}),'INVALID_DEPENDENCIES');
 const b=await board.saveTask(w,op.id,{title:'定制简历',owner:'agent',status:'pending',depends_on:[a.id]});
 await rejects(board.saveTask(w,op.id,{id:a.id,title:'分析',owner:'agent',status:'pending',depends_on:[b.id]},a.sha256),'INVALID_DEPENDENCIES');
 await rejects(board.saveTask(w,op.id,{id:b.id,title:'定制简历',owner:'agent',status:'in_progress'},b.sha256),'TASK_BLOCKED');
 await rejects(board.saveTask(w,op.id,{id:a.id,title:'分析',owner:'agent',status:'done'},a.sha256),'INVALID_RECORD');
 await board.saveTask(w,op.id,{id:a.id,title:'分析',owner:'agent',status:'done',outcome:'用户确认无需再分析'},a.sha256);
 await board.saveTask(w,op.id,{id:b.id,title:'定制简历',owner:'agent',status:'in_progress'},b.sha256);
 await rejects(board.saveTask(w,op.id,{id:b.id,title:'覆盖',owner:'agent',status:'pending'},b.sha256),'RECORD_CONFLICT');
});

test('paths, symlinks, attachment collisions, invalid records and locks preserve data',async t=>{
 const {w,dir}=await fixture(t),op=await create(w),file=await input(dir,'note.md','# 用户原话');const note=await board.writeDocument(w,op.id,'notes.md',file);
 await rejects(board.writeDocument(w,op.id,'notes.md',file),'MATCH_REQUIRED');await rejects(board.writeDocument(w,op.id,'../escape.md',file),'INVALID_PATH');await rejects(board.writeDocument(w,op.id,'card.md',file),'INVALID_PATH');await rejects(board.readDocument(w,op.id,'../../career.json'),'INVALID_PATH');
 const attachment=await board.attach(w,op.id,file);await rejects(board.attach(w,op.id,file),'FILE_EXISTS');assert.equal(await readFile(path.join(w,attachment.path),'utf8'),'# 用户原话');
 await symlink(file,path.join(w,'opportunities',op.id,'analysis-link'));await assert.rejects(board.readDocument(w,op.id,'analysis-link/out.md'),/链接/);
 assert.ok((await board.show(w,op.id)).issues.some(i=>i.code==='UNSAFE_PATH'));
 const link=path.join(dir,'linked.md');await symlink(file,link);await assert.rejects(board.attach(w,op.id,link),/链接/);
 await withLock(w,async()=>{await rejects(board.writeDocument(w,op.id,'notes.md',file,note.sha256),'WORKSPACE_BUSY');});
 await writeFile(path.join(w,op.path),'broken');const result=await command(w,'board','overview');assert.equal(result.status,'success');assert.equal(result.warnings.length,1);assert.equal((await command(w,'board','check')).status,'error');
});

test('source filtering, duplicate hints, dates, event evidence and archived pending work',async t=>{
 const {w}=await fixture(t);const source={platform:'boss',native_id:'same',captured_at:'2026-10-13T09:00:00+08:00'};
 const a=await board.add(w,{company:'一号（虚构）',title:'运营',sources:[source,{platform:'other',label:'线下活动'}]}),b=await board.add(w,{company:'一号（虚构）',title:'运营再次开放',sources:[source],links:[{kind:'opportunity',target:a.id}]});
 await board.rate(w,a.id,'4',a.sha256);assert.equal((await board.list(w,{source:'boss',minRating:'4',query:'运营'})).cards.length,1);
 await rejects(board.update(w,b.id,{next_action:{title:'错误日期',owner:'user',due:'2026-02-30'}},b.sha256),'INVALID_RECORD');
 await board.saveTask(w,b.id,{title:'请确认意向',status:'waiting_user',owner:'user'});await board.update(w,b.id,{archived:true},b.sha256);
 await board.log(w,a.id,{title:'一次模拟练习',evidence_type:'mock_interview',body:'假设问题与回答，不是真实面试。'});
 const all=await board.overview(w);assert.equal(all.attention.duplicate_sources.length,1);assert.equal(all.attention.waiting_user[0].archived,true);assert.equal((await board.show(w,a.id)).card.meta.stage,'inbox');assert.equal((await board.show(w,a.id)).recent_activity[0].meta.evidence_type,'mock_interview');
});

test('recover interrupted transaction without overwriting an external edit',async t=>{
 const {w}=await fixture(t),op=await create(w),old=await readFile(path.join(w,op.path));const changed=Buffer.from(old.toString().replace('产品经理','高级产品经理'));const eventPath=`opportunities/${op.id}/activity/event-recover.md`,event=Buffer.from('---\n'+stringify({schema:'career-activity/v1',id:'event-recover',kind:'record_change',actor:'test',title:'恢复事件',created_at:new Date().toISOString()})+'---\n');
 const journal={schema:'career-opportunity-transaction/v1',writes:[{path:op.path,before:sha(old),after:sha(changed),content:changed.toString('base64')},{path:eventPath,before:null,after:sha(event),content:event.toString('base64')}]};
 const txn=path.join(w,'opportunities/.transaction.json');await writeFile(txn,JSON.stringify(journal));await writeFile(path.join(w,op.path),changed);
 await rejects(board.overview(w),'RECOVERY_REQUIRED');assert.equal((await board.recover(w)).recovered,true);assert.equal(await readFile(path.join(w,eventPath),'utf8'),event.toString());assert.equal((await board.show(w,op.id)).card.meta.title,'高级产品经理');assert.equal((await board.recover(w)).recovered,false);
 await rm(path.join(w,eventPath));await writeFile(txn,JSON.stringify(journal));await writeFile(path.join(w,op.path),'用户外部编辑');await rejects(board.recover(w),'RECORD_CONFLICT');assert.equal(await readFile(path.join(w,op.path),'utf8'),'用户外部编辑');await assert.rejects(stat(path.join(w,eventPath)),e=>e.code==='ENOENT');
});

test('opportunity records are included in Git checkpoints and workspace validation',async t=>{
 const {w}=await fixture(t),op=await create(w);await initHistory(w,'Board Test','board@example.invalid');await saveHistory(w,'记录岗位');const tracked=(await run('git',['ls-files'],{cwd:w})).stdout;assert.ok(tracked.includes(op.path));assert.ok(tracked.includes('career-board/SKILL.md'));
 assert.equal((await command(w,'workspace','check')).status,'success');await writeFile(path.join(w,op.path),'broken');await rejects(saveHistory(w,'不应保存坏记录'),'WORKSPACE_INVALID');
});

test('CLI mutations form a complete handoff without a hidden API',async t=>{
 const {w,dir}=await fixture(t);const c=async(...args)=>{const r=await command(w,...args);assert.equal(r.status,'success',JSON.stringify(r));return r.data;};
 const data=await input(dir,'op.json',JSON.stringify({company:'CLI 公司（虚构）',title:'运营经理',body:'当前待分析'}));const op=await c('opportunity','add','--input',data);
 const patch=await input(dir,'patch.json',JSON.stringify({stage:'preparing'}));const updated=await c('opportunity','update','--id',op.id,'--input',patch,'--if-match',op.sha256);
 await c('opportunity','rate','--id',op.id,'--stars','4','--if-match',updated.sha256);
 const doc=await input(dir,'job.md','# JD');await c('opportunity','write','--id',op.id,'--path','job.md','--input',doc);const read=await c('opportunity','read','--id',op.id,'--path','job.md');assert.equal(read.content,'# JD');
 await c('opportunity','attach','--id',op.id,'--input',doc,'--name','说明.md');
 const task=await input(dir,'task.json',JSON.stringify({title:'核对职责',status:'waiting_user',owner:'user',body:'请确认是否愿意出差'}));await c('task','save','--opportunity',op.id,'--input',task);
 const event=await input(dir,'event.json',JSON.stringify({title:'用户补充',evidence_type:'user_report',body:'希望在杭州工作'}));await c('opportunity','log','--id',op.id,'--input',event,'--actor','user');
 const ctx=await c('opportunity','context','--id',op.id);assert.equal(ctx.pending_tasks.length,1);assert.equal((await c('opportunity','list','--stage','preparing','--min-rating','4')).cards.length,1);assert.equal((await c('board','check')).valid,true);
});

test('context is bounded, with complete files available; concurrent writers do not lose changes',async t=>{
 const {w}=await fixture(t),op=await create(w);for(let i=0;i<3;i++)await board.saveTask(w,op.id,{title:'任务'+i,status:'pending',owner:'agent',body:'x'.repeat(18000)});
 const ctx=await board.context(w,op.id);assert.ok(ctx.pending_tasks.some(t=>t.truncated));assert.ok([ctx.card,...ctx.pending_tasks,...ctx.recent_activity].reduce((n,r)=>n+r.body.length,0)<=32000);
 const full=await board.readDocument(w,op.id,ctx.pending_tasks[2].path.split('/').slice(2).join('/'));assert.match(full.content,/x{18000}/);
 const writes=await Promise.allSettled([board.update(w,op.id,{title:'改动 A'},op.sha256),board.update(w,op.id,{title:'改动 B'},op.sha256)]);assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);assert.ok(['WORKSPACE_BUSY','RECORD_CONFLICT'].includes(writes.find(r=>r.status==='rejected').reason.code));assert.equal((await board.overview(w)).issues.length,0);
});

test('invalid links and unsafe recovery targets cannot write outside the job',async t=>{
 const {w}=await fixture(t),op=await create(w);await rejects(board.update(w,op.id,{links:[{kind:'document',target:'../card.md'}]},op.sha256),'INVALID_LINKS');await rejects(board.update(w,op.id,{links:[{kind:'resume',target:'career.json'}]},op.sha256),'INVALID_LINKS');
 const before=await readFile(path.join(w,'career.json')),malicious=Buffer.from('overwrite');await writeFile(path.join(w,'opportunities/.transaction.json'),JSON.stringify({schema:'career-opportunity-transaction/v1',writes:[{path:`opportunities/${op.id}/../../career.json`,before:sha(before),after:sha(malicious),content:malicious.toString('base64')},{path:`opportunities/${op.id}/activity/event-x.md`,before:null,after:sha(malicious),content:malicious.toString('base64')}]}));
 await rejects(board.recover(w),'INVALID_TRANSACTION');assert.deepEqual(await readFile(path.join(w,'career.json')),before);
});

test('outcome and archive are independent; legacy reads preserve bytes and uncertainty',async t=>{
 const {w}=await fixture(t),op=await create(w);
 await rejects(board.update(w,op.id,{stage:'ended'},op.sha256),'INVALID_RECORD');
 const ended=await board.update(w,op.id,{stage:'ended',outcome:'rejected'},op.sha256);
 const archived=await board.update(w,op.id,{archived:true},ended.sha256);
 assert.equal((await board.overview(w)).active,0);
 assert.equal((await board.list(w,{archived:'true'})).cards[0].outcome,'rejected');
 await board.update(w,op.id,{archived:false},archived.sha256);
 const d=await board.show(w,op.id);assert.equal(d.card.meta.stage,'ended');assert.equal(d.card.meta.outcome,'rejected');
 const legacy=await create(w),p=path.join(w,legacy.path),original=await readFile(p,'utf8');
 for(const stage of ['contacting','archived']){
  const raw=original.replace('stage: inbox','stage: '+stage).replace('archived_reason: null','archived_reason: 旧原因，不推测结果');await writeFile(p,raw);
  const read=await board.show(w,legacy.id);assert.equal(read.card.meta.stage,stage==='contacting'?'applied':'ended');assert.equal(read.card.meta.archived,stage==='archived');assert.equal(read.card.meta.outcome,null);assert.equal(read.card.meta.legacy_stage,stage);assert.equal(await readFile(p,'utf8'),raw);
 }
 const before=await board.show(w,legacy.id);await board.update(w,legacy.id,{archived:false},before.card.sha256);
 const after=await board.show(w,legacy.id);assert.equal(after.card.meta.archived_reason,'旧原因，不推测结果');assert.equal(after.card.meta.outcome,null);assert.match(await readFile(p,'utf8'),/legacy_stage: archived/);
});

test('interviews support optional preparation, repeated mocks and bounded multi-Agent handoff',async t=>{
 const {w,dir}=await fixture(t),op=await create(w);
 const data=await input(dir,'round.json',JSON.stringify({title:'技术一面',scheduled_at:'2026-10-15T15:00:00+08:00',body:'自由正文，不要求固定章节。'}));
 const result=await command(w,'interview','save','--opportunity',op.id,'--input',data);assert.equal(result.status,'success');const round=result.data;
 let detail=await board.show(w,op.id);assert.equal(detail.card.meta.stage,'inbox');assert.equal(detail.interviews.length,1);assert.equal(detail.interviews[0].documents.length,0);
 assert.equal((await board.overview(w)).upcoming_interviews[0].id,round.id);
 const doc=await input(dir,'practice.md','# 任意标题\n\n模拟反馈。');
 for(const n of [1,2])await board.writeDocument(w,op.id,`interviews/${round.id}/simulations/mock-${n}.md`,doc);
 await rejects(board.writeDocument(w,op.id,`interviews/${round.id}/record.md`,doc,round.sha256),'INVALID_PATH');
 await board.saveInterview(w,op.id,{id:round.id,title:'技术一面',status:'completed'},round.sha256);
 await rejects(board.saveInterview(w,op.id,{id:round.id,title:'覆盖旧版'},round.sha256),'RECORD_CONFLICT');
 await rejects(board.saveInterview(w,op.id,{title:'错误日期',scheduled_at:'2026-02-30'}),'INVALID_RECORD');
 const ctx=await command(w,'interview','context','--opportunity',op.id,'--round',round.id);assert.equal(ctx.status,'success');assert.equal(ctx.data.selected_interview.body,'自由正文，不要求固定章节。');assert.equal(ctx.data.selected_interview.documents.length,2);assert.ok(ctx.data.next_reads.some(r=>r.path.endsWith('mock-2.md')));
 const listing=await command(w,'interview','list','--opportunity',op.id);assert.equal(listing.data.interviews[0].meta.status,'completed');assert.equal((await board.overview(w)).upcoming_interviews.length,0);
 await writeFile(path.join(w,round.path),'损坏内容');assert.ok((await board.show(w,op.id)).issues.some(i=>i.code==='INVALID_INTERVIEW'));
});

test('older optional fields and unknown metadata survive typed reads, edits and handoffs', async t => {
  const {w} = await fixture(t), op = await create(w);
  const task = await board.saveTask(w, op.id, {title:'核实岗位', owner:'agent', status:'pending', body:'任务原文'});
  const round = await board.saveInterview(w, op.id, {title:'一面', body:'轮次原文'});
  const event = await board.log(w, op.id, {title:'用户补充', evidence_type:'user_report', body:'事件原文'});
  const annotation = {nested:[false, 7, {note:'保留用户自定义内容'}]};
  async function amend(relative, omitted) {
    const file = path.join(w, relative), raw = await readFile(file, 'utf8');
    const [, header, body] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const meta = parse(header);
    for (const key of omitted) delete meta[key];
    meta.user_annotation = annotation;
    await writeFile(file, '---\n' + stringify(meta) + '---\n' + body);
  }
  await amend(op.path, ['location','salary','next_action','recommendation','archived','outcome']);
  await amend(task.path, ['assigned_to','due','outcome']);
  await amend(round.path, ['scheduled_at']);
  await amend(event.path, ['links','occurred_at']);
  const before = await board.show(w, op.id);
  assert.equal(before.card.meta.archived, false);
  assert.equal(before.card.meta.outcome, null);
  assert.equal(before.card.meta.location, undefined);
  assert.equal(before.interviews[0].meta.scheduled_at, undefined);
  assert.equal((await board.overview(w)).upcoming_interviews[0].scheduled_at, null);
  await board.update(w, op.id, {title:'新标题'}, before.card.sha256);
  await board.saveTask(w, op.id, {id:task.id, title:'已核实', owner:'agent', status:'done', outcome:'用户确认'}, before.tasks[0].sha256);
  await board.saveInterview(w, op.id, {id:round.id, title:'一面结束', status:'completed'}, before.interviews[0].sha256);
  const after = await board.show(w, op.id);
  for (const record of [after.card, after.tasks[0], after.interviews[0], after.recent_activity.find(r => r.meta.id === event.id)]) {
    assert.deepEqual(record.meta.user_annotation, annotation);
  }
  assert.equal(after.tasks[0].body, '任务原文');
  assert.equal(after.interviews[0].body, '轮次原文');
  assert.equal(after.issues.length, 0);
  const handoff = await board.context(w, op.id);
  assert.deepEqual(handoff.card.meta.user_annotation, annotation);
  assert.deepEqual(handoff.interviews[0].meta.user_annotation, annotation);
});

test('untrusted inputs and malformed recovery journals cannot mutate saved records', async t => {
  const {w} = await fixture(t), op = await create(w);
  const saved = await readFile(path.join(w, op.path));
  for (const value of [null, [], 'not a record', {title:'缺少必填字段', status:'unknown'}]) {
    await rejects(board.add(w, value), 'INVALID_RECORD');
    await rejects(board.update(w, op.id, value, op.sha256), 'INVALID_RECORD');
    await rejects(board.saveTask(w, op.id, value), 'INVALID_RECORD');
    await rejects(board.saveInterview(w, op.id, value), 'INVALID_RECORD');
    await rejects(board.log(w, op.id, value), 'INVALID_RECORD');
  }
  const journalPath = path.join(w, 'opportunities/.transaction.json');
  for (const journal of [null, [], {schema:'career-opportunity-transaction/v1', writes:[null, null]},
    {schema:'career-opportunity-transaction/v1', writes:[{path:op.path, before:null, after:42, content:'YQ=='}, {}]}]) {
    const bytes = JSON.stringify(journal);
    await writeFile(journalPath, bytes);
    await rejects(board.recover(w), 'INVALID_TRANSACTION');
    assert.equal(await readFile(journalPath, 'utf8'), bytes);
    assert.deepEqual(await readFile(path.join(w, op.path)), saved);
  }
  await rm(journalPath);
  assert.equal((await board.show(w, op.id)).activity_count, 1);
});
