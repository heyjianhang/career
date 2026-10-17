import {projectPackage,type ResumePackage} from '../resumes/model.js';
import {readFile, stat, mkdir, lstat, realpath, writeFile, rename, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {Ajv} from 'ajv';
import {templates} from './templates/registry.js';
import {isWebUrl} from './links.js';
import type {ResolvedAssets, Presentation, Platform, PlatformRules, Issue, Checked, Theme} from './types.js';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const platforms: Platform[] = ['boss','zhaopin','liepin','job51'];
export const themes: Theme[] = templates.map(t=>t.id);
export const hash = (s: string|Buffer) => createHash('sha256').update(s).digest('hex');
export async function noSymlinks(file: string) {
  const absolute = path.resolve(file); let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error('不跟随符号链接：' + current); }
    catch (error) {if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;}
  }
}
export async function json<T>(file: string): Promise<T> {await noSymlinks(file); return JSON.parse(await readFile(file,'utf8')) as T;}
export async function rules() {
  const result = {} as Record<Platform, PlatformRules>;
  for (const p of platforms) result[p] = await json(path.join(root,'.agents/skills/resume-tailor/templates/platforms/render',p+'.json'));
  return result;
}
export async function check(file: string, workspace?: string, verifySources=true, savedRules?:Record<Platform,PlatformRules>): Promise<Checked> {
  const raw = await json<Presentation|ResumePackage>(file);
  const registry = savedRules??await rules();
  const bundle=raw.schema==='career-resume-package/v1'?raw:undefined;
  if(bundle){
    const valid=new Ajv({allErrors:true,strict:false}).compile(await json<object>(path.join(root,'schemas/resume-package.v1.schema.json')));
    if(!valid(bundle))throw new Error('简历包格式错误：'+JSON.stringify(valid.errors));
    if(!Number.isFinite(Date.parse(bundle.created_at))||!Number.isFinite(Date.parse(bundle.updated_at)))throw new Error('简历包时间无效');
  }
  const input = bundle?projectPackage(bundle,registry):raw as Presentation;
  const schema = await json<object>(path.join(root,'schemas/presentation.v1.schema.json'));
  const validate = new Ajv({allErrors:true,strict:false}).compile(schema);
  if (!validate(input) && !bundle) throw new Error('内容包格式错误：\n' + validate.errors?.map(e => `${e.instancePath || '/'} ${e.message}`).join('\n'));
  if (!Number.isFinite(Date.parse(input.generated_at))) throw new Error('generated_at 必须是有效时间戳');
  const warnings: Issue[] = [];
  const seen = new Set<string>();
  const unique = (id:string) => {if(seen.has(id)) throw new Error('重复 ID：'+id); seen.add(id);};
  for (const section of input.resume.sections) {unique(section.id); for(const item of section.items) unique(item.id);}
  const checkUrl=(url:string|undefined,location:string)=>{if(bundle&&url!==undefined&&!url.trim())return;if(url!==undefined&&!isWebUrl(url))throw new Error('无效网页链接：'+location+'；请使用完整 HTTP(S) 网址');};
  input.resume.contacts.forEach((c,i)=>checkUrl(c.url,`resume.contacts[${i}].url`));
  for(const section of input.resume.sections)for(const item of section.items)item.links?.forEach((link,i)=>checkUrl(link.url,`${section.id}/${item.id}/links[${i}]`));
  const commonIds=new Set<string>();
  for(const section of input.common?.sections??[]){
    if(commonIds.has(section.id))throw new Error('通用资料重复分组 ID：'+section.id);commonIds.add(section.id);
    section.fields.forEach((field,i)=>checkUrl(field.url,`common/${section.id}/fields[${i}]`));
  }
  for (const [p, report] of Object.entries(input.reports)) {
    const rule = registry[p as Platform]; const sectionIds = new Set<string>();
    for (const section of report.sections) {
      if(sectionIds.has(section.id)) throw new Error(`${p} 重复分组 ID：${section.id}`); sectionIds.add(section.id);
      const fieldIds = new Set<string>();
      for (const field of section.fields) {
        const location = `/reports/${p}/${section.id}/${field.key}`;
        if(fieldIds.has(field.key)) throw new Error('重复字段：'+location); fieldIds.add(field.key);
        const fieldRule = rule.fields[section.kind+'.'+field.key];
        if (!fieldRule) throw new Error('平台未支持的字段：'+location);
        const length = Array.from(field.value).length;
        if((fieldRule.max !== null && length > fieldRule.max) || (fieldRule.min !== undefined && length < fieldRule.min)) {
          warnings.push({code:'LENGTH_REVIEW',path:location,message:`${fieldRule.label}参考计数 ${length}，页面范围 ${fieldRule.min ?? 0}–${fieldRule.max ?? '未知'}；请 Agent 调整。平台计数算法未实测。`});
        }
      }
    }
    warnings.push({code:'PARTIAL_PLATFORM',path:'/reports/'+p,message:rule.coverage});
  }
  for (const p of platforms) if(!input.reports[p]) warnings.push({code:'MISSING_PLATFORM',path:'/reports/'+p,message:`尚未生成${registry[p].name}填写稿`});
  if (!input.source.files.length && !input.synthetic && !bundle) throw new Error('真实内容包必须声明至少一份来源文件及 SHA-256');
  if (verifySources && input.source.files.length && !workspace) throw new Error('核对来源文件需要 --workspace <目录>');
  for(const source of input.source.files) {
    if(path.isAbsolute(source.path) || source.path.split(/[\\/]/).some(x=>x==='..')) throw new Error('来源路径必须在工作区内');
    if(!verifySources) continue;
    const base = await realpath(workspace!); const target = path.resolve(base, source.path);
    if(!target.startsWith(base+path.sep)) throw new Error('来源路径越界');
    await noSymlinks(target);
    try {if(hash(await readFile(target)) !== source.sha256)throw new Error('摘要变化');}
    catch(e){if(!bundle)throw new Error(`来源已变化或缺失：${source.path}。请核对并重新生成内容包。`);warnings.push({code:'SOURCE_CHANGED',path:source.path,message:'原始资料已变化或缺失；当前简历内容保留，更新前请核对。'});}
  }
  const assets:ResolvedAssets={};
  if(input.resume.photo) {
    const photo=input.resume.photo;
    if(path.isAbsolute(photo.path)||photo.path.includes('\\')||photo.path.split('/').some(p=>p==='..')||/^[a-z]+:/i.test(photo.path))throw new Error('照片路径必须相对工作区，不能使用远程 URL');
    if(verifySources) {
      if(!workspace)throw new Error('读取照片需要 --workspace <目录>');
      const base=await realpath(workspace),target=path.resolve(base,photo.path);
      if(!target.startsWith(base+path.sep))throw new Error('照片路径越界');
      await noSymlinks(target);const info=await stat(target);
      if(!info.isFile()||info.size>5*1024*1024)throw new Error('照片需为不超过 5 MiB 的 PNG/JPEG 文件');
      const bytes=await readFile(target);
      if(hash(bytes)!==photo.sha256)throw new Error('照片已变化，请核对并更新内容包');
      const png=bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.subarray(12,16).toString()==='IHDR';
      const jpeg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
      if(!png&&!jpeg)throw new Error('照片仅支持 PNG/JPEG 文件');
      assets.photo={dataUrl:`data:image/${png?'png':'jpeg'};base64,${bytes.toString('base64')}`,alt:photo.alt,x:photo.position?.x??50,y:photo.position?.y??50};
    }
  }
  return {input,bundle,rules:registry,warnings,assets};
}
export async function readDefaultTheme(workspace: string): Promise<Theme|null> {
  try {const value=await json<{presentation?:{default_theme?:Theme}}>(path.join(workspace,'career.json'));return themes.includes(value.presentation?.default_theme as Theme)?value.presentation!.default_theme!:null;}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
}
export async function readPreference(workspace: string, resumeId?:string): Promise<Theme> {
  if(resumeId){
    try {
      const config=await json<{presentation?:{resume_themes?:Record<string,Theme>}}>(path.join(workspace,'career.json'));
      const saved=config.presentation?.resume_themes?.[resumeId];
      if(saved&&themes.includes(saved))return saved;
    }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  }
  return (await readDefaultTheme(workspace))??'classic';
}
export async function savePreference(workspace: string, theme: Theme|null, resumeId?:string) {
  if(theme!==null&&!themes.includes(theme))throw new Error('未知样式');
  if(resumeId!==undefined&&!/^[a-z][a-z0-9-]{0,79}$/.test(resumeId))throw new Error('无效简历 ID');
  await noSymlinks(workspace); await mkdir(workspace,{recursive:true});
  const file = path.join(workspace,'career.json'), lock = file+'.presentation-lock';
  await noSymlinks(file); await writeFile(lock,'presentation preference\n',{flag:'wx'});
  const temp=file+'.'+randomUUID()+'.tmp';
  try {
    let old:string|null=null; try {old=await readFile(file,'utf8');} catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e;}
    const data=old===null ? {schema:'career-workspace/v1',resume_dir:'resume',locale:'zh-CN'} : JSON.parse(old);
    if(data.schema!=='career-workspace/v1') throw new Error('不支持的工作区配置版本');
    data.presentation={...data.presentation};
    if(resumeId){
      data.presentation.resume_themes={...data.presentation.resume_themes};
      if(theme===null)delete data.presentation.resume_themes[resumeId];else data.presentation.resume_themes[resumeId]=theme;
    }else if(theme===null)delete data.presentation.default_theme;else data.presentation.default_theme=theme;
    await writeFile(temp,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
    let latest:string|null=null; try {latest=await readFile(file,'utf8');} catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e;}
    if(latest!==old) throw new Error('配置已被其他进程修改，请重试');
    await rename(temp,file);
  } finally {await rm(temp,{force:true});await rm(lock,{force:true});}
}
