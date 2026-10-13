import {chromium} from 'playwright';
import {PDFDocument,PDFDict,PDFName} from 'pdf-lib';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {build} from '../dist/presentation/build.js';
import {startPreview} from '../dist/presentation/server.js';
import {exportPdf} from '../dist/presentation/pdf.js';
import {hash} from '../dist/presentation/io.js';
import {templates} from '../dist/presentation/templates/registry.js';

const out=path.resolve(process.argv[2]??'.cache/links-review/'+Date.now());await mkdir(out,{recursive:true});
const workspace=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-links-'));
const input=JSON.parse(await readFile('examples/presentation/package.json','utf8'));
input.common.sections[2].fields[0].url='https://example.com/certificate';
const portrait=await readFile('examples/presentation/assets/demo-portrait.jpg');
await writeFile(path.join(workspace,'portrait.jpg'),portrait);
input.resume.photo={path:'portrait.jpg',sha256:hash(portrait),alt:'虚构示例照片'};
const file=path.join(workspace,'input.json');await writeFile(file,JSON.stringify(input));
const built=await build(file,workspace);let server=await startPreview(built.directory,workspace);
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const ready=async()=>page.waitForFunction(()=>document.querySelector('#resume-preview')?.dataset.pagination==='ready',null,{timeout:60_000});
const expected=[...input.resume.contacts.flatMap(c=>c.url?[c.url]:[]),...input.resume.sections.flatMap(s=>s.items.flatMap(i=>(i.links??[]).map(l=>l.url)))];
async function pdfLinks(file){
  const doc=await PDFDocument.load(await readFile(file));const links=[];
  doc.getPages().forEach((p,index)=>{for(const ref of p.node.Annots()?.asArray()??[]){
    const annotation=doc.context.lookup(ref,PDFDict);const action=annotation.lookupMaybe(PDFName.of('A'),PDFDict);
    const uri=action?.get(PDFName.of('URI'));if(uri)links.push({page:index+1,url:uri.decodeText()});
  }});return {pages:doc.getPageCount(),links};
}
try {
  await page.goto(server.url);await ready();
  const frame=page.frameLocator('#resume-preview iframe');
  assert.equal(await frame.getByRole('link',{name:'portfolio.example.com',exact:true}).getAttribute('href'),expected[0]);
  assert.equal(await frame.getByRole('link',{name:'项目演示',exact:true}).getAttribute('href'),expected[1]);
  // The click opens the exact target; intercept the synthetic site to avoid network traffic.
  await context.route('https://example.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>演示目标</title>'}));
  const opened=context.waitForEvent('page');await frame.getByRole('link',{name:'项目演示',exact:true}).click();const popup=await opened;await popup.waitForLoadState();assert.equal(popup.url(),expected[1]);await popup.close();
  await page.locator('#open-gallery').click();assert.equal(await page.locator('.template-select a').count(),0);await page.locator('#close-gallery').click();
  await page.locator('[data-view="common"]').click();assert.equal(await page.locator('#export-pdf').isVisible(),false);
  for(const section of input.common.sections)await page.locator('#view-common').getByRole('heading',{name:section.title,exact:true}).waitFor();
  await page.getByRole('button',{name:'复制主页',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected[0]);
  const skill=input.common.sections[0].fields[0];await page.getByRole('button',{name:'复制'+skill.label,exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),skill.value);
  const certificate=input.common.sections[2].fields[0];await page.getByRole('button',{name:'复制'+certificate.label,exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),certificate.value);
  const photoDownload=page.waitForEvent('download');await page.getByRole('link',{name:'下载照片',exact:true}).click();const photo=await photoDownload;await photo.saveAs(path.join(out,'downloaded-photo.jpg'));assert.equal(hash(await readFile(path.join(out,'downloaded-photo.jpg'))),hash(portrait));
  await page.screenshot({path:path.join(out,'common-desktop.png')});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'common-mobile.png')});await page.setViewportSize({width:1440,height:1000});
  const download=page.waitForEvent('download');await page.locator('#save-html').click();const html=await download;const offline=path.join(out,'resume.html');await html.saveAs(offline);
  await page.goto('file://'+offline+'#view=common');await page.locator('#view-common').waitFor();assert.equal(await page.locator('#view-common a[href="'+expected[0]+'"]').count(),1);
  await page.locator('[data-view="resume"]').click();await ready();assert.equal(await page.frameLocator('#resume-preview iframe').getByRole('link',{name:'项目演示',exact:true}).getAttribute('href'),expected[1]);
  await page.screenshot({path:path.join(out,'resume-desktop.png')});
  const results=[];
  for(const template of templates){
    const file=path.join(out,template.id+'.pdf');await exportPdf(built.directory,template.id,file);const result=await pdfLinks(file);
    for(const url of expected)assert.ok(result.links.some(l=>l.url===url),template.id+' missing PDF link '+url);
    results.push({theme:template.id,...result});
  }
  // Links on subsequent pages must also survive the shared pagination engine.
  input.resume.sections.unshift({id:'long',title:'长内容检查',items:[{id:'long-item',title:'连续内容',paragraphs:Array.from({length:22},(_,i)=>`第 ${i+1} 段：`+'用于验证分页后的项目链接仍然可以跳转。'.repeat(12)),bullets:[]}]});
  await writeFile(file,JSON.stringify(input));const longBuild=await build(file,workspace);const longPdf=path.join(out,'long.pdf');await exportPdf(longBuild.directory,'blue-tab',longPdf);const long=await pdfLinks(longPdf);
  assert.ok(long.pages>1);assert.ok(long.links.some(l=>l.page>1&&l.url===expected[1]));
  delete input.common;delete input.resume.photo;input.resume.contacts.forEach(c=>delete c.url);input.resume.sections.forEach(s=>s.items.forEach(i=>delete i.links));await writeFile(file,JSON.stringify(input));const legacy=await build(file,workspace);await page.goto('file://'+legacy.html);await ready();
  assert.equal(await page.frameLocator('#resume-preview iframe').locator('.resume-item-links,.resume-web-link').count(),0);
  await page.locator('[data-view="common"]').click();assert.equal(await page.locator('#view-common .common-photo').count(),0);assert.equal(await page.locator('#view-common a').count(),0);
  assert.deepEqual(errors,[]);await writeFile(path.join(out,'results.json'),JSON.stringify({passed:true,results,long,checks:['14 PDF link targets','later-page PDF target','preview link click','no nested gallery links','common field keyboard/click copy','original photo download','offline links','mobile overflow','absent optional fields']},null,2));
  console.log(JSON.stringify({passed:true,templates:results.length,longPages:long.pages,out}));
}finally{await browser.close();await server.close();await rm(workspace,{recursive:true,force:true});}
