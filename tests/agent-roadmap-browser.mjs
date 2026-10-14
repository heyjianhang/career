import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {buildAgentRoadmap} from '../scripts/build-agent-roadmap.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const built=await buildAgentRoadmap();
const out=path.join(root,'.cache/agent-roadmap-review');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
try{
 await page.goto(pathToFileURL(built.file).href);
 const data=await page.locator('#roadmap-data').textContent().then(JSON.parse);
 for(const route of data.routes){
  await page.locator(`[data-route="${route.id}"]`).click();
  for(const id of route.steps){
   await page.locator(`.step-button[data-step="${id}"]`).click();
   const step=data.steps.find(s=>s.id===id);
   await page.locator('.stage-top h2').filter({hasText:step.name}).waitFor();
   assert.equal(await page.locator('.stage .doc-link').count(),step.reads.length);
  }
 }
 await page.locator('[data-route="continue"]').click();
 await page.locator('.step-button[data-step="depth"]').click();
 await page.locator('.doc-link').filter({hasText:'项目访谈'}).click();
 await page.locator('#reader[open]').waitFor();
 assert.match(await page.locator('#reader-content').innerText(),/取舍/);
 await page.locator('#reader-raw').click();
 assert.equal(await page.locator('#reader-content').innerText(),data.docs['.agents/skills/career-project/SKILL.md'].raw);
 await page.locator('#reader-preview').click();
 await page.locator('#reader-content a').filter({hasText:'保存方法'}).click();
 assert.equal(await page.locator('#reader-title').innerText(),'每轮访谈如何保存');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#reader-title').innerText(),data.docs['.agents/skills/career-project/SKILL.md'].title);
 assert.equal(await page.locator('#reader').evaluate(el=>el.open),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#reader').evaluate(el=>el.open),false);
 await page.locator('[data-open-doc="context/progress.md"]').first().click();
 assert.match(await page.locator('#reader-content').innerText(),/阶段总账/);
 await page.keyboard.press('Escape');
 await page.locator('[data-phase="depth"]').click();
 await page.locator('.stage-top h2').filter({hasText:'把当前经历问深'}).waitFor();
 const sizes=[1440,1024,768,390,320];
 for(const width of sizes){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(()=>scrollTo(0,0));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`page overflow at ${width}`);
  await page.screenshot({path:path.join(out,`roadmap-${width}.png`),fullPage:true});
  await page.locator('.doc-link').filter({hasText:'项目访谈'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`reader overflow at ${width}`);
  const bounds=await page.locator('#reader').boundingBox();assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1);
  await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.doc-link').filter({hasText:'项目访谈'}).click();
 await page.screenshot({path:path.join(out,'reader-desktop.png')});
 await page.keyboard.press('Escape');
 await page.reload();
 assert.equal(await page.locator('.stage-top h2').innerText(),'把当前经历问深');
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(network.length,0,'roadmap must read offline');
 await writeFile(path.join(out,'result.json'),JSON.stringify({routes:data.routes.length,steps:data.steps.length,documents:Object.keys(data.docs).length,viewports:sizes,offline:true,errors},null,2));
 console.log(JSON.stringify({passed:true,output:out}));
}finally{await browser.close()}
