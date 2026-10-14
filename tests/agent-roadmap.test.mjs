import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildAgentRoadmap} from '../scripts/build-agent-roadmap.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('offline roadmap embeds current source documents and all scenario links resolve',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'career-roadmap-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const result=await buildAgentRoadmap(dir),html=await readFile(result.file,'utf8');
 const data=JSON.parse(html.match(/<script id="roadmap-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 for(const route of data.routes)for(const id of route.steps)assert.ok(data.steps.some(s=>s.id===id));
 for(const step of data.steps)for(const link of step.reads)assert.ok(data.docs[link.path],link.path);
 for(const doc of Object.values(data.docs)){
  assert.ok((await stat(path.join(root,doc.source))).isFile());
  assert.equal(doc.raw,await readFile(path.join(root,doc.source),'utf8'));
  for(const link of doc.html.matchAll(/data-open-doc="([^"]+)"/g))assert.ok(data.docs[link[1]],link[1]);
 }
 assert.ok(data.docs['docs/agent-workflow.md']);
 assert.ok(data.docs['context/progress.md']);
 assert.ok(data.docs['.agents/skills/career-project/SKILL.md']);
 assert.ok(data.docs['.agents/skills/career-employment/SKILL.md']);
 for(const link of html.matchAll(/data-phase="([^"]+)"/g))assert.ok(data.routes.find(r=>r.id==='first').steps.includes(link[1]));
 assert.equal(Object.values(data.docs).some(d=>/career-release|\.local|node_modules/.test(d.source)),false);
 assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=/);
});
