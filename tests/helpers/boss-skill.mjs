import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

const exec=promisify(execFile);
export const bossFiles=[
 'SKILL.md','LICENSE','requirements.txt','upstream.json',
 'scripts/boss_cdp_raw.py','scripts/job_summary.py','data/city_codes.json',
 'references/usage.md','references/career-import.md','references/provenance.md'
].sort();

async function fileList(dir,base=dir){
 const files=[];
 for(const item of await readdir(dir,{withFileTypes:true})){
  assert.equal(item.isSymbolicLink(),false,'Bundled Skill must not follow local links');
  const p=path.join(dir,item.name);
  if(item.isDirectory())files.push(...await fileList(p,base));
  else files.push(path.relative(base,p).split(path.sep).join('/'));
 }
 return files.sort();
}

export async function verifyBossSkill(directory){
 assert.deepEqual(await fileList(directory),bossFiles,'Only reviewed Skill resources may ship');
 const upstream=JSON.parse(await readFile(path.join(directory,'upstream.json'),'utf8'));
 assert.deepEqual(Object.keys(upstream.files).sort(),['LICENSE','requirements.txt','data/city_codes.json','scripts/boss_cdp_raw.py','scripts/job_summary.py'].sort());
 for(const [file,digest] of Object.entries(upstream.files)){
  const bytes=await readFile(path.join(directory,file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,'Upstream snapshot changed: '+file);
 }
 assert.match(await readFile(path.join(directory,'LICENSE'),'utf8'),/Copyright \(c\) 2026 eatmoreduck/);
 assert.equal(JSON.parse(await readFile(path.join(directory,'data/city_codes.json'),'utf8'))['杭州'],'101210100');
}

// No downloads, browser startup, CDP calls or live account use. Python is optional
// for installing career; CI/local hosts with Python also exercise the shipped CLI.
export async function findPython(){
 const candidates=[...(process.env.CAREER_TEST_PYTHON?[[process.env.CAREER_TEST_PYTHON,[]]]:[]),
  ['python3.12',[]],['python3',[]],['python',[]],['py',['-3']]];
 for(const [command,prefix] of candidates){
  try{
   const {stdout}=await exec(command,[...prefix,'-B','-c','import sys,json; print(json.dumps(list(sys.version_info[:2])))'],{timeout:10_000});
   const [major,minor]=JSON.parse(stdout);if(major===3&&minor>=10)return {command,prefix};
  }catch{}
 }
 return null;
}

export async function exerciseBossSkill(directory,temp,python){
 const invoke=async(args)=>(await exec(python.command,[...python.prefix,'-B',...args],{
  cwd:temp,timeout:15_000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},maxBuffer:1024*1024
 })).stdout;
 const help=await invoke([path.join(directory,'scripts/boss_cdp_raw.py'),'--help']);
 assert.match(help,/--setup-chrome/);assert.match(help,/--setup-edge/);assert.match(help,/--no-detail/);
 const jobs=path.join(temp,'boss-list.json'),details=path.join(temp,'boss-details.json');
 await writeFile(jobs,JSON.stringify({keyword:'合成岗位',city:'杭州',jobs:[
  {job_id:'fixture-1',title:'合成 AI 应用工程师',boss_name:'分发验证公司（虚构）',salary:'15-20K',location:'杭州·滨江区',tags:'1-3年 | 本科',skills:'Python | LLM'}
 ]}));
 await writeFile(details,JSON.stringify([{job_id:'fixture-1',jd:'负责 Python LLM Agent 应用开发和交付。',skill_tags:['Python','LLM']} ]));
 const summary=await invoke([path.join(directory,'scripts/job_summary.py'),'--input',jobs,'--details',details,'--summary-only']);
 assert.match(summary,/分发验证公司（虚构）/);assert.match(summary,/15-20K/);assert.match(summary,/Python/);
 // Scripts must remain usable without writing cache files into the managed Skill.
 await verifyBossSkill(directory);
}
