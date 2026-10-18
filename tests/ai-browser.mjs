import {installAIBridge} from './fixtures/ai-bridge.mjs';
import {chromium} from 'playwright';
import {mkdtemp,mkdir,rm,realpath,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setup} from '../dist/workspace/setup.js';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
const base=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-ai-ui-')),workspace=path.join(base,'synthetic');await setup(workspace,false);
const built=await buildCollection(workspace),server=await startPreview(built.directory,workspace,0,true,{registryFile:path.join(base,'settings.json')});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];const proof=path.resolve('.cache/ai-review');await mkdir(proof,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(installAIBridge);
try{
 await page.goto(server.url+'/board');await page.locator('#add-opportunity').click();await page.locator('#jd-text').fill('远山科技（合成）\nAI 应用工程师\n杭州 · 20–30K\n开发企业 Agent，熟悉 MCP 和 RAG。');
 await page.locator('#jd-models').click();
 await page.locator('.model-use').first().waitFor();assert.equal(await page.locator('.model-use').count(),3);assert.equal(await page.locator('.model-service-card').count(),4);
 await page.locator('[data-service="bailian"]').click();await page.locator('[name="key"]').fill('synthetic-key');
 await page.getByRole('button',{name:'保存配置',exact:true}).click();await page.getByText('连接配置已保存。',{exact:true}).waitFor();assert.equal(await page.locator('[name="key"]').inputValue(),'');
 await page.locator('[data-model="qwen3.8-max"][data-assign="text"]').click();await page.getByText('默认模型已保存。',{exact:true}).waitFor();
 await page.locator('#model-provider-add').click();await page.locator('#model-preset-trigger').click();await page.getByRole('option',{name:'Qwen VL Plus · qwen-vl-plus',exact:false}).click();await page.getByRole('button',{name:'添加模型',exact:true}).last().click();await page.getByText('模型已添加，可设为默认或测试连接。',{exact:true}).waitFor();
 await page.locator('[data-model="qwen-vl-plus"][data-assign="vision"]').click();await page.getByText('默认模型已保存。',{exact:true}).waitFor();
 await page.screenshot({path:path.join(proof,'provider-1280.png')});
 await page.locator('#model-provider-add').click();await page.locator('#model-id').fill('synthetic-custom-text');await page.getByRole('button',{name:'添加模型',exact:true}).last().click();await page.getByText('模型已添加，可设为默认或测试连接。',{exact:true}).waitFor();
 await page.locator('#model-provider-add').click();await page.locator('#model-id').fill('synthetic-custom-text');await page.getByRole('button',{name:'添加模型',exact:true}).last().click();await page.getByText('这个模型已添加。',{exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('.model-provider-dialog[open]').count(),1);
 await page.locator('#model-provider-add').click();await page.screenshot({path:path.join(proof,'add-model-1280.png')});await page.keyboard.press('Escape');
 for(const width of [320,390,720,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.locator('.model-provider-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'provider overflow '+width);await page.screenshot({path:path.join(proof,`provider-${width}.png`)});}
 await page.locator('#model-provider-close').click();
 // Volcengine can be used for voice alone; Ark credentials never enable its voice models.
 await page.locator('[data-service="volcengine"]').click();
 assert.equal(await page.locator('#model-speech-key').count(),1);assert.equal(await page.locator('[data-assign="speech"]').count(),2);
 await page.locator('#model-speech-key').fill('synthetic-voice-key');await page.getByRole('button',{name:'保存配置',exact:true}).click();await page.getByText('连接配置已保存。',{exact:true}).waitFor();
 assert.equal(await page.locator('#model-speech-key').inputValue(),'');assert.equal(await page.locator('#model-key').inputValue(),'');
 assert.equal(await page.locator('[data-assign="text"]:enabled').count(),0);assert.equal(await page.locator('[data-assign="speech"]:enabled').count(),2);
 await page.locator('[data-model="volc.seedasr.sauc.concurrent"][data-assign="speech"]').click();await page.getByText('默认模型已保存。',{exact:true}).waitFor();
 for(const width of [320,390,720,1280]){await page.setViewportSize({width,height:900});await page.locator('.model-provider-dialog').evaluate(e=>e.scrollTop=0);assert.ok(await page.locator('.model-provider-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'voice provider overflow '+width);await page.screenshot({path:path.join(proof,`volc-voice-${width}.png`)});}
 await page.locator('[data-model="volc.seedasr.sauc.concurrent"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(proof,'volc-voice-models.png')});
 await page.locator('#model-key').fill('synthetic-ark-key');await page.getByRole('button',{name:'保存配置',exact:true}).click();await page.getByText('连接配置已保存。',{exact:true}).waitFor();assert.equal(await page.locator('[data-assign="text"]:enabled').count(),2);assert.equal(await page.locator('[data-assign="speech"]:enabled').count(),2);
 await page.locator('#model-provider-close').click();await page.locator('[data-service="deepseek"]').click();assert.equal(await page.locator('#model-speech-key').count(),0);assert.equal(await page.locator('[data-assign="speech"]').count(),0);await page.getByText('DeepSeek 用于文本与视觉；实时转写可搭配百炼或火山语音。',{exact:true}).waitFor();await page.locator('#model-provider-close').click();
 await page.screenshot({path:path.join(proof,'models-1280.png')});
 for(const width of [320,390,720,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.locator('.settings-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'settings overflow '+width);await page.locator('#model-default-text-trigger').click();const menu=page.locator('.career-select-menu:popover-open');assert.ok(!(await menu.textContent()).includes('asr'));const box=await menu.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=900,'menu fits '+width);await page.keyboard.press('Escape');assert.equal(await page.locator('#workspace-settings').getAttribute('open'),'');}
 // Every section shares one stable frame, including when loading or overflowing.
 const modal=page.locator('#workspace-settings');
 for(const width of [320,390,720,1280]){
  await page.setViewportSize({width,height:900});
  const geometry=()=>modal.evaluate(e=>[e,...e.querySelectorAll('.settings-header,.settings-layout,.settings-nav,.settings-body')].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
  const expected=await geometry();
  for(const section of ['workspace','sync','appearance','integrations','updates','models']){
   await modal.locator('[data-section="'+section+'"]').click();
   assert.deepEqual(await geometry(),expected,'settings frame changed on '+section+' at '+width);
   assert.ok(await modal.locator('.settings-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'section overflow '+section+' at '+width);
   if(width===1280)await page.screenshot({path:path.join(proof,'settings-'+section+'.png')});
  }
  await page.locator('#model-default-speech-trigger').waitFor();
 }
 await page.locator('#model-default-speech-trigger').click();assert.ok((await page.locator('.career-select-menu:popover-open').textContent()).includes('Qwen 实时语音识别'));assert.ok(!(await page.locator('.career-select-menu:popover-open').textContent()).includes('qwen-vl-plus'));assert.ok((await page.locator('.career-select-menu:popover-open').textContent()).includes('豆包流式语音识别 2.0'));await page.keyboard.press('Escape');
 await page.locator('#model-default-text-trigger').click();await page.getByRole('option',{name:'qwen-vl-plus',exact:false}).click();await page.getByText('默认模型已保存。',{exact:true}).waitFor();
 await page.locator('#settings-close').click();await page.getByText('本次使用：阿里云百炼 · qwen-vl-plus',{exact:true}).waitFor();assert.ok((await page.locator('#jd-text').inputValue()).includes('MCP'));
 // A disabled connection cannot silently remain the JD model.
 await page.locator('#jd-models').click();await page.locator('[data-service="bailian"]').click();
 await page.locator('[name="enabled"]').uncheck();await page.getByRole('button',{name:'保存配置',exact:true}).click();await page.getByText('连接配置已保存。',{exact:true}).waitFor();
 await page.locator('#model-provider-close').click();await page.locator('#settings-close').click();await page.getByText('尚未配置识别模型',{exact:true}).waitFor();await page.locator('#jd-recognize').click();await page.getByText('请先配置文字整理模型。',{exact:true}).waitFor();
 await page.locator('#jd-models').click();await page.locator('[data-service="bailian"]').click();await page.locator('[name="enabled"]').check();await page.getByRole('button',{name:'保存配置',exact:true}).click();await page.getByText('连接配置已保存。',{exact:true}).waitFor();await page.locator('#model-provider-close').click();await page.locator('#settings-close').click();await page.getByText('本次使用：阿里云百炼 · qwen-vl-plus',{exact:true}).waitFor();
 await page.screenshot({path:path.join(proof,'import-1280.png')});await page.locator('#jd-recognize').click();await page.locator('#jd-company').waitFor();await page.locator('#jd-stage-trigger').click();await page.getByRole('option',{name:'已结束',exact:true}).click();await page.locator('#jd-outcome-trigger').click();await page.keyboard.press('End');await page.keyboard.press('Enter');await page.locator('#jd-stage-trigger').click();await page.getByRole('option',{name:'待评估',exact:true}).click();await page.locator('#jd-salary').fill('22–32K');await page.locator('#jd-url').fill('https://example.com/synthetic-job');
 for(const width of [320,390,720,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.locator('#jd-import').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'import overflow '+width);await page.screenshot({path:path.join(proof,`review-${width}.png`)});}
 await page.locator('#jd-create').click();await page.locator('#opportunity-drawer[open]').waitFor();const cards=await(await fetch(server.url+'/api/board/overview')).json();assert.equal(cards.total,1);assert.equal(cards.cards[0].salary,'22–32K');assert.equal(cards.cards[0].user_rating,null);const op=cards.cards[0].id;assert.ok((await readFile(path.join(workspace,'opportunities',op,'attachments/source.txt'),'utf8')).includes('20–30K'));
 await page.locator('#close-drawer').click();await page.locator('#add-opportunity').click();await page.locator('#jd-text').fill('不同原文');await page.locator('#jd-manual').click();await page.locator('#jd-company').fill('合成公司');await page.locator('#jd-title').fill('合成岗位');await page.locator('#jd-url').fill('https://example.com/synthetic-job');await page.locator('#jd-create').click();await page.locator('#opportunity-drawer[open]').waitFor();assert.equal((await(await fetch(server.url+'/api/board/overview')).json()).total,1);
 await page.locator('#close-drawer').click();await page.locator('#add-opportunity').click();await page.locator('#jd-text').fill('取消测试');await page.locator('#jd-recognize').click();await page.locator('#jd-cancel').click();await page.waitForTimeout(250);assert.equal(await page.locator('#jd-company').count(),0);assert.equal(await page.locator('#jd-text').inputValue(),'取消测试');
 await page.locator('#jd-text').fill('');await page.locator('#jd-files').setInputFiles({name:'合成截图.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=','base64')});await page.locator('.jd-image').waitFor();await page.locator('#jd-recognize').click();await page.locator('#jd-company').waitFor();await page.locator('.jd-warnings').waitFor();await page.locator('#jd-create').click();await page.locator('#opportunity-drawer[open]').waitFor();assert.equal((await(await fetch(server.url+'/api/board/overview')).json()).total,2);
 // Both the UI and direct HTTP calls must stay bound to the active session.
 const rejected=await fetch(server.url+'/api/board/import',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(rejected.status,403);
 assert.deepEqual(errors,[]);console.log('AI UI: settings, defaults, secret clearing, text/image review, manual import, duplicate handling, cancellation, API origin protection, and 320–1280px passed.');
}finally{await browser.close();await server.close();await rm(base,{recursive:true,force:true});}
