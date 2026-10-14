import {chromium} from 'playwright';
import {mkdtemp,mkdir,rm,realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {setup} from '../dist/workspace/setup.js';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
const base=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-company-ui-')),workspace=path.join(base,'synthetic');
await setup(workspace,false);
const built=await buildCollection(workspace),server=await startPreview(built.directory,workspace,0,true,{registryFile:path.join(base,'settings.json')});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1180,height:850}}),errors=[];
const proof=path.resolve('.cache/company-review');await mkdir(proof,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 let configured=false;
 const state=()=>({configured,secure_storage_available:true});
 window.careerDesktop={
  companyStatus:async()=>state(),
  companySave:async key=>{await new Promise(r=>setTimeout(r,120));if(key==='bad-synthetic-key')throw new Error('企查查认证失败，请在设置中更新 API Key。');configured=true;return {...state(),check:{missing_tools:[]}};},
  companyCheck:async()=>({connected:true,missing_tools:[]}),
  companyRemove:async()=>{configured=false;return state();}
 };
});
const modal=page.locator('#workspace-settings');
try{
 await page.goto(server.url+'/board');await page.locator('#open-settings').click();await modal.locator('#create-workspace').waitFor();
 await modal.getByRole('button',{name:'外部服务',exact:true}).click();await modal.locator('#company-key').waitFor();
 assert.equal(await modal.locator('#company-key').getAttribute('type'),'password');
 await modal.locator('#company-key').fill('synthetic-first-key');await modal.getByRole('button',{name:'保存并测试'}).click();
 await modal.getByText('连接成功，可以让 Agent 查询公司信息。',{exact:true}).waitFor();assert.equal(await modal.locator('#company-key').inputValue(),'');
 assert.equal(await modal.getByText('已配置',{exact:true}).count(),1);
 await modal.locator('#company-key').fill('bad-synthetic-key');await modal.getByRole('button',{name:'保存并测试'}).click();await modal.locator('#settings-error:not([hidden])').waitFor();
 assert.equal(await modal.getByText('已配置',{exact:true}).count(),1);assert.equal(await modal.locator('#company-key').inputValue(),'');
 await modal.getByRole('button',{name:'测试连接',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#settings-error').hidden);
 for(const width of [320,390,720,1180]){
  await page.setViewportSize({width,height:850});
  assert.ok(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'modal overflow '+width);
  assert.ok(await modal.locator('.settings-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'body overflow '+width);
  await page.screenshot({path:path.join(proof,`settings-${width}.png`)});
 }
 await modal.getByRole('button',{name:'外观',exact:true}).click();await modal.getByRole('button',{name:'外部服务',exact:true}).click();await modal.getByText('已配置',{exact:true}).waitFor();
 await modal.getByRole('button',{name:'移除连接',exact:true}).click();await modal.getByText('已移除本机连接。',{exact:true}).waitFor();assert.equal(await modal.getByText('未连接',{exact:true}).count(),1);
 await page.keyboard.press('Escape');assert.equal(await modal.isVisible(),false);
 // A normal browser never receives a credential-saving form or asks for npm installation.
 const browserOnly=await browser.newPage();await browserOnly.goto(server.url+'/board');await browserOnly.locator('#open-settings').click();await browserOnly.locator('#create-workspace').waitFor();await browserOnly.getByRole('button',{name:'外部服务',exact:true}).click();await browserOnly.getByText(/QCC_API_KEY/).waitFor();assert.equal(await browserOnly.locator('#company-key').count(),0);await browserOnly.close();
 assert.deepEqual(errors,[]);console.log('QCC settings: save, replace failure, check, remove, navigation, password clearing, browser fallback and 320–1180px passed.');
}finally{await browser.close();await server.close();await rm(base,{recursive:true,force:true});}
