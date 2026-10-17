import {chromium} from 'playwright';
import {mkdtemp,rm,mkdir,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {captureCurrentJob} from '../browser-extension/capture.js';
const root=path.resolve('.'),profile=await mkdtemp(path.join(os.tmpdir(),'career-clipper-'));
const out=path.join(root,'.cache/job-clipper-review');await mkdir(out,{recursive:true});
const extension=path.join(root,'build/browser-extension');
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]}).catch(async error=>{await rm(profile,{recursive:true,force:true});throw error;});
const text='负责企业知识助手研发，梳理真实业务需求。\n搭建检索、引用展示和反馈流程。\n\n任职要求：具备应用交付经验，熟悉 Python 和数据库；能够协作定位问题，说明自己的贡献和上线后的结果。';
const fixtures=[
 {name:'boss',url:'https://www.zhipin.com/job_detail/demo.html',title:'AI 应用工程师',html:`<div class="info-primary"><h1>AI 应用工程师</h1><span class="salary">20-30K·14薪</span><p><span class="brand-name">客户公司：远山科技（虚构）</span><a class="text-city">杭州</a><span class="text-experiece">3-5年</span><span class="text-degree">本科</span></p></div><section><h3>职位描述</h3><div class="job-sec-text">${text}</div></section><aside>推荐：其他职位 100K</aside>`},
 {name:'zhaopin',url:'https://www.zhaopin.com/jobs/?pageMode=search',title:'AI 产品经理',html:`<aside><a>无关的列表岗位</a></aside><div class="summary-planes__left"><h1 class="summary-planes__title">AI 产品经理</h1><span class="summary-planes__salary">2-3万</span><ul><li>杭州</li><li>3-5年</li><li>本科</li></ul></div><section class="describtion-card"><div class="seo-card__header"><div><h2>职位描述</h2></div></div><div>${text}</div></section><a class="company-info__name">远山科技（虚构）</a><a href="https://www.zhaopin.com/jobdetail/DEMO123.htm?srccode=test">查看更多职位信息</a>`},
 {name:'liepin',url:'https://www.liepin.com/job/1987654321.shtml',title:'项目经理',html:`<div class="job-apply-content"><div class="name-box"><span class="name"><span class="job-title">项目经理</span></span><span class="salary">25-40k</span></div><div class="job-properties"><span>杭州</span><span class="split"></span><span>5-10年</span><span class="split"></span><span>硕士</span><span>招1人</span><span>今日更新</span></div></div><main><dl class="paragraph"><dt>职位介绍</dt><dd>${text}</dd></dl><section><h2>公司简介</h2><p>为企业提供知识服务。</p></section></main><div class="company-card"><div class="name">远山科技（虚构）</div></div>`},
 {name:'job51',url:'https://jobs.51job.com/hangzhou/123456.html',title:'AI 开发工程师',html:`<div class="cn"><div class="jTitle"><h1>AI 开发工程师</h1><strong>2-3万·13薪</strong></div><p class="msg ltype"><span>杭州</span><span>3年及以上</span><span>本科</span><span>招1人</span></p></div><section class="job-detail"><h2>职位描述</h2><div class="tags">五险一金</div><div class="bmsg job_msg">${text}</div></section><a href="https://jobs.51job.com/all/coDEMO.html">远山科技（虚构）</a>`},
 {name:'website',url:'https://jobs.example.test/jd?id=123',title:'知识工程师',html:`<main><h1>知识工程师</h1><section><h2>岗位职责</h2><p>${text}</p></section><section><h2>任职要求</h2><p>具备独立需求分析能力。</p></section></main><aside>推荐岗位列表</aside>`}
];
const page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await context.route('**/*',async route=>{if(route.request().url().startsWith('chrome-extension://'))return route.continue();const fixture=fixtures.find(x=>x.url===route.request().url());if(fixture)return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><title>合成岗位</title></head><body>${fixture.html}</body></html>`});return route.abort();});
 const results=[];
 for(const f of fixtures){await page.goto(f.url);const capture=await page.evaluate(captureCurrentJob);assert.equal(capture.title,f.title,f.name);assert.equal(capture.platform,f.name,f.name);assert.ok(capture.description.includes('真实业务需求'),f.name);assert.ok(!capture.description.includes('其他职位'),f.name);if(f.name!=='website'){assert.equal(capture.company,'远山科技（虚构）',f.name);assert.equal(capture.location,'杭州',f.name);}if(f.name==='zhaopin')assert.match(capture.url,/\/jobdetail\/DEMO123/);results.push({platform:f.name,title:capture.title,body:!!capture.description});}
 await page.goto(fixtures[0].url);await page.locator('.salary').evaluate(e=>e.textContent='\ue032\ue036K');const garbled=await page.evaluate(captureCurrentJob);assert.equal(garbled.salary,'');assert.ok(garbled.warnings.some(x=>x.includes('特殊字体')));
 await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('.job-sec-text'));getSelection().removeAllRanges();getSelection().addRange(range);});const selected=await page.evaluate(captureCurrentJob);assert.equal(selected.method,'selection');
 await page.setContent('<main><h1>我的私信</h1><p>不应采集的私信</p></main>');assert.equal((await page.evaluate(captureCurrentJob)).description,'');
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
 await page.goto(`chrome-extension://${id}/popup.html?history=1`);await page.getByText('还没有采集记录。打开一个岗位，点击扩展开始收藏。').waitFor();
 // Exercise the built artifact's real background worker and persistent Chrome storage.
 const capture={...await (async()=>{const p=await context.newPage();await p.goto(fixtures[0].url);const value=await p.evaluate(captureCurrentJob);await p.close();return value;})()};
 const saved=await page.evaluate(async clip=>chrome.runtime.sendMessage({type:'save',clip}),capture);assert.equal(saved.ok,true);assert.ok(saved.data.saved);
 await page.reload();await page.getByRole('button',{name:'查看原文',exact:true}).click();assert.equal(await page.locator('[name=title]').inputValue(),'AI 应用工程师');
 await page.locator('[name=description]').fill('核对后的岗位原文。\n保留人工修订。');await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByText('已保存到采集记录。',{exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'查看原文',exact:true}).click();assert.match(await page.locator('[name=description]').inputValue(),/核对后的岗位原文/);await page.locator('#original-details summary').click();assert.match(await page.locator('#original').innerText(),/真实业务需求/);
 // Model clipboard success/failure without changing the user's system clipboard.
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.testClipboard=text;}}}));
 await page.getByRole('button',{name:'复制给 Agent',exact:true}).click();await page.getByText('已复制，粘贴到求职工作区的 Agent 对话即可。',{exact:true}).waitFor();assert.match(await page.evaluate(()=>window.testClipboard),/career-board Skill/);
 let stored=await page.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));assert.ok(stored.data[0].copied_at);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}}));
 await page.getByRole('button',{name:'复制给 Agent',exact:true}).click();await page.getByText('岗位已收藏，但剪贴板写入失败。可下载 Markdown 后交给 Agent。',{exact:true}).waitFor();stored=await page.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));assert.equal(stored.data[0].copied_at,null);assert.equal(stored.data.length,1);
 await page.getByRole('button',{name:'采集记录',exact:false}).click();await page.locator('#search').fill('没有这个公司');assert.equal(await page.locator('.record').count(),0);await page.locator('#search').fill('远山');assert.equal(await page.locator('.record').count(),1);await page.locator('#platform-filter').selectOption('liepin');assert.equal(await page.locator('.record').count(),0);await page.locator('#platform-filter').selectOption('boss');assert.equal(await page.locator('.record').count(),1);
 const source=await page.locator('.record-title').getAttribute('href');assert.equal(source,'https://www.zhipin.com/job_detail/demo.html');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出全部记录（Markdown）',exact:true}).click();const file=await download;const exported=await readFile(await file.path(),'utf8');assert.match(exported,/核对后的岗位原文/);assert.match(exported,/首次采集快照/);assert.match(exported,/真实业务需求/);
 await page.setViewportSize({width:440,height:650});await page.screenshot({path:path.join(out,'history.png'),fullPage:true});await page.getByRole('button',{name:'查看原文',exact:true}).click();await page.screenshot({path:path.join(out,'capture.png'),fullPage:true});
 for(const width of [320,440,900]){await page.setViewportSize({width,height:700});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`fits ${width}`);}
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'result.json'),JSON.stringify({fixtures:results,persistence:true,originalPreserved:true,filter:true,export:true,cleanInstall:true,responsive:true,clipboardBranches:'mocked',errors},null,2));console.log('Job clipper: five adapters, persistence, original, filtering, export, clipboard branches and responsive checks passed.');
}catch(error){console.error({url:page.url(),body:await page.locator('body').innerText(),capture:await page.evaluate(captureCurrentJob)});throw error;}finally{await context.close();await rm(profile,{recursive:true,force:true});}
