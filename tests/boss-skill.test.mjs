import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {setup,installAgent} from '../dist/workspace/setup.js';
import {verifyBossSkill,exerciseBossSkill,findPython} from './helpers/boss-skill.mjs';

async function fixture(t){
 const dir=await realpath(await mkdtemp(path.join(os.tmpdir(),'career-boss-skill-')));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const workspace=path.join(dir,'我的工作区');await setup(workspace,false);
 return {dir,workspace,skill:path.join(workspace,'.agents/skills/boss-zhipin-scraper')};
}

test('BOSS Skill installs its fixed code, city data and license without runtime or user data',async t=>{
 const {workspace,skill}=await fixture(t);await verifyBossSkill(skill);
 assert.equal(await stat(path.join(workspace,'.local/boss-zhipin-scraper')).catch(()=>null),null);
 assert.match(await readFile(path.join(workspace,'AGENTS.md'),'utf8'),/boss-zhipin-scraper\/SKILL\.md/);
 const first=await readFile(path.join(skill,'scripts/boss_cdp_raw.py'));
 const retry=await installAgent(workspace);assert.equal(retry.conflicts.length,0);
 assert.deepEqual(await readFile(path.join(skill,'scripts/boss_cdp_raw.py')),first);
});

test('old workspace receives the new Skill while custom instructions and scripts survive',async t=>{
 const {workspace,skill}=await fixture(t);
 await rm(skill,{recursive:true});
 const manifestFile=path.join(workspace,'.career/managed.json'),manifest=JSON.parse(await readFile(manifestFile,'utf8'));
 for(const key of Object.keys(manifest.files))if(key.startsWith('.agents/skills/boss-zhipin-scraper/'))delete manifest.files[key];
 await writeFile(manifestFile,JSON.stringify(manifest));
 const entry=path.join(workspace,'AGENTS.md');await writeFile(entry,'# 用户自己维护的入口\n');
 const upgraded=await installAgent(workspace);await verifyBossSkill(skill);
 assert.ok(upgraded.installed.includes('.agents/skills/boss-zhipin-scraper/SKILL.md'));
 assert.ok(upgraded.conflicts.includes('AGENTS.md'));assert.equal(await readFile(entry,'utf8'),'# 用户自己维护的入口\n');
 const script=path.join(skill,'scripts/boss_cdp_raw.py');await writeFile(script,'# 用户自己修改的采集脚本\n');
 const again=await installAgent(workspace);assert.ok(again.conflicts.includes('.agents/skills/boss-zhipin-scraper/scripts/boss_cdp_raw.py'));
 assert.equal(await readFile(script,'utf8'),'# 用户自己修改的采集脚本\n');
});

test('installed BOSS scripts execute help and synthetic offline summary outside the repository',async t=>{
 const python=await findPython();if(!python){t.skip('Python 3.10+ not present; career installation does not require it');return;}
 const {dir,skill}=await fixture(t);await exerciseBossSkill(skill,dir,python);
});
