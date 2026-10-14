import {chromium} from 'playwright';
import {mkdtemp,realpath,rm,mkdir,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setup,updateConfig} from '../dist/workspace/setup.js';
import {initHistory,saveHistory} from '../dist/workspace/git.js';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
const base=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-sync-ui-')),workspace=path.join(base,'资料');
await setup(workspace,false);await initHistory(workspace,'Fixture','fixture@example.invalid');await updateConfig(workspace,c=>{c.sync={repository:'fixture/private',mode:'ask'};});await saveHistory(workspace,'initial');
const built=await buildCollection(workspace),server=await startPreview(built.directory,workspace,0,false,{registryFile:path.join(base,'registry.json')});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1240,height:850}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));const proof=path.resolve('.cache/sync-review');await mkdir(proof,{recursive:true});
// No personal GitHub account or real remote is touched by UI tests.
await page.route('**/api/sync/environment',route=>route.fulfill({json:{git:null,gh:null,authenticated:false,git_url:'https://git-scm.com/install/mac',gh_url:'https://cli.github.com/',message:'安装 Git 后即可启用同步；本机资料仍可照常使用。'}}));
try{
 await page.goto(server.url+'/board');await page.getByRole('button',{name:'云同步',exact:true}).click();const modal=page.locator('#workspace-settings');await modal.locator('#sync-automatic').waitFor();
 await modal.getByRole('link',{name:'安装 Git ↗',exact:true}).waitFor();assert.equal(await modal.getByRole('button',{name:'重新检测',exact:true}).isVisible(),true);
 assert.equal(await modal.locator('#sync-automatic').isChecked(),false);await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/sync/preferences')&&r.status()===200),modal.locator('#sync-automatic').check()]);
 assert.equal(JSON.parse(await readFile(path.join(workspace,'.local/sync.json'))).preferences.automatic,true);
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/sync/preferences')&&r.status()===200),modal.locator('#sync-interval').selectOption('10')]);
 assert.equal(JSON.parse(await readFile(path.join(workspace,'.local/sync.json'))).preferences.interval_minutes,10);
 await page.screenshot({path:path.join(proof,'cloud-sync.png')});
 await modal.locator('#settings-close').click();await page.reload();await page.getByRole('button',{name:'云同步',exact:true}).click();await modal.locator('#sync-automatic').waitFor();assert.equal(await modal.locator('#sync-automatic').isChecked(),true);
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/sync/preferences')&&r.status()===200),modal.locator('#sync-automatic').uncheck()]);
 await modal.getByRole('button',{name:'工作区',exact:true}).click();await modal.getByRole('button',{name:'从仓库恢复',exact:true}).click();await modal.locator('#restore-repository').fill('https://github.com/fixture/private');await modal.locator('#workspace-name').fill('新设备');
 await modal.locator('#choose-parent').click();await modal.locator('#folder-select').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('folder-select').disabled);await modal.locator('#folder-select').click();assert.equal(await modal.locator('#restore-repository').inputValue(),'https://github.com/fixture/private');
 await page.screenshot({path:path.join(proof,'restore.png')});
 for(const width of [320,390,768,1240]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert.ok(await modal.locator('.settings-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 await modal.getByRole('button',{name:'云同步',exact:true}).click();await modal.locator('#sync-run').waitFor();await page.screenshot({path:path.join(proof,'cloud-sync-narrow.png')});
 const session=await(await fetch(server.url+'/api/workspaces/session')).json();
 const post=(token,origin=server.url)=>fetch(server.url+'/api/sync/preferences',{method:'POST',headers:{Origin:origin,'X-Career-Token':token,'Content-Type':'application/json'},body:JSON.stringify({automatic:true})});
 assert.equal((await post('bad')).status,403);assert.equal((await post(session.token,'https://untrusted.invalid')).status,403);assert.equal(JSON.parse(await readFile(path.join(workspace,'.local/sync.json'))).preferences.automatic,false);
 assert.deepEqual(errors,[]);console.log('Sync UI passed: real preference persistence, restore form, missing dependency guidance, CSRF, 320–1240px.');
}finally{await browser.close();await server.close();await rm(base,{recursive:true,force:true});}
