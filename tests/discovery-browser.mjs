import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setup} from '../dist/workspace/setup.js';
import {prepareDiscoveryDemo} from '../scripts/prepare-discovery-demo.mjs';
import {buildCollection} from '../dist/presentation/collection.js';
import {startPreview} from '../dist/presentation/server.js';

const f=await prepareDiscoveryDemo(),empty=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-discovery-empty-'));
await setup(empty,false);
const build=await buildCollection(f.workspace),blank=await buildCollection(empty);
const server=await startPreview(build.directory,f.workspace,0,true),emptyServer=await startPreview(blank.directory,empty,0,true);
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const out=path.resolve('.cache/discovery-review');await mkdir(out,{recursive:true});
try{
 await page.goto(emptyServer.url+'/board');
 await page.getByRole('link',{name:'发现公司',exact:true}).click();
 await page.getByRole('heading',{name:'发现与你相关的公司',exact:true}).waitFor();
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('Test fallback');};});
 await page.getByRole('button',{name:'让 Agent 发现公司',exact:true}).click();
 const prompt=await page.getByRole('textbox',{name:'待复制内容'}).inputValue();
 assert.ok(prompt.includes('career-discovery')&&prompt.includes('career-board')&&prompt.includes('research/companies/'));
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.screenshot({path:path.join(out,'empty.png')});

 await page.goto(server.url+'/board');await page.getByRole('link',{name:'发现公司',exact:true}).click();
 await page.getByRole('heading',{name:'本轮发现',exact:true}).waitFor();
 assert.equal(await page.locator('#material-title').textContent(),'目标公司池');
 await page.screenshot({path:path.join(out,'companies-desktop.png')});
 await page.getByRole('link',{name:'景川工业软件',exact:true}).click();
 await page.getByRole('heading',{name:'为什么值得了解',exact:true}).waitFor();
 await page.getByRole('link',{name:'原始材料与主体范围',exact:true}).click();
 assert.equal(await page.locator('#material-title').textContent(),'景川的合成来源材料');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'下载资料',exact:true}).click();
 assert.equal((await downloadPromise).suggestedFilename(),'source-jingchuan.md');
 await page.locator('[data-group="companies"]').click();await page.getByRole('link',{name:'景川工业软件',exact:true}).click();
 await page.getByRole('link',{name:'打开已收录岗位',exact:true}).click();
 await page.locator('#opportunity-drawer[open]').waitFor();
 assert.equal(await page.locator('#job-title').textContent(),'客户成功顾问（合成岗位）');
 assert.match(await page.locator('#document-view').innerText(),/全部内容为虚构演示/);
 await page.locator('#close-drawer').click();await page.getByRole('link',{name:'发现公司',exact:true}).click();
 await page.getByRole('link',{name:'远舟会展',exact:true}).click();
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('Test fallback');};});
 await page.getByRole('button',{name:'让 Agent 更新',exact:true}).click();
 assert.ok((await page.getByRole('textbox',{name:'待复制内容'}).inputValue()).includes('company-yuanzhou.md'));
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 const file=path.join(f.workspace,'research/companies/companies/company-yuanzhou.md'),before=await readFile(file,'utf8');
 await writeFile(file,before+'\n\n## 新增核实\n保留原用户笔记，继续确认杭州团队。');
 await page.getByRole('heading',{name:'新增核实',exact:true}).waitFor({timeout:10000});
 assert.ok((await page.locator('#material-body').innerText()).includes('先核对出差频率'));
 await page.reload();await page.getByRole('heading',{name:'新增核实',exact:true}).waitFor();
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await page.goto(server.url+'/board');await page.getByRole('link',{name:'发现公司',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'board overflow '+width);
  await page.getByRole('link',{name:'发现公司',exact:true}).click();await page.getByRole('heading',{name:'本轮发现',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'companies overflow '+width);
  await page.getByRole('link',{name:'查看研究范围与筛选依据',exact:true}).click();await page.getByRole('heading',{name:'范围与取舍',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'report overflow '+width);
  if(width===390)await page.screenshot({path:path.join(out,'companies-mobile.png')});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,viewports:[320,390,768,1024,1440],output:out}));
}finally{await browser.close();await server.close();await emptyServer.close();await rm(f.workspace,{recursive:true,force:true});await rm(empty,{recursive:true,force:true});}
