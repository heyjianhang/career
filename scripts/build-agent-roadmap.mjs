import {readFile,readdir,mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import MarkdownIt from 'markdown-it';
import {routes,steps} from '../docs/agent-roadmap/steps.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const skills=['career-setup','career-git','career-intake','career-employment','career-project','resume-master','resume-tailor','career-board'];
const sourceDir=path.join(root,'docs/agent-roadmap');
const explicitDocs=['docs/agent-workflow.md','docs/career-assets.md','docs/agent-method-references.md','docs/expert-methods.md','docs/context-protocol.md','docs/data-model.md','docs/opportunities.md','docs/resume-packages.md','docs/skill-evaluation-cases.md','docs/installation.md','docs/presentation.md','install.md'];
const slash=s=>s.split(path.sep).join('/');
async function markdownFiles(dir){
 const result=[];
 for(const e of await readdir(path.join(root,dir),{withFileTypes:true})){
  const p=dir+'/'+e.name;
  if(e.isSymbolicLink())continue;
  if(e.isDirectory())result.push(...await markdownFiles(p));
  else if(e.isFile()&&e.name.endsWith('.md'))result.push(p);
 }
 return result;
}
export async function buildAgentRoadmap(out=path.join(root,'build/agent-roadmap')){
 const files=[...explicitDocs,...(await Promise.all(skills.map(s=>markdownFiles('.agents/skills/'+s)))).flat()];
 const sources=new Map(files.map(f=>[f,f]));
 sources.set('AGENTS.md','templates/workspace/AGENTS.md');
 sources.set('context/state.md','templates/context/state.md');
 sources.set('context/progress.md','templates/context/progress.md');
 const docs={};
 for(const [id,source] of sources){
  const raw=await readFile(path.join(root,source),'utf8');
  const body=raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'');
  docs[id]={source,raw,title:body.match(/^#\s+(.+)$/m)?.[1]||path.basename(id),html:''};
 }
 const errors=[];
 for(const step of steps){for(const read of step.reads)if(!docs[read.path])errors.push('Unknown stage document: '+read.path)}
 for(const route of routes){for(const id of route.steps)if(!steps.some(s=>s.id===id))errors.push('Unknown step: '+id)}
 for(const [id,doc] of Object.entries(docs)){
  const md=new MarkdownIt({html:false,linkify:false,typographer:false});
  const counts=new Map();
  md.renderer.rules.heading_open=(tokens,i,options,env,self)=>{
   const text=tokens[i+1].content;
   const slug=text.trim().toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu,'').replace(/\s+/g,'-');
   const count=counts.get(slug)||0;counts.set(slug,count+1);
   tokens[i].attrSet('id',count?`${slug}-${count}`:slug);
   return self.renderToken(tokens,i,options);
  };
  md.renderer.rules.link_open=(tokens,i,options,env,self)=>{
   const token=tokens[i],href=token.attrGet('href')||'';
   if(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)){
    token.attrSet('target','_blank');token.attrSet('rel','noopener noreferrer');
   }else{
    const [file,anchor='']=href.split('#');
    const target=path.posix.normalize(path.posix.join(path.posix.dirname(id),decodeURIComponent(file.split('?')[0]||path.posix.basename(id))));
    if(docs[target]){token.attrSet('href','#');token.attrSet('data-open-doc',target);if(anchor)token.attrSet('data-anchor',decodeURIComponent(anchor));}
    else if(file){token.attrSet('href','../../'+target+(anchor?'#'+anchor:''));token.attrSet('target','_blank');token.attrSet('rel','noopener');}
   }
   return self.renderToken(tokens,i,options);
  };
  const body=doc.raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'');
  doc.html=md.render(body);
 }
 if(errors.length)throw new Error(errors.join('\n'));
 const builtAt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const payload={routes,steps,docs,builtAt};
 const [template,css,script]=await Promise.all(['index.html','styles.css','app.js'].map(f=>readFile(path.join(sourceDir,f),'utf8')));
 const html=template.replace('/* STYLES */',()=>css).replace('/* SCRIPT */',()=>script).replace('/* DATA */',()=>JSON.stringify(payload).replace(/</g,'\\u003c'));
 await mkdir(out,{recursive:true});await writeFile(path.join(out,'index.html'),html);
 return {file:slash(path.join(out,'index.html')),steps:steps.length,documents:Object.keys(docs).length,bytes:(await stat(path.join(out,'index.html'))).size};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildAgentRoadmap()));
