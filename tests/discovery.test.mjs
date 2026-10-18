import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,readFile,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setup,installAgent} from '../dist/workspace/setup.js';
import {inventory,readMaterial,materialPath,materialLink} from '../dist/profile/store.js';
import {checkDocumentation} from '../scripts/check-docs.mjs';
import {prepareDiscoveryDemo} from '../scripts/prepare-discovery-demo.mjs';
import {initHistory,saveHistory,git,pull} from '../dist/workspace/git.js';
import * as jobs from '../dist/opportunities/store.js';

test('company research links to source evidence and actual jobs without changing job state',async t=>{
 const f=await prepareDiscoveryDemo();t.after(()=>rm(f.workspace,{recursive:true,force:true}));
 const company='research/companies/companies/company-jingchuan.md',data=await inventory(f.workspace);
 assert.equal(data.files.filter(x=>x.group==='companies').length,5);
 const report=await readMaterial(f.workspace,'research/companies/INDEX.md');
 assert.match(report.html,/data-document="research\/companies\/companies\/company-jingchuan.md"/);
 const detail=await readMaterial(f.workspace,company);
 assert.ok(detail.html.includes('/board?opportunity='+f.opportunity));
 assert.ok(detail.html.includes('data-document="research/companies/sources/source-jingchuan.md"'));
 assert.equal(materialLink('opportunities/'+f.opportunity+'/job.md'),'/board?opportunity='+f.opportunity);
 assert.ok(!materialLink('opportunities/../private/job.md').startsWith('/board'));
 const before=await jobs.show(f.workspace,f.opportunity);await readMaterial(f.workspace,company);
 assert.equal((await jobs.show(f.workspace,f.opportunity)).sha256,before.sha256);
 assert.equal((await jobs.overview(f.workspace)).total,1); // The other company has no invented JD.
 await writeFile(path.join(f.workspace,company),detail.source+'\n新增核实记录，原用户笔记保留。');
 assert.notEqual((await inventory(f.workspace)).revision,data.revision);
 await mkdir(path.join(f.workspace,'research/companies-private'),{recursive:true});
 await writeFile(path.join(f.workspace,'research/companies-private/secret.md'),'unmanaged');
 await writeFile(path.join(f.workspace,'research/companies/.env'),'SECRET=synthetic');
 await symlink(path.join(f.workspace,'research/companies-private/secret.md'),path.join(f.workspace,'research/companies/linked.md'));
 for(const p of ['research/companies-private/secret.md','research/companies/.env','research/companies/linked.md','research/companies/../companies-private/secret.md','opportunities/'+f.opportunity+'/job.md'])await assert.rejects(materialPath(f.workspace,p));
});

test('discovery Skill installs, upgrades and preserves custom instructions with complete installed links',async t=>{
 const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-discovery-install-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const w=path.join(dir,'workspace');await setup(w,false);
 assert.equal((await checkDocumentation(w)).skills,14);
 const relative='.agents/skills/career-discovery/',skill=path.join(w,relative);
 await rm(skill,{recursive:true});
 const manifestFile=path.join(w,'.career/managed.json'),manifest=JSON.parse(await readFile(manifestFile,'utf8'));
 for(const key of Object.keys(manifest.files))if(key.startsWith(relative))delete manifest.files[key];
 await writeFile(manifestFile,JSON.stringify(manifest));await writeFile(path.join(w,'AGENTS.md'),'# My own workflow\n');
 const upgraded=await installAgent(w);assert.ok(upgraded.installed.includes(relative+'SKILL.md'));assert.ok(upgraded.conflicts.includes('AGENTS.md'));
 assert.equal(await readFile(path.join(w,'AGENTS.md'),'utf8'),'# My own workflow\n');
 const method=path.join(skill,'references/research.md');await writeFile(method,'# My research notes\n');
 assert.ok((await installAgent(w)).conflicts.includes(relative+'references/research.md'));
 assert.equal(await readFile(method,'utf8'),'# My research notes\n');
});

test('company pool checkpoints and two-device updates preserve notes and exclude unrelated research',async t=>{
 const f=await prepareDiscoveryDemo(),dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-discovery-sync-'));
 t.after(async()=>{await rm(f.workspace,{recursive:true,force:true});await rm(dir,{recursive:true,force:true});});
 const w=f.workspace,p='research/companies/companies/company-yuanzhou.md';
 await writeFile(path.join(w,'research/unrelated.md'),'private unrelated');await writeFile(path.join(w,'research/companies/.env'),'SECRET=synthetic');
 await initHistory(w,'Synthetic User','synthetic@example.invalid');await saveHistory(w,'Save company research');
 const files=(await git(w,'ls-files')).split('\n');assert.ok(files.includes(p));assert.ok(!files.includes('research/unrelated.md'));assert.ok(!files.includes('research/companies/.env'));
 const remote=path.join(dir,'remote.git'),other=path.join(dir,'other');await git(dir,'init','--bare','--initial-branch=main',remote);await git(w,'remote','add','origin',remote);await git(w,'push','-u','origin','main');
 await git(dir,'clone',remote,other);await initHistory(other,'Synthetic Other','other@example.invalid');
 const old=await readFile(path.join(other,p),'utf8');await writeFile(path.join(other,p),old+'\n另一台设备补充：暂缓，等待工作地点确认。');await saveHistory(other,'Update company notes');await git(other,'push','origin','main');
 assert.equal((await pull(w,async()=> 'fixture/private')).updated,true);
 assert.equal(await readFile(path.join(w,p),'utf8'),old+'\n另一台设备补充：暂缓，等待工作地点确认。');
});
