import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from '../dist/presentation/build.js';
import {startPreview} from '../dist/presentation/server.js';
import {exportPdf} from '../dist/presentation/pdf.js';
import {hash} from '../dist/presentation/io.js';
import {templates} from '../dist/presentation/templates/registry.js';

const out=path.resolve(process.argv[2]??'.cache/template-review/'+Date.now());
await mkdir(out,{recursive:true});
const workspace=path.join(out,'workspace');await mkdir(workspace);
const fixture=JSON.parse(await readFile('examples/presentation/package.json','utf8'));
const portrait=await readFile('examples/presentation/assets/demo-portrait.jpg');
await writeFile(path.join(workspace,'photo.jpg'),portrait);
const selected=templates.filter(t=>!['classic','compact'].includes(t.id));
const results=[];const errors=[];
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:794,height:1123}});
page.on('pageerror',e=>errors.push(e.message));
try {
  for(const mode of ['photo','no-photo','long']){
    const input=structuredClone(fixture);
    if(mode!=='no-photo')input.resume.photo={path:'photo.jpg',sha256:hash(portrait),alt:'虚构示例人物插画',position:{x:50,y:35}};
    if(mode==='long'){
      input.resume.contacts.push({label:'长链接',value:'https://example.com/'+ 'long-path-'.repeat(35)});
      input.resume.sections.push({id:'extra',title:'研究与社区经历（任意新增章节）',items:[{id:'long-entry',title:'跨页长条目',subtitle:'项目负责人 / 研究与交付',period:'2020.01 — 2026.10',paragraphs:Array.from({length:24},(_,i)=>`长段落${i+1}：`+'这是一段用来核对自然分页的虚构内容，包含中文、数字123与 Agent API。'.repeat(5)),bullets:['最终要点：所有内容保留到结束。']}]});
    }
    const file=path.join(workspace,mode+'.json');await writeFile(file,JSON.stringify(input));
    const result=await build(file,workspace);
    for(const template of selected){
      const id=template.id;
      const document=await readFile(path.join(result.directory,`.print-${id}.html`),'utf8');
      await page.setViewportSize({width:794,height:1123});await page.emulateMedia({media:'screen'});
      await page.setContent(document,{waitUntil:'load'});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
      await page.waitForFunction(()=>document.documentElement.dataset.pagination==='ready',null,{timeout:60_000});
      const pageCount=Number(await page.locator('html').getAttribute('data-page-count'));
      assert.ok(await page.locator('.design-section').count()>=input.resume.sections.length+1);
      for(const section of input.resume.sections)assert.ok((await page.locator('#pages').innerText()).includes(section.title));
      assert.equal(await page.locator('.resume-photo').count(),mode==='no-photo'?0:1);
      if(mode!=='no-photo'){
        const crop=await page.locator('.resume-photo').evaluate(e=>({radius:getComputedStyle(e).borderRadius,position:getComputedStyle(e).objectPosition,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
        assert.equal(crop.position,'50% 35%');
        if(['teal-dot','slate-header','skyline','taupe-ring'].includes(id)){
          assert.equal(crop.radius,'50%',id+' round photo');assert.ok(Math.abs(crop.width-crop.height)<1,id+' square crop box');
        } else assert.equal(crop.radius,'0px',id+' rectangular photo');
      }
      assert.ok((await page.locator('#pages').innerText()).includes('业务工单 Agent'));
      const overflow=(await page.locator('.resume-paper').evaluateAll(papers=>papers.flatMap(e=>{
        const root=e.getBoundingClientRect();
        return [...e.querySelectorAll('h1,h2,h3,p,li,dd,.design-photo-frame')].filter(n=>{const r=n.getBoundingClientRect();return r.right>root.right+1||r.left<root.left-1;}).map(n=>n.className||n.tagName);
      })));
      assert.deepEqual(overflow,[],`${id} ${mode}: overflow`);
      if(mode!=='long')await page.locator('.pagedjs_page').first().screenshot({path:path.join(out,`${id}-${mode}.png`)});
      await exportPdf(result.directory,id,path.join(out,`${id}-${mode}.pdf`));
      const pdf=await PDFDocument.load(await readFile(path.join(out,`${id}-${mode}.pdf`)));assert.equal(pdf.getPageCount(),pageCount,`${id} ${mode}: PDF and preview page count`);
      results.push({id,mode,pages:pageCount,content:true,overflow:false,pdf:true});
    }
    // Real workbench interactions, including every newly registered template.
    if(mode==='photo'){
      const server=await startPreview(result.directory,workspace);
      try {
        await page.setViewportSize({width:1440,height:1000});await page.goto(server.url);
        await page.getByRole('button',{name:'导出 PDF',exact:true}).waitFor();
        await page.locator('#open-gallery').click();assert.equal(await page.locator('[data-template-card]').count(),14);
        await page.screenshot({path:path.join(out,'gallery-desktop.png')});await page.keyboard.press('Escape');
        for(const t of selected){
          await page.locator('#open-gallery').click();await page.locator(`[data-preview-template="${t.id}"]`).click();
          await page.waitForFunction(()=>document.querySelector('#gallery-resume').dataset.pagination==='ready',null,{timeout:60_000});
          assert.equal(await page.frameLocator('#gallery-resume iframe').locator('.resume-paper').first().getAttribute('data-template'),t.id);
          await page.keyboard.press('Escape');assert.equal(await page.locator('#gallery-browse').isVisible(),true);
          await page.locator(`[data-gallery-choice="${t.id}"]`).click();await page.locator('#apply-template').click();
          await page.waitForFunction(()=>document.querySelector('#resume-preview').dataset.pagination==='ready',null,{timeout:60_000});
          assert.equal(await page.frameLocator('#resume-preview iframe').locator('.resume-paper').first().getAttribute('data-template'),t.id);
          for(const width of [768,390]){
            await page.setViewportSize({width,height:900});
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${t.id}: viewport ${width}`);
            const escaped=await page.frameLocator('#resume-preview iframe').locator('.resume-paper').first().evaluate(e=>[...e.querySelectorAll('h1,h2,h3,p,li,dd,.resume-photo')].some(n=>n.getBoundingClientRect().right>innerWidth+1));
            assert.equal(escaped,false,`${t.id}: child overflow at ${width}`);
          }
          if(t.id==='skyline')await page.screenshot({path:path.join(out,'mobile-skyline.png'),fullPage:true});
          await page.setViewportSize({width:1440,height:1000});
        }
        await page.locator('#open-gallery').click();await page.locator('[data-gallery-choice="taupe-ring"]').click();
        await page.locator('#gallery-default').click();await page.getByRole('button',{name:'取消默认',exact:true}).waitFor();
        const next=await build(file,workspace);assert.equal(next.manifest.theme,'taupe-ring');
        await page.locator('#gallery-default').click();await page.getByRole('button',{name:'设为默认',exact:true}).waitFor();
        await page.keyboard.press('Escape');
      } finally {await server.close();}
    }
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'results.json'),JSON.stringify({passed:true,results,checks:['14 gallery entries','12 preview / Escape / apply','new default set / clear / subsequent build','photo focus','all sections retained','desktop / tablet / mobile','36 offline PDF exports','no browser errors']},null,2));
  console.log(JSON.stringify({passed:true,exports:results.length,out}));
} finally {await browser.close();}
