import {chromium} from 'playwright';
import {mkdtemp,readFile,writeFile,mkdir,rm,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {prepareBoardDemo} from '../scripts/prepare-board-demo.mjs';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
import * as board from '../dist/opportunities/store.js';
const base=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-board-browser-')),workspace=path.join(base,'workspace');
const out=path.resolve(process.argv[2]??'.cache/board-review');await mkdir(out,{recursive:true});
const fixture=await prepareBoardDemo(workspace),id=fixture.selected;
const collection=await buildCollection(workspace),preview=await startPreview(collection.directory,workspace),browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 const card=()=>page.locator(`[data-opportunity="${id}"]`),drawer=page.locator('#opportunity-drawer');
 const open=async()=>{await card().click();await page.locator('#job-title').filter({hasText:'AI 产品经理'}).waitFor();};
 const width=()=>drawer.evaluate(e=>Math.round(e.getBoundingClientRect().width));
 await page.goto(preview.url+'/board');await card().waitFor();await page.evaluate(()=>document.fonts.ready);
 // Real pointer dragging changes the persisted stage, never the content or archive flag.
 const inStage=stage=>page.locator(`.column-cards[data-stage="${stage}"] [data-opportunity="${id}"]`);
 const target=stage=>page.locator(`.kanban-column[data-drop-stage="${stage}"] .column-heading`);
 const initial=await board.show(workspace,id),originalStage=initial.card.meta.stage;
 let stagePosts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/board/stage?'))stagePosts++;});
 const heights=await page.locator('.job-card').evaluateAll(cards=>cards.map(c=>Math.round(c.getBoundingClientRect().height)));
 assert.equal(new Set(heights).size,1,'cards share one height');
 const moved=page.waitForResponse(r=>r.url().includes('/api/board/stage?')&&r.request().method()==='POST');
 await card().dragTo(target('applied'));assert.equal((await moved).status(),200);await inStage('applied').waitFor();
 assert.equal(await drawer.isVisible(),false,'drag does not open the card');
 let record=await board.show(workspace,id);assert.equal(record.card.meta.stage,'applied');assert.equal(record.card.body,initial.card.body);assert.equal(record.card.meta.archived,false);
 await page.reload();await inStage('applied').waitFor();
 const same=stagePosts;await card().dragTo(target('applied'));assert.equal(stagePosts,same,'same-column drop does not write');
 // Scroll the board edge during a drag to reach columns outside the viewport.
 const start=await card().boundingBox(),area=await page.locator('#kanban').boundingBox();
 await page.mouse.move(start.x+60,start.y+30);await page.mouse.down();await page.mouse.move(start.x+72,start.y+35,{steps:5});
 await page.mouse.move(area.x+area.width-10,area.y+90,{steps:16});
 await page.waitForFunction(()=>document.querySelector('#kanban').scrollLeft>300);
 await page.keyboard.press('Escape');await page.mouse.up();assert.equal(stagePosts,same);assert.equal(await page.locator('.dragging,.drop-target').count(),0);
 // Put all six columns in view for repeated drag/result and error checks.
 await page.setViewportSize({width:2100,height:1000});
 await card().dragTo(target('ended'));await page.locator('#move-result-dialog').waitFor();
 assert.equal((await board.show(workspace,id)).card.meta.stage,'applied');
 assert.equal(await page.locator('#move-result-dialog select').count(),0);assert.equal(await page.getByRole('button',{name:'移到已结束',exact:true}).isDisabled(),true);
 await page.setViewportSize({width:390,height:844});await page.locator('#move-result').click();assert.equal(await page.locator('#move-result-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await page.screenshot({path:path.join(out,'move-result-mobile.png')});await page.setViewportSize({width:2100,height:1000});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#move-result-dialog').isVisible(),true);const cancelled=page.waitForResponse(r=>r.url().endsWith('/api/board/overview'));await page.keyboard.press('Escape');await cancelled;await inStage('applied').waitFor();assert.equal((await board.show(workspace,id)).card.meta.stage,'applied');
 await card().dragTo(target('ended'));await page.locator('#move-result-dialog').waitFor();await page.locator('#move-result').click();await page.getByRole('option',{name:'主动放弃',exact:true}).click();await page.getByRole('button',{name:'移到已结束',exact:true}).click();
 await inStage('ended').waitFor();record=await board.show(workspace,id);assert.equal(record.card.meta.outcome,'withdrawn');assert.equal(record.card.meta.archived,false);
 await card().dragTo(target('preparing'));await inStage('preparing').waitFor();assert.equal((await board.show(workspace,id)).card.meta.outcome,null);
 // A network rejection must leave the card in its saved column.
 await page.route('**/api/board/stage?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'测试保存失败'})}));
 await card().dragTo(target('applied'));await page.locator('#toast').filter({hasText:'测试保存失败'}).waitFor();await inStage('preparing').waitFor();assert.equal((await board.show(workspace,id)).card.meta.stage,'preparing');await page.unroute('**/api/board/stage?**');
 // Concurrent Agent changes win over the stale digest captured at drag start.
 await page.route('**/api/board/stage?**',async route=>{const latest=await board.show(workspace,id);await board.update(workspace,id,{body:latest.card.body+'\n\nAgent 刚补充的事实。'},latest.card.sha256);await route.continue();},{times:1});
 const conflict=page.waitForResponse(r=>r.url().includes('/api/board/stage?')&&r.status()===409);
 await card().dragTo(target('applied'));await conflict;await page.locator('#toast').filter({hasText:'未移动卡片'}).waitFor();await inStage('preparing').waitFor();record=await board.show(workspace,id);assert.match(record.card.body,/Agent 刚补充的事实/);assert.equal(record.card.meta.stage,'preparing');
 await page.unroute('**/api/board/stage?**');
 await page.reload();await inStage('preparing').waitFor();await page.screenshot({path:path.join(out,'board-draggable.png')});
 if(originalStage!=='preparing'){await card().dragTo(target(originalStage));await inStage(originalStage).waitFor();}
 await page.setViewportSize({width:1440,height:1000});await open();
 assert.equal(await page.locator('.kanban-column').count(),6);assert.equal(await page.getByRole('heading',{name:'沟通中',exact:true}).count(),0);
 await page.locator('#tab-company').click();await page.locator('.markdown-body').filter({hasText:'业务与产品'}).waitFor();
 assert.equal(await page.locator('#file-tree').isVisible(),false);
 // Document controls share the active navigation row and remain usable after tab changes.
 const checkReader=async()=>{
  await page.locator('#mode-source').click();await page.locator('.source-code').waitFor();
  assert.equal(await page.locator('#mode-source').evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('#toggle-outline').isDisabled(),true);
  await page.locator('#mode-preview').click();await page.locator('.markdown-body').waitFor();
  const wasOpen=await page.locator('#toggle-outline').getAttribute('aria-expanded');
  await page.locator('#toggle-outline').click();assert.equal(await page.locator('#toggle-outline').getAttribute('aria-expanded'),String(wasOpen!=='true'));
  await page.locator('#toggle-outline').click();
  assert.equal(await page.locator('#document-view .filename,#document-view .document-toolbar').count(),0);
 };
 await checkReader();assert.equal(await page.locator('.drawer-navigation #mode-preview').count(),1);
 const downloaded=page.waitForEvent('download');await page.locator('#document-actions [download]').click();
 assert.match(await readFile(await (await downloaded).path(),'utf8'),/业务与产品/);
 await page.locator('#copy-job').click();await page.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('opportunity context'));
 await page.screenshot({path:path.join(out,'document-toolbar.png')});
 // The left edge stores a desktop preference; full screen and mobile do not overwrite it.
 const handle=await page.locator('#drawer-resize').boundingBox(),before=await width();
 const widthSaved=page.waitForResponse(r=>r.url().endsWith('/api/board/preferences')&&r.request().method()==='POST');
 await page.mouse.move(handle.x+5,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x-155,handle.y+handle.height/2,{steps:12});await page.mouse.up();
 const after=await width();assert.ok(after>before+140);await widthSaved;
 const saved=JSON.parse(await readFile(path.join(workspace,'.local/ui-preferences.json'),'utf8')).board.drawer_width;assert.ok(Math.abs(saved-after)<=2);
 await page.locator('#expand-drawer').click();assert.ok(await width()>after);await page.keyboard.press('Escape');assert.equal(await width(),after);assert.equal(await drawer.isVisible(),true);
 await page.reload();await open();assert.equal(await width(),after);
 // A styled menu supports keyboard navigation; an ended result is distinct from archive.
 await page.locator('#job-stage').click();assert.equal(await page.locator('#stage-menu [aria-checked="true"]').evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('End');await page.keyboard.press('Enter');await page.locator('[data-outcome="rejected"]').waitFor();await page.keyboard.press('Escape');assert.equal(await drawer.isVisible(),true);
 await page.locator('#job-stage').click();await page.locator('#stage-menu [data-stage="ended"]').click();await page.locator('[data-outcome="withdrawn"]').click();await page.locator('#stage-value').filter({hasText:'主动放弃'}).waitFor();
 await page.locator('#archive-job').click();await page.locator('#archive-job').filter({hasText:'移回看板'}).waitFor();await page.locator('#close-drawer').click();assert.equal(await card().count(),0);
 await page.locator('#filter-toggle').click();await page.locator('#archive-filter').check();await open();assert.match(await page.locator('#stage-value').innerText(),/主动放弃/);
 await page.locator('#archive-job').click();await page.locator('#archive-job').filter({hasText:'归档'}).waitFor();await page.locator('#close-drawer').click();await page.locator('#archive-filter').uncheck();await open();
 await page.locator('#job-stage').click();await page.locator('#stage-menu [data-stage="interviewing"]').click();await page.locator('#stage-value').filter({hasText:'面试中'}).waitFor();assert.equal((await board.show(workspace,id)).card.meta.outcome,null);
 // Interview landing is a list. Each round owns a distinct record and optional documents.
 await page.locator('#tab-interviews').click();await page.locator('.interview-row').first().waitFor();assert.equal(await page.locator('.interview-row').count(),2);assert.equal(await page.locator('#interview-navigation').isVisible(),false);
 await page.screenshot({path:path.join(out,'interview-list.png')});
 await page.getByRole('button',{name:/技术一面.*已完成/}).click();await page.locator('.markdown-body').filter({hasText:'这轮聊了什么'}).waitFor();
 await checkReader();assert.equal(await page.locator('.interview-controls #mode-preview').count(),1);assert.equal(await page.locator('.interview-controls #copy-job').count(),1);
 await page.locator('[data-round-doc="preparation"]').click();await page.locator('.markdown-body').filter({hasText:'本轮准备'}).waitFor();
 await page.locator('[data-round-doc="simulation"]').click();await page.locator('#mock-picker').waitFor();assert.equal(await page.locator('#mock-picker option').count(),2);
 await page.locator('#mock-picker').selectOption({index:1});await page.locator('.markdown-body').filter({hasText:'模拟 2'}).waitFor();
 await page.locator('[data-round-doc="record"]').click();await page.locator('.markdown-body').filter({hasText:'这轮聊了什么'}).waitFor();await page.screenshot({path:path.join(out,'interview-detail.png')});
 await page.locator('[data-round-action="simulation"]').click();await page.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('interview context'));
 const prompt=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(prompt.includes(id)&&prompt.includes('不改变真实面试')&&prompt.includes('simulations/'));
 await page.keyboard.press('Escape');await page.locator('.interview-row').first().waitFor();assert.equal(await drawer.isVisible(),true);
 await page.getByRole('button',{name:/业务二面.*待进行/}).click();await page.getByRole('heading',{name:'这轮还没有面试记录'}).waitFor();
 await page.locator('#mode-source').click();await page.locator('.source-code').filter({hasText:'career-interview/v1'}).waitFor();await page.locator('#mode-preview').click();await page.getByRole('heading',{name:'这轮还没有面试记录'}).waitFor();
 await page.locator('[data-round-doc="preparation"]').click();await page.getByRole('heading',{name:'尚未整理本轮准备材料'}).waitFor();
 assert.equal(await page.locator('#document-actions a[download]').count(),0);
 await page.locator('#edit-round').click();await page.locator('#round-title').fill('业务二面 · 产品负责人');await page.locator('#interview-form [type=submit]').click();await page.locator('.interview-heading h3').filter({hasText:'产品负责人'}).waitFor();
 const updated=(await board.show(workspace,id)).interviews.find(r=>r.meta.title.includes('产品负责人'));assert.equal(updated.meta.scheduled_at,'2026-10-16T15:00:00+08:00');assert.equal(updated.body,'');
 await page.locator('#back-rounds').click();await page.locator('#add-round').click();await page.locator('#round-title').fill('HR 面');await page.locator('#round-date').fill('2026-10-20');await page.locator('#interview-form [type=submit]').click();await page.locator('.interview-heading h3').filter({hasText:'HR 面'}).waitFor();await page.locator('#back-rounds').click();assert.equal(await page.locator('.interview-row').count(),3);
 // A file update from another Agent is visible after refresh without editing the outline.
 const first=(await board.show(workspace,id)).interviews.find(r=>r.meta.title==='技术一面');
 await board.saveInterview(workspace,id,{id:first.meta.id,title:first.meta.title,body:first.body+'\n\n自定义的补记，没有规定的章节。'},first.sha256);
 await page.getByRole('button',{name:/技术一面.*已完成/}).click();await page.locator('.markdown-body').filter({hasText:'自定义的补记'}).waitFor();
 // Back during a slow read must keep the list, not let the late response replace it.
 await page.route('**/api/board/file?**',async route=>{await new Promise(r=>setTimeout(r,350));await route.continue();});
 await page.locator('[data-round-doc="preparation"]').click();await page.locator('#back-rounds').click();await page.waitForTimeout(500);assert.equal(await page.locator('.interview-row').count(),3);await page.unroute('**/api/board/file?**');
 await page.locator('#tab-company').click();await page.locator('.markdown-body').filter({hasText:'业务与产品'}).waitFor();await checkReader();assert.equal(await page.locator('.drawer-navigation #copy-job').count(),1);
 await page.locator('#tab-files').click();await page.locator('[data-file="attachments/岗位说明.pdf"]').click();await page.waitForFunction(()=>document.querySelector('#pdf-page')?.textContent==='1 / 2');await page.locator('#pdf-next').click();await page.waitForFunction(()=>document.querySelector('#pdf-page')?.textContent==='2 / 2');
 await page.locator('[data-file="attachments/资料示例.jpg"]').click();await page.waitForFunction(()=>document.querySelector('#preview-image')?.naturalWidth>0);
 await page.setViewportSize({width:390,height:844});await page.locator('#tab-interviews').click();assert.ok(Math.abs(await width()-390)<=2);assert.equal(JSON.parse(await readFile(path.join(workspace,'.local/ui-preferences.json'),'utf8')).board.drawer_width,saved);
 assert.equal(await drawer.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await page.screenshot({path:path.join(out,'interview-mobile.png')});
 await page.getByRole('button',{name:/技术一面.*已完成/}).click();await page.locator('.markdown-body').filter({hasText:'这轮聊了什么'}).waitFor();assert.ok((await page.locator('.reader-scroll').boundingBox()).height>180);assert.equal(await page.locator('.document-toc').isVisible(),false);await page.locator('#toggle-outline').click();assert.equal(await page.locator('.document-toc').isVisible(),true);await page.locator('#toggle-outline').click();assert.equal(await drawer.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await page.screenshot({path:path.join(out,'interview-mobile-detail.png')});
 await page.setViewportSize({width:1440,height:1000});assert.equal(await width(),after);
 assert.deepEqual(errors,[]);assert.equal((await board.overview(workspace)).issues.length,0);
 console.log(JSON.stringify({ok:true,screenshots:out,checks:['equal-height cards and drag-to-stage persistence','drag edge scrolling and cancellation','ended result selection','drag conflict and failed save preservation','shared document controls and source/preview/outline','two-level interviews','optional preparation and repeated mocks','new/edit round','Agent handoff','slow response navigation','stage/outcome/archive','keyboard menu','persistent resize','mobile','PDF/image preview','no browser errors']}));
} finally {await browser.close();await preview.close();await rm(base,{recursive:true,force:true});}
