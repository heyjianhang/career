import {chromium} from 'playwright';
import {mkdtemp,realpath,rm,mkdir,readFile,rename,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setup} from '../dist/workspace/setup.js';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
import {createResume} from '../dist/resumes/store.js';
const base=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-settings-ui-')),workspace=path.join(base,'第一份资料');
await setup(workspace,false);const resume=await createResume(workspace,'合成测试简历');
const built=await buildCollection(workspace),server=await startPreview(built.directory,workspace,0,true,{registryFile:path.join(base,'settings.json')});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url(),await r.text().catch(()=>''));});const proof=path.resolve('.cache/workspace-review');await mkdir(proof,{recursive:true});
const modal=page.locator('#workspace-settings');
async function settings(){await page.locator('#open-settings').click();await modal.locator('#create-workspace').waitFor();}
async function chooseFolder(directory){await modal.locator('#folder-path').fill(directory);await modal.getByRole('button',{name:'前往',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#folder-select').disabled);}
try{
 await page.goto(server.url+'/board');await page.locator('#toggle-sidebar').waitFor();
 assert.equal(await page.locator('#toggle-sidebar').getAttribute('aria-expanded'),'false');
 await page.mouse.move(800,400);assert.equal(await page.locator('.brand-compact').isVisible(),true);
 await page.locator('#toggle-sidebar').hover();await page.locator('.sidebar-toggle .expand-icon').waitFor();assert.equal(await page.locator('.sidebar-toggle .brand-compact').isVisible(),false);
 await page.locator('#toggle-sidebar').click();assert.equal(await page.locator('#toggle-sidebar').getAttribute('aria-expanded'),'true');
 const heading=await page.locator('.sidebar-heading').boundingBox(),toggle=await page.locator('#toggle-sidebar').boundingBox(),bottom=await page.locator('#open-settings').boundingBox();assert.ok(toggle.y>=heading.y&&toggle.y+toggle.height<=heading.y+heading.height+1);assert.ok(bottom.y>800);
 await page.locator('#toggle-sidebar').click();await page.reload();assert.equal(await page.locator('#toggle-sidebar').getAttribute('aria-expanded'),'false');
 // Navigation geometry and right-hand labels stay identical across every page.
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:960});let expected;
  for(const route of ['/board','/','/profile']){
   await page.goto(server.url+route);if(await page.locator('#toggle-sidebar').getAttribute('aria-expanded')==='true')await page.locator('#toggle-sidebar').click();
   const geometry=await page.locator('.app-nav-item').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();const svg=e.querySelector('svg').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,iconX:svg.x,iconY:svg.y,iconW:svg.width,iconH:svg.height};}));
   expected??=geometry;assert.deepEqual(geometry,expected,'sidebar moved on '+route+' at '+width);
   for(const g of geometry){assert.equal(g.w,44);assert.equal(g.h,44);assert.equal(g.iconW,20);assert.equal(g.iconH,20);}
   const nav=page.getByRole('link',{name:'求职看板',exact:true});await nav.hover();await nav.locator('.shell-tooltip').waitFor();const tip=await nav.locator('.shell-tooltip').boundingBox(),navBox=await nav.boundingBox();assert.ok(tip.x>=navBox.x+navBox.width+10);
   await page.locator('#toggle-sidebar').click();assert.equal(await nav.locator('.shell-tooltip').isVisible(),false);
   if(width===768&&route==='/profile')await page.screenshot({path:path.join(proof,'sidebar-expanded.png')});
   await page.locator('#toggle-sidebar').click();await nav.hover();if(width===768&&route==='/profile')await page.screenshot({path:path.join(proof,'sidebar-tooltip.png')});
  }
 }
 await page.setViewportSize({width:1440,height:960});await page.goto(server.url+'/board');
 await settings();await page.screenshot({path:path.join(proof,'settings.png')});
 await modal.getByRole('button',{name:'改名',exact:true}).click();await modal.locator('#workspace-name').fill('2026 求职');await modal.getByRole('button',{name:'保存名称',exact:true}).click();await modal.getByText('2026 求职',{exact:true}).waitFor();assert.equal(JSON.parse(await readFile(path.join(workspace,'career.json'))).name,'2026 求职');
 await modal.locator('#create-workspace').click();await modal.locator('#workspace-name').fill('第二份资料');await modal.locator('#choose-parent').click();await chooseFolder(base);await modal.locator('#folder-select').click();
 await modal.getByRole('button',{name:'创建并打开',exact:true}).click();await page.waitForURL(u=>u.origin!==server.url&&u.pathname==='/board');const secondOrigin=new URL(page.url()).origin;
 await settings();await modal.getByText('第二份资料',{exact:true}).waitFor();await modal.getByRole('button',{name:/2026 求职.*切换/}).click();await page.waitForURL(server.url+'/board');
 // Guard the editor before either creating another folder or switching to a known one.
 await page.goto(server.url+'/resumes/'+resume.id+'/edit');await page.getByLabel('姓名',{exact:true}).fill('需要保存的姓名');
 await settings();await modal.getByRole('button',{name:/第二份资料.*切换/}).click();await modal.getByText(/简历有未保存的修改/).waitFor();assert.equal(new URL(page.url()).origin,server.url);
 await modal.locator('#create-workspace').click();await modal.locator('#workspace-name').fill('不应创建');await modal.getByRole('button',{name:'创建并打开',exact:true}).click();await modal.getByText(/简历有未保存的修改/).waitFor();await assert.rejects(access(path.join(base,'不应创建')));
 await modal.locator('#settings-close').click();assert.equal(await page.getByLabel('姓名',{exact:true}).inputValue(),'需要保存的姓名');await page.locator('#save-package').click();await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='已保存');
 await settings();await modal.getByRole('button',{name:/第二份资料.*切换/}).click();await page.waitForURL(secondOrigin+'/board');
 // Existing non-workspace folders are not converted or overwritten by Open.
 await settings();await modal.locator('#open-workspace').click();await chooseFolder(base);await modal.locator('#folder-select').click();await modal.locator('#settings-error:not([hidden])').waitFor();assert.equal(new URL(page.url()).origin,secondOrigin);
 await chooseFolder(workspace);await modal.locator('#folder-select').click();await page.waitForURL(server.url+'/board');
 // Moved folders remain visible and can be explicitly relocated.
 await rename(path.join(base,'第二份资料'),path.join(base,'搬家后的资料'));
 await settings();await modal.getByRole('button',{name:/第二份资料.*重新定位/}).click();await chooseFolder(path.join(base,'搬家后的资料'));await modal.locator('#folder-select').click();await page.waitForURL(u=>u.origin!==server.url&&u.origin!==secondOrigin);
 await settings();await modal.getByText('第二份资料',{exact:true}).waitFor();assert.equal(await modal.locator('.workspace-row').count(),1);
 for(const width of [320,390,584,768,1440]){
  await page.setViewportSize({width,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'document overflow '+width);
  assert.ok(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'dialog overflow '+width);
  assert.ok(await modal.locator('.settings-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'body overflow '+width);
  if(width===390)await page.screenshot({path:path.join(proof,'mobile.png')});
 }
 await modal.getByRole('button',{name:'外观',exact:true}).click();await modal.locator('#settings-sidebar').check();await modal.locator('#settings-close').click();
 await page.locator('#toggle-sidebar').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#toggle-sidebar').getAttribute('aria-expanded'),'true');
 await settings();await page.keyboard.press('Escape');assert.equal(await modal.isVisible(),false);assert.equal(await page.locator('#open-settings').evaluate(e=>document.activeElement===e),true);
 assert.deepEqual(errors,[]);console.log('Workspace settings checks passed: sidebar, named creation, folder picker, rename, switching, dirty guard, relocation, keyboard and 320–1440px.');
}catch(e){console.log(await modal.innerText().catch(()=>''));await page.screenshot({path:path.join(proof,'failed.png')});throw e;}finally{await browser.close();await server.close();await rm(base,{recursive:true,force:true});}
