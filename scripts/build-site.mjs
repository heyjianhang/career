import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, copyFile, rm, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readBootstrap} from './bootstrap.mjs';
import {renderDownloads} from './site-downloads.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const output=path.join(root,'build/site');
export const publicFiles=['index.html','style.css','app.js','favicon.svg','404.html','robots.txt','install.md','llms.txt','assets/workspace.jpg','assets/styles.jpg'];
const escapeHtml=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export async function buildSite(){
  const {pkg,prompt,guide,index}=await readBootstrap();
  const downloads=JSON.parse(await readFile(path.join(root,'site/downloads.json'),'utf8'));
  let html=await readFile(path.join(root,'site/index.html'),'utf8');
  assert.equal(html.split('{{BOOTSTRAP_PROMPT}}').length,2,'Portal must contain exactly one prompt placeholder');
  html=html.replace('{{BOOTSTRAP_PROMPT}}',escapeHtml(prompt));
  for(const [key,value] of Object.entries(renderDownloads(downloads)))html=html.replaceAll(`{{${key}}}`,value);
  assert.ok(!html.includes('{{'),'Unresolved portal placeholder');
  // Only these public inputs may enter the hosting artifact. Never publish the repository root.
  await rm(output,{recursive:true,force:true});
  await mkdir(path.join(output,'assets'),{recursive:true});
  await writeFile(path.join(output,'index.html'),html);
  await writeFile(path.join(output,'install.md'),guide);
  await writeFile(path.join(output,'llms.txt'),index);
  for(const name of ['style.css','app.js','favicon.svg','404.html','robots.txt'])await copyFile(path.join(root,'site',name),path.join(output,name));
  for(const name of ['workspace.jpg','styles.jpg'])await copyFile(path.join(root,'docs/assets',name),path.join(output,'assets',name));
  const actual=(await readdir(output,{recursive:true,withFileTypes:true})).filter(x=>x.isFile()).map(x=>path.relative(output,path.join(x.parentPath,x.name)).split(path.sep).join('/')).sort();
  assert.deepEqual(actual,[...publicFiles].sort(),'Unexpected file in public artifact');
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const ref=match[1];
    if(ref.startsWith('#')||ref.startsWith('https://'))continue;
    assert.ok(publicFiles.includes(ref),`Missing public asset: ${ref}`);
  }
  return {directory:output,npmVersion:pkg.version,desktopVersion:downloads.version,files:actual,prompt:'from README'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildSite(),null,2));
