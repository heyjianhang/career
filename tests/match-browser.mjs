import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
import {encode} from '../dist/opportunities/files.js';
import {outreachFixture} from './helpers/outreach.mjs';
import {matchMetadata} from './helpers/match.mjs';
const f=await outreachFixture(),collection=await buildCollection(f.w),server=await startPreview(collection.directory,f.w),browser=await chromium.launch({headless:true});
const out=path.resolve(process.argv[2]??'.cache/match-review');await mkdir(out,{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1200,height:1000},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(server.url+'/board');await page.locator(`[data-opportunity="${f.op.id}"]`).click();await page.locator('#tab-match').click();await page.getByRole('heading',{name:'还没有匹配分析',exact:true}).waitFor();
 assert.equal(await page.locator('.match-score').count(),0);await page.locator('#update-match').click();await page.waitForFunction(async()=>(await navigator.clipboard.readText()).includes('0–4 评分'));
 await f.write('analysis/match.md','# 原有详细分析\n保留用户原文与补充。');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('heading',{name:'已有分析，尚未形成总体评分',exact:true}).waitFor();await page.locator('.markdown-body').filter({hasText:'保留用户原文'}).waitFor();assert.equal(await page.locator('.match-score').count(),0);
 const meta=matchMetadata(f),body='# 详细分析\n\n## 匹配之处\n业务集成有直接证据。\n\n## 需要补充\n模型评测尚未体现。';
 await f.write('analysis/match.md',encode(meta,body));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.match-score>strong').filter({hasText:'75'}).waitFor();
 assert.match(await page.locator('.match-coverage').innerText(),/70%/);assert.match(await page.locator('.match-coverage').innerText(),/52.5–82.5/);assert.equal(await page.locator('#job-rating [aria-pressed=true]').count(),0);
 assert.ok(await page.locator('.match-overview').evaluate(e=>e.getBoundingClientRect().top<document.querySelector('.markdown-body').getBoundingClientRect().top));
 await page.locator('.match-method summary').click();await page.getByText('权重 70% · 3 / 4',{exact:true}).waitFor();await page.locator('.match-method summary').click();
 for(const width of [320,390,768,1200]){
  await page.setViewportSize({width,height:1000});await page.locator('#match-title').scrollIntoViewIfNeeded();assert.equal(await page.locator('.reader-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,`fit ${width}`);
  if(width===390||width===1200)await page.screenshot({path:path.join(out,`match-${width}.png`)});
 }
 await page.locator('#mode-source').click();await page.locator('.source-code').waitFor();assert.equal(await page.locator('.match-overview').count(),0);assert.equal(await page.locator('.source-code').innerText(),await readFile(path.join(f.w,'opportunities',f.op.id,'analysis/match.md'),'utf8'));await page.locator('#mode-preview').click();await page.locator('.match-overview').waitFor();
 await f.write('job.md','# JD\n增加训练要求');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.outreach-warning').filter({hasText:'职位描述已更新'}).waitFor();assert.equal(await page.locator('#match-title').innerText(),'上次分析结果');
 await f.write('analysis/match.md',encode({...meta,criteria:meta.criteria.map(r=>({...r,score:null}))},body));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.match-score>strong').filter({hasText:'—'}).waitFor();assert.match(await page.locator('.match-coverage').innerText(),/0%/);
 const unsafe={...meta,summary:'<img src=x onerror="window.leaked=true">',criteria:meta.criteria.map(r=>({...r,score:4})),hard_conditions:[{label:'必备资格',status:'unmet',reason:'用户明确尚未取得。'}]};
 await f.write('analysis/match.md',encode(unsafe,body));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('[data-condition=unmet]').waitFor();assert.equal(await page.locator('.match-conclusion img').count(),0);assert.equal(await page.evaluate(()=>window.leaked),undefined);
 let release,started;const began=new Promise(r=>started=r),gate=new Promise(r=>release=r);await page.route('**/api/board/match-summary?*',async route=>{started();await gate;await route.continue();});
 await page.locator('#tab-resume').click();await page.locator('#tab-match').click();await began;await page.locator('#tab-outreach').click();release();await page.unrouteAll({behavior:'wait'});await page.locator('.outreach-empty').waitFor();assert.equal(await page.locator('.match-overview').count(),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,screenshots:out,checks:['Chinese tabs','unscored legacy','weighted score and coverage','independent user stars','summary above analysis','responsive','raw document','input changes','unknowns','hard condition conflict','escaped content','navigation race']}));
}finally{await browser.close();await server.close();await f.close();}
