import {chromium} from 'playwright';
import {mkdtemp,realpath,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setup} from '../dist/workspace/setup.js';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';
import {prepareProfileDemo} from '../scripts/prepare-profile-demo.mjs';
const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-profile-ui-')),workspace=path.join(dir,'workspace');
await setup(workspace,false);await prepareProfileDemo(workspace);
const research='research/jd/demo';await mkdir(path.join(workspace,research,'sources'),{recursive:true});
await writeFile(path.join(workspace,research,'report.md'),'# 岗位研究报告\n\n## 研究结论\n合成测试材料。\n\n[岗位原文](sources/jd-001.md)\n\n[补足行动](plan.md)');
await writeFile(path.join(workspace,research,'sources/jd-001.md'),'# 样本 JD\n\n## 工作内容\n负责客户服务。');
await writeFile(path.join(workspace,research,'plan.md'),'# 补足计划\n\n## 当前行动\n先核对本人贡献。');
const output=await buildCollection(workspace),server=await startPreview(output.directory,workspace,0,true),browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const proof=path.resolve('.cache/profile-review');await mkdir(proof,{recursive:true});
try{
 await page.goto(server.url+'/profile');await page.getByText('linxu@example.com',{exact:true}).waitFor();
 assert.deepEqual(await page.locator('.app-nav-item .nav-label').allTextContents(),['求职看板','简历','我的资料']);
 await page.getByRole('button',{name:'求职偏好',exact:true}).click();await page.getByRole('heading',{name:'希望寻找的机会',exact:true}).waitFor();
 await page.getByRole('button',{name:'目录',exact:true}).click();await page.locator('#material-outline').getByRole('link',{name:'看重什么',exact:true}).click();await page.getByRole('button',{name:'原文',exact:true}).click();assert.match(await page.locator('.source-code').innerText(),/^# 求职偏好/);await page.getByRole('button',{name:'预览',exact:true}).click();
 await page.getByRole('button',{name:'项目经历 2',exact:true}).click();await page.locator('.material-list').getByRole('button',{name:/企业知识助手/}).click();await page.getByRole('heading',{name:'我的职责',exact:true}).waitFor();assert.equal(await page.locator('.material-fields').getByText('检索链路与应用开发',{exact:true}).count(),1);await page.screenshot({path:path.join(proof,'projects.png')});
 await page.getByRole('link',{name:'项目说明 PDF',exact:true}).click();await page.locator('canvas').waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.width>0);await page.getByRole('button',{name:'下一页',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pdf-page')?.textContent==='2 / 2');
 await page.getByRole('button',{name:'项目经历 2',exact:true}).click();await page.locator('.material-list').getByRole('button',{name:/企业知识助手/}).click();await page.getByRole('link',{name:'界面参考',exact:true}).click();await page.locator('.material-media img').waitFor();await page.waitForFunction(()=>document.querySelector('.material-media img')?.naturalWidth>0);await page.getByRole('button',{name:'放大图片',exact:true}).click();assert.equal(await page.locator('#image-scale').textContent(),'125%');
 await page.getByRole('button',{name:'全部资料',exact:true}).click();await page.locator('#all-files > details').filter({has:page.getByText('resume',{exact:true})}).getByText('sources',{exact:true}).click();await page.locator('#all-files').getByText('source-demo-profile',{exact:true}).click();await page.locator('#all-files').getByRole('button',{name:'项目说明.pdf',exact:true}).click();await page.locator('canvas').waitFor();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'下载资料',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'项目说明.pdf');
 await page.getByRole('button',{name:'资料分类',exact:true}).click();await page.getByRole('button',{name:'资格证书',exact:true}).click();await page.getByRole('heading',{name:'还没有资格证书',exact:true}).waitFor();
 await page.getByRole('button',{name:'求职偏好',exact:true}).click();await page.getByRole('heading',{name:'希望寻找的机会',exact:true}).waitFor();
 await writeFile(path.join(workspace,'context/goals.md'),'# 求职偏好\n\n## 更新后的偏好\nAgent 新补充：优先杭州。');await page.getByRole('heading',{name:'更新后的偏好',exact:true}).waitFor({timeout:10000});
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('Clipboard disabled for fallback test');};});await page.getByRole('button',{name:'让 Agent 更新',exact:true}).click();await page.locator('#copy-fallback').waitFor();assert.match(await page.getByRole('textbox',{name:'待复制内容'}).inputValue(),/context\/goals.md/);await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'岗位调研 3',exact:true}).click();await page.locator('.material-list').getByRole('button',{name:/岗位研究报告/}).click();await page.getByRole('heading',{name:'研究结论',exact:true}).waitFor();
 await page.getByRole('link',{name:'岗位原文',exact:true}).click();await page.getByRole('heading',{name:'工作内容',exact:true}).waitFor();
 await page.getByRole('button',{name:'让 Agent 更新',exact:true}).click();const researchPrompt=await page.getByRole('textbox',{name:'待复制内容'}).inputValue();assert.match(researchPrompt,/jd-research/);assert.ok(researchPrompt.includes(research+'/sources/jd-001.md'));await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'岗位调研 3',exact:true}).click();await page.locator('.material-list').getByRole('button',{name:/岗位研究报告/}).click();await page.getByRole('link',{name:'补足行动',exact:true}).click();await page.getByRole('heading',{name:'当前行动',exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'当前行动',exact:true}).waitFor();await page.screenshot({path:path.join(proof,'research.png')});
 // In-flight document loads cannot overwrite a newer selection.
 await page.route('**/api/profile/file?path=resume%2Ffacts%2Fprofile.md',async route=>{await new Promise(r=>setTimeout(r,450));await route.continue();});await page.getByRole('button',{name:'基本资料',exact:true}).click();await page.getByRole('button',{name:'资格证书',exact:true}).click();await page.waitForTimeout(650);assert.equal(await page.locator('#material-title').textContent(),'资格证书');assert.ok(await page.getByRole('heading',{name:'还没有资格证书',exact:true}).isVisible());await page.unroute('**/api/profile/file?path=resume%2Ffacts%2Fprofile.md');
 for(const width of [320,390,600,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  if(width<=760)await page.getByRole('button',{name:'打开资料目录',exact:true}).click();
  await page.getByRole('button',{name:'工作经历 1',exact:true}).click();await page.getByRole('heading',{name:'工作职责',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow '+width);
  assert.ok(await page.locator('.material-toolbar').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'toolbar overflow '+width);
  if(width<=760)await page.getByRole('button',{name:'打开资料目录',exact:true}).click();
  await page.getByRole('button',{name:'岗位调研 3',exact:true}).click();await page.locator('.material-list').getByRole('button',{name:/岗位研究报告/}).click();await page.getByRole('heading',{name:'研究结论',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'research overflow '+width);
  if(width===390){await page.screenshot({path:path.join(proof,'mobile.png')});await page.getByRole('button',{name:'打开资料目录',exact:true}).click();await page.screenshot({path:path.join(proof,'mobile-directory.png')});await page.locator('#close-materials-nav').click();}
 }
 await page.setViewportSize({width:1440,height:960});await page.getByRole('button',{name:'求职偏好',exact:true}).click();await page.getByRole('heading',{name:'更新后的偏好',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'更新后的偏好',exact:true}).waitFor();
 await page.getByRole('link',{name:'求职看板',exact:true}).click();await page.getByRole('heading',{name:'求职看板',exact:true}).waitFor();await page.getByRole('link',{name:'我的资料',exact:true}).click();await page.getByText('linxu@example.com',{exact:true}).waitFor();await page.getByRole('link',{name:'简历',exact:true}).click();await page.getByRole('heading',{name:'我的简历',exact:true}).waitFor();assert.deepEqual(errors,[]);console.log('Profile browser checks passed: documents, source fields, links, PDF, image, download, refresh, races, empty states, navigation and 320–1440px.');
}finally{await browser.close();await server.close();await rm(dir,{recursive:true,force:true});}
