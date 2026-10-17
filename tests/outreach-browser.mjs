import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
import * as resumes from '../dist/resumes/store.js';
import * as jobs from '../dist/opportunities/store.js';
import {outreachFixture,message,short} from './helpers/outreach.mjs';
const f=await outreachFixture(),collection=await buildCollection(f.w),server=await startPreview(collection.directory,f.w),browser=await chromium.launch({headless:true});
const out=path.resolve(process.argv[2]??'.cache/outreach-review');await mkdir(out,{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1200,height:1000},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/board');await page.locator(`[data-opportunity="${f.op.id}"]`).click();await page.locator('#tab-resume').click();await page.locator('.chosen-resume').waitFor();assert.equal(await page.locator('.outreach-panel').count(),0);await page.locator('#tab-outreach').click();await page.locator('.outreach-empty').waitFor();
 await page.locator('#outreach-generate').click();await page.locator('#action-dialog').waitFor();const instruction=await page.locator('#action-text').inputValue();assert.ok(instruction.includes('career-outreach')&&instruction.includes(f.op.id));await page.locator('#action-confirm').click();await page.locator('#action-dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),instruction);
 await f.save();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'复制推荐稿',exact:true}).waitFor();
 for(const [label,text] of [['推荐稿',message],['简短版',short]]){await page.getByRole('button',{name:'复制'+label,exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),text);}
 assert.equal((await jobs.show(f.w,f.op.id)).card.meta.stage,'inbox');
 await page.locator('#outreach-document').click();await page.locator('.markdown-body').filter({hasText:'内部依据'}).waitFor();await page.locator('#tab-outreach').click();await page.locator('.outreach-message').first().waitFor();
 for(const width of [320,390,768,1200]){
  await page.setViewportSize({width,height:1000});await page.locator('#outreach-title').scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const n=document.querySelector('#job-tabs').getBoundingClientRect(),t=document.querySelector('#tab-outreach').getBoundingClientRect();return t.left>=n.left-1&&t.right<=n.right+1;});assert.equal(await page.locator('.outreach-page').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,`fit ${width}`);
  if(width===390||width===1200)await page.screenshot({path:path.join(out,`outreach-${width}.png`)});
 }
 // Input changes refresh even when card.md did not change.
 const r=await resumes.readResume(f.w,f.r.id);r.package.content.summary+=' 用户补充新职责。';await resumes.savePackage(f.w,r.package,r.sha256);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.outreach-warning').filter({hasText:'简历内容已更新'}).waitFor();
 assert.ok((await readFile(path.join(f.w,'opportunities',f.op.id,'analysis/outreach.md'),'utf8')).includes(message));
 // A delayed response must not overwrite a tab selected after the request began.
 let release,started;const began=new Promise(resolve=>started=resolve),gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/board/outreach?*',async route=>{started();await gate;await route.continue();});
 await page.locator('#tab-overview').click();await page.locator('#tab-outreach').click();await began;await page.locator('#tab-overview').click();release();await page.unrouteAll({behavior:'wait'});
 await page.locator('.markdown-body').filter({hasText:'负责 Agent'}).waitFor();assert.equal(await page.locator('.outreach-panel').count(),0);
 // Old/malformed documents remain readable but never offer whole-document copying.
 await f.write('analysis/outreach.md','# 旧稿\n内部选材分析');await page.locator('#tab-outreach').click();await page.locator('.outreach-warning').waitFor();assert.equal(await page.locator('[data-copy-outreach]').count(),0);
 await page.locator('#outreach-document').click();await page.locator('.markdown-body').filter({hasText:'内部选材分析'}).waitFor();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,screenshots:out,checks:['Agent handoff','copy isolation','no stage mutation','file navigation','source freshness','responsive layout','navigation race','invalid draft preservation']}));
}finally{await browser.close();await server.close();await f.close();}
