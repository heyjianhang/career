// Artifact regression via the production exporter, no browser interaction.
import assert from 'node:assert/strict';
import {mkdtemp,realpath,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {initializeWorkspace} from '../dist/agent-api.js';
import {savePackage} from '../dist/resumes/store.js';
import {build} from '../dist/presentation/build.js';
import {exportPdf} from '../dist/presentation/pdf.js';
import {engineeringFlow} from './fixtures/engineering-flow.mjs';
const out=path.resolve(process.argv[2]??'.cache/engineering-pdf/'+Date.now());await mkdir(out,{recursive:true});
const w=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-engineering-'));await initializeWorkspace(w);
const clean=s=>s.replace(/\s/g,'');const results=[];const pageTexts=new Map();
try{
 for(const mode of ['flow','tail','manual','compact','custom']){
  const b=engineeringFlow(mode),original=JSON.stringify(b);await savePackage(w,b);
  const built=await build(path.join(w,'resume/presentations',b.id,'package.json'),w,path.join(out,mode),'engineering');
  const file=path.join(out,mode+'.pdf');await exportPdf(built.directory,'engineering',file);
  const loading=getDocument({data:new Uint8Array(await readFile(file)),useSystemFonts:true}),pdf=await loading.promise,pages=[];
  for(let n=1;n<=pdf.numPages;n++){
   const p=await pdf.getPage(n),data=await p.getTextContent();
   const items=data.items.filter(i=>'str'in i&&i.str.trim()&&i.transform[5]>35).sort((a,b)=>Math.abs(a.transform[5]-b.transform[5])<2?a.transform[4]-b.transform[4]:b.transform[5]-a.transform[5]);
   const text=clean(items.map(i=>i.str).join(''));pages.push({text,items,bottom:Math.min(...items.map(i=>i.transform[5])),height:p.view[3]});
  }
  let body=pages.map(p=>p.text).join('');
  for(const item of b.content.sections[0].items)body=body.split(clean(item.title)+'（续）').join('');
  let cursor=0;
  for(const item of b.content.sections[0].items)for(const field of [item.title,item.subtitle,item.technologies,item.description,...item.responsibilities.split('\n'),item.achievements]){
   const expected=clean(field),at=body.indexOf(expected,cursor);assert.ok(at>=cursor,mode+' changed/lost/reordered '+field.slice(0,12));cursor=at+expected.length;
  }
  assert.equal(JSON.stringify(b),original,'pagination must not change the source package');
  for(const [i,p] of pages.entries()){
   assert.ok(p.bottom>48,mode+' overlaps footer on '+i);
   // Heading protection may leave space for the lead + two body lines, but
   // later pages must not pull content away merely to fill a sparse last page.
   if(i<pages.length-1&&mode!=='manual')assert.ok(p.bottom<p.height*.25,mode+' leaves excessive avoidable space on '+i);
  }
  if(mode==='manual')assert.ok(pages.some(p=>p.text.startsWith('CAD智能设计系统')),'explicit project break ignored');
  pageTexts.set(mode,pages.map(p=>p.text));
  results.push({mode,pages:pdf.numPages,bottoms:pages.map(p=>Math.round(p.bottom)),file,passed:true});await loading.destroy();
 }
 // Extending a document must not change the layout of already full pages.
 const prefix=pageTexts.get('tail').slice(0,-1);
 assert.deepEqual(pageTexts.get('flow').slice(0,prefix.length),prefix,'later content must not rebalance or restyle earlier pages');
 await writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({out,results}));
}finally{await rm(w,{recursive:true,force:true});}
