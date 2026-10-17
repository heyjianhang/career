import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {pathToFileURL} from 'node:url';
import {mkdtemp,rm,realpath,mkdir,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {initializeWorkspace,savePresentation} from '../dist/agent-api.js';
import * as resumes from '../dist/resumes/store.js';
import * as jobs from '../dist/opportunities/store.js';
import {blankPackage,blankExperience} from '../dist/resumes/model.js';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
const workspace=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-library-ui-'));await initializeWorkspace(workspace);
const b=blankPackage('resume-product','AI 产品经理 · 通用版');b.synthetic=true;b.content.profile={name:'林序',headline:'AI 产品经理',contacts:[{label:'城市',value:'杭州'},{label:'邮箱',value:'linxu@example.com'}]};b.content.summary='具备企业应用产品设计与交付经验。';b.content.sections=[{id:'projects',title:'项目经历',items:[{...blankExperience('project','project-one'),title:'企业知识助手',description:'将知识检索与业务流程连接。',responsibilities:'负责需求分析与产品设计。',achievements:'完成试点验收。'}]}];
const r=await resumes.savePackage(workspace,b),o=await jobs.add(workspace,{company:'远山科技（虚构）',title:'AI 产品经理'});await resumes.selectResume(workspace,o.id,r.id,o.sha256);
const longCopy=await resumes.createResume(workspace,'AI 应用开发 · 精简版',r.id),longRead=await resumes.readResume(workspace,longCopy.id);longRead.package.content.sections[0].items[0].responsibilities=Array.from({length:50},(_,i)=>`虚构长简历第 ${i+1} 项：整理试点反馈，与团队核对使用场景，更新验收记录并追踪后续反馈。`).join('\n');await resumes.savePackage(workspace,longRead.package,longRead.sha256);
await resumes.createResume(workspace,'产品管理 · 项目版 · 企业知识服务与跨团队应用交付经历 · 长标题布局验证',r.id);
const out=await buildCollection(workspace),server=await startPreview(out.directory,workspace,0,true),browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR',e.message);});page.on('response',r=>{if(r.status()>=400)console.error('HTTP',r.status(),r.url());});const proof=path.resolve('.cache/resume-library-review');await mkdir(proof,{recursive:true});
try{
 await page.goto(server.url);await page.locator('.resume-tile').first().waitFor();assert.equal(await page.locator('.resume-tile').count(),3);await page.locator('.resume-cover[data-preview="ready"]').nth(2).waitFor();assert.equal(await page.frameLocator('.resume-tile:first-child iframe').getByText('企业知识助手',{exact:true}).count(),1);assert.equal(await page.locator('.tile-body').getByText('虚构示例',{exact:true}).count(),0);const feet=await page.locator('.tile-body').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));assert.equal(new Set(feet).size,1);await page.screenshot({path:path.join(proof,'library.png'),fullPage:true});
 // Card metadata follows the actual selected-template pagination. Duplicate notifications stay safe.
 const productCard=()=>page.locator('.resume-tile').filter({has:page.locator(`[data-more="${r.id}"]`)});
 for(const tile of await page.locator('.resume-tile').all()){
  const count=Number(await tile.frameLocator('iframe').locator('html').getAttribute('data-page-count'));
  assert.ok(count>0);assert.equal(await tile.locator('.tile-page-count').innerText(),` · ${count} 页`);
  assert.match(await tile.locator('time').innerText(),/月\d+日更新$/);
  assert.ok((await tile.locator('.tile-meta').boundingBox()).y>(await tile.locator('h2').boundingBox()).y);
 }
 await page.frameLocator('.resume-tile:first-child iframe').locator('html').evaluate(()=>parent.postMessage({type:'career-pagination',state:'ready'},location.origin));
 assert.ok(Number((await page.locator('.resume-tile').filter({has:page.locator(`[data-more="${longCopy.id}"]`)}).locator('.tile-page-count').innerText()).match(/\d+/)[0])>1,'long content must show its real multi-page count');
 const more=productCard().getByRole('button',{name:/更多操作/}),menu=page.getByRole('menu',{name:/的操作$/});
 await more.focus();await page.waitForFunction(id=>getComputedStyle(document.querySelector(`[data-more="${id}"]`).parentElement).opacity==='1',r.id);
 await page.keyboard.press('ArrowDown');await menu.waitFor();assert.equal(await menu.getByRole('menuitem',{name:'另存一份'}).evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('ArrowUp');assert.equal(await menu.getByRole('menuitem',{name:'导出 PDF'}).evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Escape');assert.equal(await menu.isVisible(),false);assert.equal(await more.evaluate(e=>e===document.activeElement),true);
 await more.click();await menu.getByRole('menuitem',{name:'另存一份'}).click();await page.getByRole('heading',{name:'另存为新简历'}).waitFor();assert.equal(await page.locator('#resume-name').inputValue(),b.title+' · 副本');await page.locator('#dialog-cancel').click();
 await more.click();await page.locator('#resume-search').click();assert.equal(await menu.isVisible(),false);
 await more.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');assert.equal(await menu.isVisible(),false);

 const cardPdfEvent=page.waitForEvent('download');await more.click();await menu.getByRole('menuitem',{name:'导出 PDF'}).click();const cardPdf=path.join(proof,'card-export.pdf');await(await cardPdfEvent).saveAs(cardPdf);
 assert.equal((await PDFDocument.load(await readFile(cardPdf))).getPageCount(),Number((await productCard().locator('.tile-page-count').innerText()).match(/\d+/)[0]));assert.equal(new URL(page.url()).pathname,'/');
 await page.route('**/api/pdf',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'简历已更新，请刷新页面后再导出'})}));await more.click();await menu.getByRole('menuitem',{name:'导出 PDF'}).click();await page.getByRole('status').getByText('简历已更新，请刷新页面后再导出',{exact:true}).waitFor();await page.unroute('**/api/pdf');
 await productCard().getByRole('link',{name:'编辑：'+b.title,exact:true}).click();await page.getByLabel('姓名',{exact:true}).waitFor();assert.equal(await page.getByLabel('姓名',{exact:true}).inputValue(),'林序');await page.goto(server.url);await page.locator('.resume-cover[data-preview="ready"]').nth(2).waitFor();
 // Regression: enough room for three cards must not leave the third on a new row.
 for(const width of [320,390,600,768,900,1003,1280,1440,1920]){
  await page.setViewportSize({width,height:960});
  for(const collapsed of [true,false]){
   if((await page.locator('#toggle-sidebar').getAttribute('aria-expanded')==='false')!==collapsed)await page.locator('#toggle-sidebar').click();
   await page.waitForFunction(()=>[...document.querySelectorAll('.resume-cover')].every(cover=>{const paper=cover.querySelector('.resume-thumbnail');if(!paper)return false;const c=cover.getBoundingClientRect(),p=paper.getBoundingClientRect();return p.width>0&&Math.abs(p.width-c.width)<1&&Math.abs(p.height-c.height)<1;}));
   const geometry=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const content=document.querySelector('#library-content'),grid=document.querySelector('.library-grid'),main=document.querySelector('main');
    return {overflow:document.documentElement.scrollWidth>innerWidth||content.scrollWidth>content.clientWidth,main:rect(main),grid:rect(grid),cards:[...document.querySelectorAll('.resume-tile')].map(rect),covers:[...document.querySelectorAll('.resume-cover')].map(rect),controls:[...document.querySelectorAll('#library-actions input,#library-actions button')].map(rect),papers:[...document.querySelectorAll('.resume-thumbnail')].map(rect),frames:[...document.querySelectorAll('.resume-thumbnail iframe')].map(rect)};
   });
   assert.equal(geometry.overflow,false,`horizontal overflow at ${width}/${collapsed}`);
   assert.ok(geometry.cards.every(c=>c.width<=350&&c.height<=370),`oversized cards at ${width}/${collapsed}`);
   assert.ok(geometry.controls.every(c=>c.left>=geometry.main.left&&c.right<=geometry.main.right+1),`toolbar clipped at ${width}/${collapsed}`);
   await page.locator('.tile-more').last().focus();await page.keyboard.press('Enter');const menuBounds=await menu.boundingBox();assert.ok(menuBounds.x>=0&&menuBounds.x+menuBounds.width<=width+1&&menuBounds.y>=0&&menuBounds.y+menuBounds.height<=960);await page.keyboard.press('Escape');
   assert.ok(geometry.frames.every(f=>Math.abs(f.width/f.height-210/297)<.005),'page proportions must stay intact');
   assert.ok(geometry.papers.every((p,i)=>{const f=geometry.frames[i],c=geometry.covers[i];return Math.abs(p.width-c.width)<1&&Math.abs(p.top-c.top)<1&&Math.abs(f.top-p.top)<1&&Math.abs(f.width-p.width)<1&&p.height/f.height>.5&&p.height/f.height<.6;}),`preview should fill the card width and crop the first page near halfway at ${width}/${collapsed}: ${JSON.stringify({covers:geometry.covers,papers:geometry.papers,frames:geometry.frames})}`);
   assert.ok(geometry.covers.every((c,i)=>Math.abs(c.width-(geometry.cards[i].width-2))<1),'cover should span the card');
   if(width===1003){assert.ok(geometry.cards.every(c=>Math.abs(c.top-geometry.cards[0].top)<1),'three cards should fit in one row');await page.screenshot({path:path.join(proof,`library-split-${collapsed?'collapsed':'expanded'}.png`)});}
  }
 }
 await page.setViewportSize({width:1440,height:960});
 if(await page.locator('#toggle-sidebar').getAttribute('aria-expanded')==='false')await page.locator('#toggle-sidebar').click();
 // A filtered single result stays compact rather than stretching across the page.
 await page.getByRole('searchbox',{name:'搜索简历'}).fill('通用版');assert.equal(await page.locator('.resume-tile').count(),1);
 assert.ok(await page.locator('.resume-tile').first().evaluate(e=>e.getBoundingClientRect().width)<=320);
 await page.getByRole('searchbox',{name:'搜索简历'}).fill('');await page.locator('.resume-cover[data-preview="ready"]').nth(2).waitFor();
 await page.getByRole('link',{name:'打开 AI 产品经理 · 通用版',exact:true}).click();
 await page.locator('#open-gallery').click();await page.locator('[data-gallery-choice="blue-tab"]').click();await page.locator('#apply-template').click();await page.locator('#template-gallery').waitFor({state:'hidden'});assert.equal(await page.locator('body').getAttribute('data-theme'),'blue-tab');
 assert.equal(JSON.parse(await readFile(path.join(workspace,'career.json'),'utf8')).presentation.resume_themes[r.id],'blue-tab');
 // Save failures must remain visible and must not silently apply a temporary choice.
 await page.route('**/api/library/theme',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'样式保存失败，请重试'})}));
 await page.locator('#open-gallery').click();await page.locator('[data-preview-template="compact"]').click();await page.locator('#apply-preview').click();await page.getByText('样式保存失败，请重试',{exact:true}).waitFor();assert.equal(await page.locator('body').getAttribute('data-theme'),'blue-tab');assert.equal(await page.locator('#template-gallery').isVisible(),true);await page.locator('#close-preview').click();await page.locator('#cancel-gallery').click();await page.unroute('**/api/library/theme');
 await page.getByRole('link',{name:'返回简历列表',exact:true}).click();const card=page.locator('.resume-tile').filter({has:page.getByRole('link',{name:'打开 AI 产品经理 · 通用版',exact:true})});await card.locator('.resume-cover[data-preview="ready"]').waitFor();assert.ok(await card.frameLocator('iframe').locator('[data-template="blue-tab"]').count()>0);assert.equal(await card.locator('.tile-theme').innerText(),(await(await page.request.get(server.url+'/api/library/session')).json()).themes.find(t=>t.id==='blue-tab').name);
 await page.getByRole('link',{name:'打开 AI 产品经理 · 通用版',exact:true}).click();assert.equal(await page.locator('body').getAttribute('data-theme'),'blue-tab');await page.reload();assert.equal(await page.locator('body').getAttribute('data-theme'),'blue-tab');await page.getByRole('link',{name:'编辑内容',exact:true}).click();await page.getByLabel('介绍你的经验与优势').fill('网页修改会同步到所有平台。');await page.getByRole('button',{name:'保存修改'}).click();await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent==='已保存');assert.equal((await resumes.readResume(workspace,r.id)).package.content.summary,'网页修改会同步到所有平台。');

 // A user may keep typing while the previous save response is in flight.
 await page.route('**/api/library/save',async route=>{await new Promise(resolve=>setTimeout(resolve,450));await route.continue();});
 await page.getByLabel('介绍你的经验与优势').fill('正在保存的内容');await page.getByRole('button',{name:'保存修改'}).click();await page.getByLabel('介绍你的经验与优势').fill('保存过程中继续编辑');await page.waitForFunction(()=>!document.querySelector('#save-package')?.disabled);assert.equal(await page.locator('#save-state').innerText(),'有未保存的修改');assert.equal((await resumes.readResume(workspace,r.id)).package.content.summary,'正在保存的内容');
 await page.unroute('**/api/library/save');await page.getByLabel('介绍你的经验与优势').fill('网页修改会同步到所有平台。');
 const photo=path.join(workspace,'test-photo.png');await writeFile(photo,await page.screenshot({clip:{x:0,y:0,width:90,height:120}}));await page.locator('#photo-input').setInputFiles(photo);await page.getByText('已添加照片',{exact:true}).waitFor();await page.getByRole('button',{name:'保存修改'}).click();await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent==='已保存');assert.ok((await resumes.readResume(workspace,r.id)).package.content.profile.photo.sha256);
 await page.screenshot({path:path.join(proof,'editor.png'),fullPage:true});
 await page.getByRole('link',{name:'查看简历',exact:true}).click();await page.locator('[data-view="boss"]').click();await page.locator('#view-boss').getByText('网页修改会同步到所有平台。',{exact:true}).waitFor();

 for(const platform of ['zhaopin','liepin','job51']){await page.locator('[data-view="'+platform+'"]').click();await page.locator('#view-'+platform).getByText('网页修改会同步到所有平台。',{exact:true}).waitFor();}
 await page.locator('[data-view="resume"]').click();await page.locator('#resume-preview[data-pagination="ready"]').waitFor();assert.equal(await page.frameLocator('#resume-preview iframe').locator('.resume-photo').evaluate(i=>i.complete&&i.naturalWidth>0),true);
 const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'导出 PDF',exact:true}).click();const pdf=path.join(proof,'canonical.pdf');await(await pdfEvent).saveAs(pdf);assert.ok((await PDFDocument.load(await readFile(pdf))).getPageCount()>0);
 const htmlEvent=page.waitForEvent('download');await page.getByRole('button',{name:'导出 HTML',exact:true}).click();const offline=path.join(proof,'canonical.html');await(await htmlEvent).saveAs(offline);await page.goto(pathToFileURL(offline).href);await page.locator('#resume-preview[data-pagination="ready"]').waitFor();assert.equal(await page.locator('.live-resume-actions').count(),0);assert.equal(await page.frameLocator('#resume-preview iframe').locator('.resume-photo').evaluate(i=>i.complete&&i.naturalWidth>0),true);await page.goto(server.url+'/resumes/'+r.id+'/index.html');
 // Another Agent saves. An idle preview follows the canonical package automatically.
 let latest=await resumes.readResume(workspace,r.id);latest.package.content.summary='Agent 保存后的新版本';await resumes.savePackage(workspace,latest.package,latest.sha256);await page.waitForTimeout(6000);await page.locator('[data-view="boss"]').click();await page.locator('#view-boss').getByText('Agent 保存后的新版本',{exact:true}).waitFor();
 await page.getByRole('link',{name:'编辑内容',exact:true}).click();await page.getByLabel('介绍你的经验与优势').fill('用户未保存的修改');latest=await resumes.readResume(workspace,r.id);latest.package.content.summary='另一个 Agent 又更新了';await resumes.savePackage(workspace,latest.package,latest.sha256);await page.locator('#download-draft').waitFor();assert.equal(await page.getByLabel('介绍你的经验与优势').inputValue(),'用户未保存的修改');await page.getByRole('button',{name:'保存修改'}).click();assert.equal((await resumes.readResume(workspace,r.id)).package.content.summary,'另一个 Agent 又更新了');
 page.on('dialog',dialog=>dialog.accept());await page.goto(server.url+'/board?opportunity='+o.id);await page.locator('#opportunity-drawer[open]').waitFor();await page.locator('#tab-resume').click();await page.locator('#record-submission').waitFor();await page.screenshot({path:path.join(proof,'job-resume.png')});
 await page.locator('#choose-resume').click();await page.locator('.resume-choice-row').filter({hasText:'精简版'}).click();await page.locator('#resume-choice-apply').click();await page.locator('.chosen-resume').filter({hasText:'精简版'}).waitFor();assert.notEqual((await jobs.show(workspace,o.id)).card.meta.resume.id,r.id);
 await page.locator('#record-submission').click();await page.locator('#submission-channel').fill('官网');await page.locator('#submission-confirm').check();await page.getByRole('button',{name:'保存投递记录',exact:true}).click();await page.locator('.submission-row').waitFor();assert.equal((await jobs.show(workspace,o.id)).card.meta.submissions.length,1);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(proof,'job-mobile.png')});await page.goto(server.url);await page.locator('.resume-tile').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(proof,'library-mobile.png'),fullPage:true});
 // Legacy editing creates a separate canonical copy; unavailable thumbnails must not invent a page count.
 const legacyFile=path.join(workspace,'legacy-input.json');await writeFile(legacyFile,await readFile(new URL('../examples/presentation/package.json',import.meta.url)));const legacy=await savePresentation(legacyFile,workspace),legacyBefore=await readFile(legacy.file,'utf8');
 const legacyThumbnail=new RegExp('/api/library/thumbnail\\?id='+legacy.id+'&');
 await page.route(legacyThumbnail,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html data-pagination="error"><script>parent.postMessage({type:"career-pagination",state:"error"},location.origin)</script></html>'}));
 await page.goto(server.url);await page.locator('#resume-search').fill('AI 应用开发 · 通用版');const legacyCard=page.locator('.resume-tile').filter({has:page.locator(`[data-more="${legacy.id}"]`)});await legacyCard.locator('.resume-cover[data-preview="error"]').waitFor();assert.equal(await legacyCard.locator('.tile-page-count').innerText(),'');assert.equal(await legacyCard.getByText('暂时无法预览，点击查看').isVisible(),true);await page.unroute(legacyThumbnail);
 await page.reload();await page.locator('#resume-search').fill('AI 应用开发 · 通用版');await legacyCard.locator('.resume-cover[data-preview="ready"]').waitFor();await legacyCard.hover();await legacyCard.getByRole('button',{name:/创建可编辑副本/}).click();await page.getByRole('heading',{name:'创建可编辑副本'}).waitFor();await page.locator('#resume-name').fill('旧简历的编辑副本');await page.getByRole('button',{name:'创建',exact:true}).click();await page.getByLabel('姓名',{exact:true}).waitFor();const copiedId=new URL(page.url()).pathname.split('/')[2];assert.notEqual(copiedId,legacy.id);assert.equal((await resumes.readResume(workspace,copiedId)).package.derived_from.id,legacy.id);assert.equal(await readFile(legacy.file,'utf8'),legacyBefore);
 assert.deepEqual(errors,[]);console.log('PASS: card metadata and actual page counts, keyboard menu, direct editing, card PDF and conflict handling, legacy copy protection, responsive library across 9 widths and both sidebar states, persistent per-resume styles, failed style save handling, editor writeback, all-platform refresh, photo upload, PDF and offline HTML, in-flight edits, conflict preservation, associations, submissions and mobile; screenshots '+proof);
}catch(e){console.error(await page.locator('body').innerText());await page.screenshot({path:path.join(proof,'failure.png')});throw e;}finally{await browser.close();await server.close();await rm(workspace,{recursive:true,force:true});}
