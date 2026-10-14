import {chromium} from 'playwright';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadBuild} from './build.js';
import {noSymlinks} from './io.js';
import type {Theme} from './types.js';

let desktopRenderer:((html:string)=>Promise<Buffer>)|undefined;
/** Desktop supplies its bundled Chromium; npm CLI retains the Playwright runtime. */
export function setPdfRenderer(renderer:(html:string)=>Promise<Buffer>){desktopRenderer=renderer;}

export async function pdfBuffer(directory:string,theme:Theme):Promise<Buffer> {
  const {manifest}=await loadBuild(directory);
  if(!(manifest.templates??[{id:'classic'},{id:'compact'}]).some(t=>t.id===theme))throw new Error('此构建没有该样式的快照');
  const content=await readFile(path.join(directory,`.print-${theme}.html`),'utf8');
  if(desktopRenderer){const bytes=await desktopRenderer(content);if(bytes.length<1000||bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('PDF 文件生成失败');return bytes;}
  let browser;
  try {browser=await chromium.launch({headless:true});}
  catch {throw new Error('缺少 PDF 浏览器运行时。请运行 career runtime install --component pdf，再重试。');}
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.route('**/*',route=>route.abort());
    await page.setContent(content,{waitUntil:'load'});
    if(content.includes('data-pagination=')) {
      await page.waitForFunction(()=>['ready','error'].includes(document.documentElement.dataset.pagination??''),{},{timeout:60_000});
      const error=await page.evaluate(()=>document.documentElement.dataset.paginationError);
      if(error)throw new Error('分页失败：'+error);
    }
    await page.emulateMedia({media:'print'});
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>i.decode()));});
    const bytes=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
    if(bytes.length<1000||bytes.subarray(0,5).toString()!=='%PDF-') throw new Error('PDF 文件生成失败');
    return bytes;
  } finally {await browser.close();}
}
export async function exportPdf(directory:string,theme:Theme,out:string) {
  await noSymlinks(out);
  const bytes=await pdfBuffer(directory,theme);
  await mkdir(path.dirname(path.resolve(out)),{recursive:true});
  await writeFile(out,bytes,{flag:'wx'});
  return {pdf:path.resolve(out),bytes:bytes.length,theme};
}
