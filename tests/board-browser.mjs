import {chromium} from 'playwright';
import {mkdtemp,readFile,writeFile,mkdir,rm,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {prepareBoardDemo} from '../scripts/prepare-board-demo.mjs';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
import * as board from '../dist/opportunities/store.js';
import {setup} from '../dist/workspace/setup.js';
const base=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-board-browser-')),workspace=path.join(base,'workspace');
const out=path.resolve(process.argv[2]??'.cache/board-review');await mkdir(out,{recursive:true});
const fixture=await prepareBoardDemo(workspace),id=fixture.selected;
const collection=await buildCollection(workspace),preview=await startPreview(collection.directory,workspace),browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 // A new workspace already looks like a board, with no synthetic jobs added by viewing it.
 const emptyWorkspace=path.join(base,'empty-workspace');await setup(emptyWorkspace,false);
 const emptyCollection=await buildCollection(emptyWorkspace),emptyPreview=await startPreview(emptyCollection.directory,emptyWorkspace);
 try{
  await page.goto(emptyPreview.url+'/board');await page.locator('.kanban-column').nth(5).waitFor();
  const stages=(await(await page.request.get(emptyPreview.url+'/api/board/session')).json()).stages;
  assert.deepEqual(await page.locator('.column-heading h2').allTextContents(),Object.values(stages));
  assert.deepEqual(await page.locator('.column-count').allTextContents(),Array(6).fill('0'));
  assert.equal(await page.locator('.job-card,.board-empty').count(),0);
  assert.deepEqual(await page.locator('.column-empty').allTextContents(),Array(6).fill('暂无岗位'));
  assert.equal(await page.locator('#empty-board-action').count(),0);
  // Every column has an accessible creation entry and passes its own stage to the Agent.
  assert.equal(await page.locator('.column-heading [data-add-stage]').count(),6);
  for(const [stage,label] of Object.entries(stages)){
   const button=page.getByRole('button',{name:`在「${label}」中新建岗位`,exact:true});await button.focus();await page.keyboard.press('Enter');
   await page.locator('#jd-agent').click();await page.getByRole('heading',{name:'添加岗位',exact:true}).waitFor();const prompt=await page.locator('#action-text').inputValue();
   assert.ok(prompt.includes(`stage: ${stage}`));assert.ok((await page.locator('#action-description').innerText()).includes(label));
   if(stage==='ended')assert.ok(prompt.includes('确认结束结果')&&prompt.includes('不要猜测'));
   await page.locator('#action-confirm').click();await page.locator('#action-dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),prompt);
  }
  await page.locator('#add-opportunity').click();await page.locator('#jd-agent').click();assert.ok((await page.locator('#action-text').inputValue()).includes('stage: inbox'));await page.locator('#action-cancel').click();
  await page.locator('#kanban').evaluate(e=>e.scrollLeft=0);
  assert.equal((await board.overview(emptyWorkspace)).total,0);
  for(const viewportWidth of [390,960,1440]){
   await page.setViewportSize({width:viewportWidth,height:900});
   assert.equal(await page.locator('.kanban-column').count(),6);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(viewportWidth!==960)await page.screenshot({path:path.join(out,`board-empty-${viewportWidth}.png`)});
  }
  await page.locator('#board-search').fill('不存在的岗位');await page.getByRole('heading',{name:'没有符合条件的岗位'}).waitFor();await page.locator('#empty-board-action').click();await page.locator('.kanban-column').nth(5).waitFor();
  const first=await board.add(emptyWorkspace,{company:'新机会（虚构）',title:'产品经理',body:'# 旧岗位概况\n\n待确认团队与下一步。'});await page.locator('#refresh-board').click();await page.locator(`[data-stage="inbox"] [data-opportunity="${first.id}"]`).waitFor();
  assert.equal(await page.locator('.kanban-column').count(),6);assert.equal(await page.locator('.column-heading [data-add-stage]').count(),6);assert.equal(await page.locator('[data-drop-stage="inbox"] .column-count').innerText(),'1');assert.equal(await page.locator('#empty-board-action').count(),0);
  // Legacy notes stay available, but never masquerade as the missing JD.
  await page.locator(`[data-opportunity="${first.id}"]`).click();await page.getByRole('heading',{name:'尚未保存职位描述'}).waitFor();
  assert.equal(await page.locator('#document-view').innerText().then(t=>t.includes('待确认团队')),false);
  await page.locator('#create-document').click();await page.waitForFunction(async()=>(await navigator.clipboard.readText()).includes('不要把旧概况'));
  await page.locator('#tab-files').click();await page.locator('[data-file="card.md"]').click();await page.locator('.markdown-body').filter({hasText:'待确认团队'}).waitFor();
  await page.locator('#tab-match').click();await page.locator('#update-match').click();await page.waitForFunction(async()=>(await navigator.clipboard.readText()).includes('若未关联'));
  assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes('career-match'));
  await page.locator('#tab-company').click();await page.locator('#create-document').click();await page.waitForFunction(async()=>(await navigator.clipboard.readText()).includes('企查查未配置'));
  await page.locator('#close-drawer').click();
 }finally{await emptyPreview.close();}
 await page.setViewportSize({width:1440,height:1000});
 const card=()=>page.locator(`[data-opportunity="${id}"]`),drawer=page.locator('#opportunity-drawer');
 const open=async()=>{await card().click();await page.locator('#job-title').filter({hasText:'AI 产品经理'}).waitFor();};
 const width=()=>drawer.evaluate(e=>Math.round(e.getBoundingClientRect().width));
 await page.goto(preview.url+'/board');await card().waitFor();await page.evaluate(()=>document.fonts.ready);
 // Filters use in-page menus, preserve keyboard navigation and combine with search.
 const toolRows=await page.locator('.board-tools > *').evaluateAll(items=>items.map(e=>Math.round(e.getBoundingClientRect().top)));assert.ok(Math.max(...toolRows)-Math.min(...toolRows)<5,'desktop toolbar stays on one row');
 await page.locator('#filter-toggle').click();
 assert.equal(await page.locator('#board-filters select').count(),0);
 await page.locator('#board-search').focus();
 assert.equal(await page.locator('#board-search').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 assert.equal(await page.locator('.search-box').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
 await page.locator('#source-filter').click();await page.getByRole('option',{name:'BOSS 直聘',exact:true}).click();
 assert.equal(await page.locator('.job-card').count(),2);
 await page.locator('#rating-filter').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 assert.equal(await page.locator('#rating-filter-value').innerText(),'五星');
 assert.equal(await page.locator('.job-card').count(),0);assert.equal(await page.locator('#filter-count').innerText(),'2');
 await page.locator('#rating-filter').click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 assert.equal(await page.locator('.job-card').count(),2);
 await page.locator('#board-search').fill('云启');assert.equal(await page.locator('.job-card').count(),1);
 await page.locator('#clear-filters').click();assert.equal(await page.locator('.job-card').count(),9);
 assert.equal(await page.locator('#source-filter-value').innerText(),'全部来源');assert.equal(await page.locator('#rating-filter-value').innerText(),'全部星级');
 await page.locator('#rating-filter').click();await page.keyboard.press('End');await page.keyboard.press('Escape');
 assert.equal(await page.locator('#rating-filter').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('#rating-filter-menu').isVisible(),false);
 await page.locator('#source-filter').click();await page.locator('#rating-filter').click();assert.equal(await page.locator('#source-filter-menu').isVisible(),false);
 await page.screenshot({path:path.join(out,'board-filters-desktop.png')});
 await page.keyboard.press('Tab');assert.equal(await page.locator('#archive-filter').evaluate(e=>e===document.activeElement),true);
 await page.locator('#rating-filter').click();await page.getByRole('heading',{name:'求职看板',exact:true}).click();assert.equal(await page.locator('#rating-filter-menu').isVisible(),false);
 for(const viewportWidth of [320,390,600,768,1024,1440]){
  await page.setViewportSize({width:viewportWidth,height:844});await page.locator('#source-filter').click();
  const bounds=await page.locator('#source-filter-menu').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewportWidth+1&&bounds.y+bounds.height<=844,`menu fits ${viewportWidth}`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`page fits ${viewportWidth}`);
  assert.equal(await page.locator('.board-header').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,`header fits ${viewportWidth}`);
  if(viewportWidth===390)await page.screenshot({path:path.join(out,'board-filters-mobile.png')});
  await page.keyboard.press('Escape');
 }
 await page.locator('#source-filter').click();await page.locator('#filter-toggle').click();
 assert.equal(await page.locator('#source-filter-menu').isVisible(),false);await page.locator('#filter-toggle').click();assert.equal(await page.locator('#source-filter-menu').isVisible(),false);await page.locator('#filter-toggle').click();
 await page.setViewportSize({width:1440,height:1000});
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
 const failedTile=await card().elementHandle();
 await page.route('**/api/board/stage?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'测试保存失败'})}));
 await card().dragTo(target('applied'));await page.locator('#toast').filter({hasText:'测试保存失败'}).waitFor();await page.waitForFunction(el=>!el.isConnected,failedTile);await inStage('preparing').waitFor();assert.equal((await board.show(workspace,id)).card.meta.stage,'preparing');await page.unroute('**/api/board/stage?**');
 // Concurrent Agent changes win over the stale digest captured at drag start.
 await page.route('**/api/board/stage?**',async route=>{const latest=await board.show(workspace,id);await board.update(workspace,id,{body:latest.card.body+'\n\nAgent 刚补充的事实。'},latest.card.sha256);await route.continue();},{times:1});
 const conflict=page.waitForResponse(r=>r.url().includes('/api/board/stage?')&&r.status()===409);
 await card().dragTo(target('applied'));await conflict;await page.locator('#toast').filter({hasText:'未移动卡片'}).waitFor();await inStage('preparing').waitFor();record=await board.show(workspace,id);assert.match(record.card.body,/Agent 刚补充的事实/);assert.equal(record.card.meta.stage,'preparing');
 await page.unroute('**/api/board/stage?**');
 await page.reload();await inStage('preparing').waitFor();await page.screenshot({path:path.join(out,'board-draggable.png')});
 if(originalStage!=='preparing'){await card().dragTo(target(originalStage));await inStage(originalStage).waitFor();}
 await page.setViewportSize({width:1440,height:1000});await open();
 await page.locator('.markdown-body').filter({hasText:'工作职责'}).waitFor();
 assert.deepEqual(await page.locator('#job-tabs [role=tab]').allTextContents(),['职位描述','公司分析','岗位匹配','面试','资料','简历','打招呼']);
 assert.equal(await page.locator('.markdown-body').innerText().then(t=>t.includes('当前进展')),false);
 await page.locator('#mode-source').click();await page.locator('.source-code').waitFor();
 assert.equal(await page.locator('.source-code').textContent(),await readFile(path.join(workspace,'opportunities',id,'job.md'),'utf8'));
 await page.locator('#tab-overview').focus();await page.keyboard.press('End');assert.equal(await page.locator('#tab-outreach').getAttribute('aria-selected'),'true');
 await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#tab-resume').getAttribute('aria-selected'),'true');
 await page.keyboard.press('Home');await page.locator('.markdown-body').filter({hasText:'工作职责'}).waitFor();
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
 await page.locator('[data-round-action="simulation"]').click();
 let prompt='';for(let attempt=0;attempt<100;attempt++){prompt=await page.evaluate(()=>navigator.clipboard.readText());if(prompt.includes(id)&&prompt.includes('不改变真实面试')&&prompt.includes('simulations/'))break;await page.waitForTimeout(100);}
 assert.ok(prompt.includes(id)&&prompt.includes('不改变真实面试')&&prompt.includes('simulations/'));
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
 console.log(JSON.stringify({ok:true,screenshots:out,checks:['empty six-column board and first-card transition','stage-aware creation buttons and clipboard','custom filters, keyboard, search focus, combined filtering and responsive header','equal-height cards and drag-to-stage persistence','drag edge scrolling and cancellation','ended result selection','drag conflict and failed save preservation','shared document controls and source/preview/outline','two-level interviews','optional preparation and repeated mocks','new/edit round','Agent handoff','slow response navigation','stage/outcome/archive','keyboard menu','persistent resize','mobile','PDF/image preview','no browser errors']}));
} finally {await browser.close();await preview.close();await rm(base,{recursive:true,force:true});}
