import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {parseDocument} from 'yaml';
import {hash,noSymlinks} from '../presentation/io.js';
import {renderMarkdown} from '../board/markdown.js';

export const groups=[
 {id:'profile',label:'基本资料',prefix:'resume/facts/profile.md'},
 {id:'goals',label:'求职偏好',prefix:'context/goals.md'},
 {id:'employment',label:'工作经历',prefix:'resume/facts/employment/'},
 {id:'projects',label:'项目经历',prefix:'resume/facts/projects/'},
 {id:'education',label:'教育经历',prefix:'resume/facts/education/'},
 {id:'skills',label:'专业技能',prefix:'resume/facts/skills/'},
 {id:'certificates',label:'资格证书',prefix:'resume/facts/certificates/'},
 {id:'languages',label:'语言能力',prefix:'resume/facts/languages/'},
 {id:'context',label:'协作记录',prefix:'context/'},
 {id:'questions',label:'待补信息',prefix:'resume/questions.md'},
 {id:'files',label:'全部资料',prefix:''}
];
const roots=['context','resume/facts','resume/sources','resume/master'];
const singles=['resume/questions.md','resume/maintenance.md','resume/master-preview.md'];
const names:Record<string,string>={'context/INDEX.md':'协作概览','context/state.md':'当前进度','context/goals.md':'求职偏好','context/decisions.md':'已确认的决定','context/feedback.md':'反馈与调整','resume/questions.md':'待补信息','resume/maintenance.md':'资料整理进度','resume/master-preview.md':'完整经历整理','resume/facts/profile.md':'基本资料'};
export type MaterialFile={path:string;title:string;group:string;size:number;modified:string;kind:string};
const plain=(x:unknown):string=>typeof x==='string'||typeof x==='number'?String(x):'';
function parse(source:string){
 const m=source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 if(!m)return {meta:{} as Record<string,unknown>,body:source};
 const doc=parseDocument(m[1]!,{uniqueKeys:true});
 if(doc.errors.length)throw new Error('文档的资料字段格式有误，请在原文件中核对');
 const meta=doc.toJS({maxAliasCount:50});
 return {meta:meta&&typeof meta==='object'&&!Array.isArray(meta)?meta as Record<string,unknown>:{},body:source.slice(m[0].length)};
}
function allowed(p:string){return !!p&&!p.includes('\\')&&!p.split('/').some(s=>!s||s.startsWith('.'))&&(roots.some(r=>p.startsWith(r+'/'))||singles.includes(p));}
export async function materialPath(workspace:string,p:string){
 if(!allowed(p))throw new Error('没有这份个人资料');
 const full=path.join(workspace,p);await noSymlinks(full);const info=await stat(full);
 if(!info.isFile()||info.size>24*1024*1024)throw new Error('文件超过预览限制（24 MiB）');return {full,info};
}
export async function inventory(workspace:string){
 const files:MaterialFile[]=[];let truncated=false;
 async function add(p:string){
  const {full,info}=await materialPath(workspace,p);const ext=path.extname(p).toLowerCase();
  let title=names[p]??path.basename(p),kind=ext==='.md'?'markdown':ext==='.pdf'?'pdf':/\.(png|jpe?g|gif|webp)$/.test(ext)?'image':/\.(txt|csv|json|yaml|yml)$/.test(ext)?'text':'file';
  if(kind==='markdown'&&!names[p]&&info.size<=2*1024*1024){try{const {meta,body}=parse(await readFile(full,'utf8'));title=plain(meta.name)||plain(meta.company)||plain(meta.school)||body.match(/^#\s+(.+)$/m)?.[1]||title;}catch{/* Malformed files remain discoverable in the file tree. */}}
  const group=groups.find(g=>g.id!=='files'&&(g.prefix.endsWith('/')?p.startsWith(g.prefix):g.prefix===p))?.id??'files';
  files.push({path:p,title,group,size:info.size,modified:info.mtime.toISOString(),kind});
 }
 async function walk(p:string,depth=0){
  if(depth>12||files.length>=1500){truncated=true;return;}
  let entries;try{await noSymlinks(path.join(workspace,p));entries=await readdir(path.join(workspace,p),{withFileTypes:true});}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
  for(const e of entries.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'))){
   if(e.name.startsWith('.')||e.isSymbolicLink())continue;
   if(files.length>=1500){truncated=true;return;}
   const child=p+'/'+e.name;if(e.isDirectory())await walk(child,depth+1);else if(e.isFile()){try{await add(child);}catch{/* Unsupported/oversized files are not exposed. */}}
  }
 }
 for(const root of roots)await walk(root);
 for(const p of singles){try{await add(p);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 return {groups,files,truncated,revision:hash(JSON.stringify(files))};
}
export const materialUrl=(p:string,download=false)=>'/api/profile/file?'+new URLSearchParams({path:p,...(download?{download:'1'}:{})});
const fieldNames:Record<string,string>={name:'姓名',headline:'求职方向',city:'城市',phone:'电话',email:'邮箱',career_status:'当前状态',company:'公司',department:'部门',title:'职位',employment_type:'工作类型',start:'开始时间',end:'结束时间',is_current:'目前仍在进行',organization:'所属组织',role:'担任角色',school:'学校',major:'专业',qualification:'学历',degree:'学位',category:'类别',proficiency:'掌握程度',issuer:'颁发机构',obtained:'取得时间',expires:'有效期'};
export async function readMaterial(workspace:string,p:string){
 const {full,info}=await materialPath(workspace,p);if(info.size>2*1024*1024)throw new Error('文本超过预览限制（2 MiB），可下载查看');
 const source=await readFile(full,'utf8');let parsed,warning='';try{parsed=parse(source);}catch(e){warning=(e as Error).message;parsed={meta:{},body:source};}
 const {meta}=parsed;
 const fields=Object.entries(fieldNames).flatMap(([key,label])=>{
  if(key==='is_current')return [];
  const value=key==='end'&&meta.is_current===true?'至今':meta[key];if(value===null||value===undefined||value===''||value===false)return [];
  return [{label:key==='name'&&meta.type!=='profile'?'名称':label,value:value===true?'是':plain(value)}].filter(f=>f.value);
 });
 const data=await inventory(workspace);const title=data.files.find(f=>f.path===p)?.title??path.basename(p);
 const links=(Array.isArray(meta.links)?meta.links:[]).flatMap((l:unknown)=>{
  if(typeof l==='string')return [{label:l,url:l}];
  if(l&&typeof l==='object'){const o=l as Record<string,unknown>;return [{label:plain(o.label)||plain(o.title)||plain(o.url),url:plain(o.url)}];}return [];
 }).filter(l=>/^https?:\/\//i.test(l.url));
 const ids=[...(Array.isArray(meta.source_ids)?meta.source_ids:[]),...(Array.isArray(meta.related_ids)?meta.related_ids:[]),meta.employment_id].filter(x=>typeof x==='string') as string[];
 const references=data.files.filter(f=>ids.some(id=>f.path.endsWith('/'+id+'.md')||f.path.endsWith('/'+id+'/source.md'))).map(f=>({title:f.title,path:f.path}));
 // Empty template sections are omitted from the preview; source remains byte-for-byte accessible.
 const lines=parsed.body.split('\n');const body=lines.filter((line,i)=>!/^#{1,6}\s/.test(line)||lines.slice(i+1,lines.findIndex((l,j)=>j>i&&/^#{1,6}\s/.test(l))<0?undefined:lines.findIndex((l,j)=>j>i&&/^#{1,6}\s/.test(l))).some(l=>l.trim())).join('\n');
 return {path:p,title,source,sha256:hash(source),modified:info.mtime.toISOString(),fields,links,references,warning,...renderMarkdown(body,'',p,file=>materialUrl(file))};
}
