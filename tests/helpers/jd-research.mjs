import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);

export function corpusFixture(){
 const text='负责客户反馈分析。数据分析经验优先。无需预算管理经验。本科及以上学历。';
 const make=(id,changes={})=>({id,sample_group:id,group_reason:'独立的虚构岗位',company:'示例公司 '+id,title:'客户运营',family:'客户运营',source:{platform:'synthetic',url:'https://example.com/jobs/'+id,native_id:id,locator:'合成文本',captured_at:'2026-10-17T10:00:00+08:00'},completeness:'full',decision:{status:'include',reason:'符合合成研究范围'},text,requirements:[
  {category:'analysis',modality:'responsibility',quote:'负责客户反馈分析',locator:'职责第1句'},
  {category:'analysis',modality:'preferred',quote:'数据分析经验优先',locator:'要求第1句'},
  {category:'budget',modality:'negated',quote:'无需预算管理经验',locator:'要求第2句'},
  {category:'degree',modality:'must',quote:'本科及以上学历',locator:'要求第3句'}],...changes});
 const first=make('a');
 return {schema:'jd-research-corpus/v1',scope:'仅用于离线测试的虚构运营与工程岗位',categories:[{id:'analysis',label:'分析能力',kind:'capability'},{id:'budget',label:'预算管理',kind:'capability'},{id:'degree',label:'本科学历',kind:'gate'}],jobs:[
  first,{...structuredClone(first),id:'a-copy',source:{...first.source,url:first.source.url+'?utm_source=test'}},
  make('b',{company:'示例工程公司',title:'应用开发',family:'应用工程',text:'负责运行日志分析。预算经验优先。',requirements:[{category:'analysis',modality:'responsibility',quote:'负责运行日志分析',locator:'职责1'},{category:'budget',modality:'preferred',quote:'预算经验优先',locator:'要求1'}]}),
  make('partial',{completeness:'partial'}),
  make('lead',{completeness:'lead',text:'',requirements:[]}),
  make('excluded',{decision:{status:'exclude',reason:'本次范围排除的合成岗位'}}),
  make('review',{company:null,decision:{status:'review',reason:'主体不明，待核对'}})
 ]};
}

export async function exerciseJdResearch(skill,dir){
 const license=await readFile(path.join(skill,'LICENSE'),'utf8');
 assert.ok(license.includes('MIT License')&&license.includes('career contributors'),'The installed Skill must retain its license');
 const input=path.join(dir,'jd-research-synthetic.json'),data=corpusFixture();
 await writeFile(input,JSON.stringify(data));const before=await readFile(input);
 const {stdout}=await exec(process.execPath,[path.join(skill,'scripts/summarize-corpus.mjs'),input],{cwd:dir});
 const result=JSON.parse(stdout);
 assert.equal(result.counts.records,7);assert.equal(result.counts.core_samples,2);assert.equal(result.counts.core_records,3);
 assert.equal(result.overall.categories.find(c=>c.id==='analysis').positive_samples,2);
 assert.equal(result.overall.categories.find(c=>c.id==='budget').positive_samples,1);
 assert.deepEqual(await readFile(input),before);
 assert.ok(!stdout.includes('无需预算管理经验'));assert.ok(!stdout.includes('utm_source'));
 return result;
}
