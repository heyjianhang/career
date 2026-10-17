import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {mkdtemp,mkdir,realpath,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {emptyOptionalResume} from './fixtures/resume-empty.mjs';
import {templates} from '../dist/presentation/templates/registry.js';
import {build} from '../dist/presentation/build.js';
import {exportPdf} from '../dist/presentation/pdf.js';
const out=path.resolve(process.argv[2]??'.cache/resume-empty-review/'+Date.now());await mkdir(out,{recursive:true});
const w=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-empty-layout-'));
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:794,height:1123}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  const b=emptyOptionalResume(),file=path.join(w,'package.json');await writeFile(file,JSON.stringify(b));
  const built=await build(file,w);
  for(const t of templates){
    await page.setContent(await readFile(path.join(built.directory,`.print-${t.id}.html`),'utf8'),{waitUntil:'load'});
    await page.waitForFunction(()=>document.documentElement.dataset.pagination==='ready',null,{timeout:60000});
    const text=await page.locator('#pages').innerText();
    for(const absent of ['核心技能','荣誉与绩效','资格证书','证书名称'])assert.ok(!text.includes(absent),t.id+': '+absent);
    for(const present of ['林序','知识助手','接入知识资料并评估检索结果。','完成试点交付。'])assert.ok(text.includes(present),t.id+': '+present);
    assert.equal(await page.locator('h2,h3,p,li').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()).length),0);
    const pages=await page.locator('.pagedjs_page').count();assert.equal(pages,1,t.id+': no blank continuation page');
    await page.locator('.pagedjs_page').first().screenshot({path:path.join(out,t.id+'.png')});
    await exportPdf(built.directory,t.id,path.join(out,t.id+'.pdf'));
    const pdf=await PDFDocument.load(await readFile(path.join(out,t.id+'.pdf')));assert.equal(pdf.getPageCount(),pages);
    results.push({id:t.id,pages,pdf:true,emptySections:false});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(JSON.parse(await readFile(file,'utf8')),b);
  await writeFile(path.join(out,'results.json'),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,exports:results.length,out}));
}finally{await browser.close();await rm(w,{recursive:true,force:true});}
