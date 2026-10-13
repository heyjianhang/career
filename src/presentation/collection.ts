import {readdir,mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {check,json,noSymlinks,hash,rules} from './io.js';
import {build,loadBuild} from './build.js';
import {emptyHtml} from './render.js';
import type {ResumeLink,Issue,Theme} from './types.js';

interface Entry {id:string;title:string;generated_at:string;file:string}
interface Collection {schema:'career-collection/v1';created_at:string;index_sha256:string;entries:ResumeLink[]}
const safeId=(id:string)=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(id);

/** Read only direct package.json children of the configured presentation directory. */
export async function presentationDirectory(workspace:string) {
  let resumeDir='resume';
  try {
    const config=await json<{schema:string;resume_dir?:string}>(path.join(workspace,'career.json'));
    if(config.schema!=='career-workspace/v1')throw new Error('不支持的工作区配置');
    resumeDir=config.resume_dir??resumeDir;
  } catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(typeof resumeDir!=='string'||!resumeDir||path.isAbsolute(resumeDir)||resumeDir.includes('\\')||resumeDir.split('/').includes('..')||/^[a-z]+:/i.test(resumeDir))throw new Error('resume_dir 必须在工作区内');
  const directory=path.resolve(workspace,resumeDir,'presentations');await noSymlinks(directory);
  return directory;
}

export async function listPresentations(workspace:string) {
  const directory=await presentationDirectory(workspace);
  const entries:Entry[]=[],warnings:Issue[]=[];
  let children;try{children=await readdir(directory,{withFileTypes:true});}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {directory,entries,warnings};throw e;}
  const registry=await rules();
  for(const child of children) {
    if(child.isSymbolicLink()){warnings.push({code:'SKIPPED_PACKAGE',path:child.name,message:'不读取符号链接目录'});continue;}
    if(!child.isDirectory()||child.name.startsWith('.'))continue;
    const file=path.join(directory,child.name,'package.json');
    try {
      await noSymlinks(file);
      if((await stat(file)).size>16*1024*1024)throw new Error('内容包超过 16 MiB');
      const {input}=await check(file,workspace,false,registry);
      entries.push({id:input.id,title:input.title,generated_at:input.generated_at,file});
    } catch(e) {warnings.push({code:'SKIPPED_PACKAGE',path:child.name,message:(e as Error).message});}
  }
  const counts=new Map<string,number>();for(const entry of entries)counts.set(entry.id,(counts.get(entry.id)??0)+1);
  const valid=entries.filter(entry=>{
    if(counts.get(entry.id)===1)return true;
    warnings.push({code:'DUPLICATE_PACKAGE',path:entry.id,message:'内容包 ID 重复，这些文件均不纳入集合'});return false;
  });
  valid.sort((a,b)=>Date.parse(b.generated_at)-Date.parse(a.generated_at)||a.id.localeCompare(b.id));
  return {directory,entries:valid,warnings};
}

export async function buildCollection(workspace:string,out?:string,theme?:Theme) {
  const listed=await listPresentations(workspace);
  if(listed.warnings.length)throw new Error('内容目录需要修正：\n'+listed.warnings.map(w=>`${w.path}: ${w.message}`).join('\n'));
  // Verify all source material before creating any output directory.
  for(const entry of listed.entries)await check(entry.file,workspace);
  const directory=path.resolve(out??path.join(workspace,'build','collection-'+randomUUID().slice(0,8)));
  await noSymlinks(directory);await mkdir(path.dirname(directory),{recursive:true});await mkdir(directory);
  const links=listed.entries.map(({id,title,generated_at})=>({id,title,generated_at,href:`../${id}/index.html`}));
  const warnings:Issue[]=[];
  let first:Awaited<ReturnType<typeof build>>|undefined;
  for(const entry of listed.entries){const result=await build(entry.file,workspace,path.join(directory,'resumes',entry.id),theme,links);first??=result;warnings.push(...result.warnings);}
  const entries=links.map(e=>({...e,href:`resumes/${e.id}/index.html`}));
  let index=first?await readFile(first.html,'utf8'):await emptyHtml();
  for(const entry of links)index=index.replaceAll(`href="${entry.href}"`,`href="resumes/${entry.id}/index.html"`);
  await writeFile(path.join(directory,'index.html'),index,{flag:'wx'});
  const manifest:Collection={schema:'career-collection/v1',created_at:new Date().toISOString(),index_sha256:hash(index),entries};
  await writeFile(path.join(directory,'collection.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return {directory,html:path.join(directory,'index.html'),count:entries.length,manifest,warnings};
}

export async function loadCollection(directory:string) {
  const manifest=await json<Collection>(path.join(directory,'collection.json'));
  if(manifest.schema!=='career-collection/v1'||!Array.isArray(manifest.entries)||manifest.entries.some(e=>!e||!safeId(e.id)||e.href!==`resumes/${e.id}/index.html`)||new Set(manifest.entries.map(e=>e.id)).size!==manifest.entries.length)throw new Error('无效简历集合');
  await noSymlinks(path.join(directory,'index.html'));
  if(hash(await readFile(path.join(directory,'index.html')))!==manifest.index_sha256)throw new Error('集合首页已改变，请重新构建');
  for(const entry of manifest.entries){const snapshot=await loadBuild(path.join(directory,'resumes',entry.id));if(snapshot.checked.input.id!==entry.id)throw new Error('集合与简历快照不一致');}
  return manifest;
}
