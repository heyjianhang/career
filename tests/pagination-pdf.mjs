// Offline artifact regression: uses the production PDF exporter, not UI automation.
import assert from 'node:assert/strict';
import {mkdtemp,realpath,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {initializeWorkspace} from '../dist/agent-api.js';
import {blankPackage,blankExperience} from '../dist/resumes/model.js';
import {savePackage} from '../dist/resumes/store.js';
import {build} from '../dist/presentation/build.js';
import {exportPdf} from '../dist/presentation/pdf.js';
import {templateMetadata} from '../dist/presentation/templates/registry.js';
const out=path.resolve(process.argv[2]??'.cache/pagination-pdf/'+Date.now());await mkdir(out,{recursive:true});
const w=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-pagination-'));await initializeWorkspace(w);
const clean=s=>s.replace(/\s/g,'');
const all=[];
try{
 for(const theme of process.argv.includes('--all-templates')?templateMetadata.map(t=>t.id):['engineering']){
 for(const mode of ['short','long','manual','employment','employment-manual']){
  const b=blankPackage('resume-'+theme+'-'+mode,'分页回归 · 虚构资料');b.synthetic=true;b.content.profile={name:'测试用户',headline:'AI 开发工程师',contacts:[]};
  b.content.sections=[{id:'projects',title:'项目经历',items:Array.from({length:mode==='long'?3:12},(_,i)=>({...blankExperience('project','entry-'+i),title:'项目'+String(i).padStart(2,'0'),subtitle:'项目负责人 / 核心研发',technologies:'Python · PostgreSQL · MCP',description:mode==='long'?'段落开头'+i+'：'+('用于检验跨页连续排版与文本完整保留，正文内容不得遗漏。'.repeat(45))+'段落结束'+i:'介绍标记'+i+'：围绕合成业务需求开发知识查询与任务处理工具，供离线分页回归使用。',responsibilities:mode==='long'?'要点开头'+i+'：'+('长要点需要按完整文本行续页，不能因整体避让而留下大片空白。'.repeat(50))+'要点结束'+i:'能力建设：实现文档处理、业务查询与结构化输出。\n实际交付：完成应用集成与本地运行验证。',achievements:'结束标记'+i+'：保留全部内容。',page_break_before:mode==='manual'&&i===3}))}];
  if(mode.startsWith('employment')){
   // A photo header, skills grid and two employers reproduce the boundary where
   // the next employer's heading + two body lines cannot fit on the first page.
   const fill=(label,n)=>label+'：'+('负责业务系统需求梳理与应用研发，完成方案设计和部署交付。'.repeat(20)).slice(0,n);
   const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8iQAAAAASUVORK5CYII=','base64');
   await writeFile(path.join(w,'photo.png'),png);
   b.content.profile={name:'测试用户',english_name:'Test User',headline:'应用工程师 / 软件研发',contacts:[],photo:{path:'photo.png',sha256:createHash('sha256').update(png).digest('hex'),alt:'测试占位图',position:{x:50,y:50,zoom:1.2}}};
   b.content.summary=fill('简介甲',85)+'\n\n'+fill('简介乙',20);
   b.content.common.sections=[{id:'skills',title:'核心技能',fields:[130,100,80,75,60].map((n,i)=>({label:'技能类别'+i,value:fill('技能'+i,n)}))}];
   b.content.layout={sectionOrder:['common:skills','section:work']};
   b.content.sections=[{id:'work',title:'工作经历',items:[
    {...blankExperience('employment','work-a'),title:'合成应用开发有限公司',subtitle:'应用工程师',responsibilities:[65,68,65].map((n,i)=>fill('工作甲'+i,n)).join('\n')},
    {...blankExperience('employment','work-b'),title:'合成技术集团',subtitle:'工程师 / 部门负责人',responsibilities:[78,70,65,80,65,75].map((n,i)=>fill('工作乙'+i,n)).join('\n'),page_break_before:mode==='employment-manual'}
   ]}];
  }
  await savePackage(w,b);const built=await build(path.join(w,'resume/presentations',b.id,'package.json'),w,undefined,theme);const f=path.join(out,theme+'-'+mode+'.pdf');await exportPdf(built.directory,theme,f);
  const loading=getDocument({data:new Uint8Array(await readFile(f)),useSystemFonts:true});const pdf=await loading.promise;const pages=[];
  for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),data=await page.getTextContent();const items=data.items.filter(i=>'str'in i&&i.str.trim()).sort((a,b)=>Math.abs(a.transform[5]-b.transform[5])<2?a.transform[4]-b.transform[4]:b.transform[5]-a.transform[5]);pages.push({text:clean(items.map(i=>i.str).join('')),items:items.map(i=>({text:clean(i.str),y:i.transform[5]})),height:page.view[3]});}
  const text=pages.map(p=>p.text).join('');
  for(let i=0;i<b.content.sections[0].items.length&&!mode.startsWith('employment');i++){assert.ok(text.includes('结束标记'+i),'missing last bullet '+mode+i);if(mode==='long')for(const marker of ['段落开头','段落结束','要点开头','要点结束'])assert.ok(text.includes(marker+i),'missing long content '+marker+i);}
  assert.ok(pages.every(p=>p.text.length>35),'blank page');
  if(mode==='long'){assert.ok(text.includes('（续）'),'continuation headings missing');assert.ok(pdf.numPages>=2);const body=text.replace(/测试用户\d+\/\d+|项目\d{2}（续）/g,'');assert.equal(body.split('用于检验跨页连续排版与文本完整保留，正文内容不得遗漏。').length-1,135);assert.equal(body.split('长要点需要按完整文本行续页，不能因整体避让而留下大片空白。').length-1,150);}
  if(mode==='short'){
   for(const p of pages.slice(0,-1)){const body=p.items.filter(i=>i.y>45&&i.y<p.height-30);assert.ok(Math.min(...body.map(i=>i.y))<p.height*.25,'excessive avoid-break gap');}
  }
  if(mode==='manual'){
   const page=pages.find(p=>p.text.includes('项目03'));assert.ok(page,'manual entry missing');const top=page.items.filter(i=>i.y>page.height-100).map(i=>i.text).join('');assert.ok(top.includes('项目03'),'manual page break was ignored');
  }
  if(mode.startsWith('employment')){
   const body=clean(pages.flatMap(p=>p.items.filter(i=>i.y>35).map(i=>i.text)).join('')).replace(/合成技术集团（续）/g,'');
   for(const item of b.content.sections[0].items)for(const bullet of item.responsibilities.split('\n'))assert.ok(body.includes(clean(bullet)),'missing employment bullet '+bullet.slice(0,8));
  }
  const firstBodyBottom=Math.min(...pages[0].items.filter(i=>i.y>35).map(i=>i.y));
  const lastBodyBottom=Math.min(...pages.at(-1).items.filter(i=>i.y>35).map(i=>i.y));
  const firstRows=[];for(const item of pages[0].items){const row=firstRows.find(r=>Math.abs(r.y-item.y)<.5);if(row)row.text+=item.text;else firstRows.push({...item});}
  const workStarts=['工作甲0','工作甲1'].map(label=>firstRows.find(i=>i.text.includes(label))?.y);
  const workGap=workStarts.every(Number.isFinite)?workStarts[0]-workStarts[1]:undefined;
  all.push({theme,mode,pages:pdf.numPages,firstBodyBottom,lastBodyBottom,workGap,passed:true});await loading.destroy();
 }
 console.log(JSON.stringify({theme,passed:true}));
 }
 const natural=all.find(r=>r.theme==='engineering'&&r.mode==='employment'),manual=all.find(r=>r.theme==='engineering'&&r.mode==='employment-manual');
 assert.ok(natural.pages<=manual.pages,'natural flow must not add pages compared with an explicit break');
 assert.ok(manual.firstBodyBottom>100,'fixture must reproduce a substantial first-page gap');
 assert.ok(natural.firstBodyBottom<=manual.firstBodyBottom+1,'natural flow must use the available first-page space');
 assert.ok(natural.firstBodyBottom>48,'body must stay above the engineering bottom margin');
 assert.ok(Number.isFinite(natural.workGap)&&Math.abs(natural.workGap-manual.workGap)<.1,'identical work bullets must retain identical spacing with or without a later manual break');
 await writeFile(path.join(out,'results.json'),JSON.stringify(all,null,2));console.log(JSON.stringify({passed:true,out,cases:all}));
}finally{await rm(w,{recursive:true,force:true});}
