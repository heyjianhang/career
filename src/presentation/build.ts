import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {check,hash,json,noSymlinks,readPreference,themes} from './io.js';
import {templateMetadata} from './templates/registry.js';
import {html} from './render.js';
import type {Checked,Theme,Platform,PlatformRules,ResumeLink} from './types.js';

export interface BuildManifest {schema:'career-build/v1';id:string;theme:Theme;created_at:string;files:Record<string,string>;templates?:{id:string;version:number}[]}
export async function build(input:string,workspace:string,out?:string,theme?:Theme,navigation?:ResumeLink[]) {
  const checked=await check(input,workspace);
  const selected=theme??await readPreference(workspace);
  if(!themes.includes(selected)) throw new Error('未知样式：'+selected);
  const page=await html(checked,selected,false,navigation);
  const id=checked.input.id+'-'+randomUUID().slice(0,8);
  const directory=path.resolve(out??path.join(workspace,'build',id));
  await noSymlinks(directory);await mkdir(path.dirname(directory),{recursive:true});
  // Exclusive directory creation protects prior builds and hand-edited deliverables.
  await mkdir(directory);
  const files:Record<string,string>={
    'index.html':page,
    '.package.json':JSON.stringify(checked.input,null,2)+'\n',
    '.rules.json':JSON.stringify(checked.rules,null,2)+'\n'
  };
  for(const t of themes) files[`.print-${t}.html`]=await html(checked,t,true);
  const manifest:BuildManifest={schema:'career-build/v1',id,theme:selected,created_at:new Date().toISOString(),files:{},templates:templateMetadata.map(({id,version})=>({id,version}))};
  for(const [name,text] of Object.entries(files)) {await writeFile(path.join(directory,name),text,{flag:'wx'});manifest.files[name]=hash(text);}
  await writeFile(path.join(directory,'build.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return {directory,html:path.join(directory,'index.html'),manifest,warnings:checked.warnings};
}
export async function loadBuild(directory:string):Promise<{checked:Checked;manifest:BuildManifest}> {
  const manifest=await json<BuildManifest>(path.join(directory,'build.json'));
  const saved=manifest.templates??[{id:'classic',version:1},{id:'compact',version:1}];
  if(!Array.isArray(saved)||!saved.length||saved.some(t=>!t||! /^[a-z][a-z0-9-]{0,39}$/.test(t.id)||!Number.isInteger(t.version)||t.version<1)||new Set(saved.map(t=>t.id)).size!==saved.length)throw new Error('无效模板快照');
  if(manifest.schema!=='career-build/v1'||!saved.some(t=>t.id===manifest.theme)) throw new Error('不支持的构建记录');
  for(const name of ['index.html','.package.json','.rules.json',...saved.map(t=>`.print-${t.id}.html`)]) {
    const file=path.join(directory,name);await noSymlinks(file);
    if(!manifest.files||hash(await readFile(file))!==manifest.files[name]) throw new Error('构建产物已改变：'+name+'；请另建构建目录。');
  }
  // Builds are snapshots: upstream changes do not silently alter old deliverables.
  const registry=await json<Record<Platform,PlatformRules>>(path.join(directory,'.rules.json'));
  const checked=await check(path.join(directory,'.package.json'),undefined,false,registry);
  return {checked,manifest};
}
