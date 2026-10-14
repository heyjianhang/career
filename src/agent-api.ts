import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile,writeFile,mkdir,rename,rm,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {check,hash,json,noSymlinks,root} from './presentation/io.js';
import {listPresentations,presentationDirectory} from './presentation/collection.js';

export class CommandError extends Error {
  constructor(public code:string,message:string,public details:unknown=null){super(message);}
}

// Reuse the v2 workspace tools: the CLI must not introduce a second data model.
export async function initializeWorkspace(workspace:string) {
  const {initialize}=await import(pathToFileURL(path.join(root,'scripts/init.mjs')).href);
  return await initialize(workspace) as {workspace:string;created:string[];preserved:string[]};
}
export async function inspectWorkspace(workspace:string) {
  const {validate}=await import(pathToFileURL(path.join(root,'scripts/validate.mjs')).href);
  const result=await validate(workspace) as {errors:string[];warnings:string[];records:{file:string;meta:{type:string;id:string}}[]};
  const counts:Record<string,number>={};
  for(const record of result.records)counts[record.meta.type]=(counts[record.meta.type]??0)+1;
  const {overview}=await import('./opportunities/store.js');
  let board:{total:number;issues:{path:string;message:string}[]};
  try{board=await overview(workspace);}catch(error){board={total:0,issues:[{path:'opportunities',message:(error as Error).message}]};}
  result.errors.push(...board.issues.map(issue=>issue.path+': '+issue.message));
  return {workspace,valid:result.errors.length===0,record_count:result.records.length,counts,opportunities:board,errors:result.errors,warnings:result.warnings};
}
export async function workspaceStatus(workspace:string) {
  await noSymlinks(workspace);
  const config=path.join(workspace,'career.json');
  try {await json(config);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {workspace,initialized:false,next_reads:[],next_command:'workspace init'};throw error;}
  const validation=await inspectWorkspace(workspace);
  const reads=['context/INDEX.md','context/state.md','resume/maintenance.md','resume/questions.md','resume/master/index.md','resume/master-preview.md'];
  const next_reads:string[]=[],missing_files:string[]=[];
  for(const relative of reads){const file=path.join(workspace,relative);await noSymlinks(file);try{if((await stat(file)).isFile())next_reads.push(file);else missing_files.push(relative);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;missing_files.push(relative);}}
  const presentations=await listPresentations(workspace);
  return {workspace,initialized:true,validation,next_reads,missing_files,presentations,
    board_command:'career board overview --json',completion:'not_assessed',guidance:'文件数量与结构有效不等于资料完整；读取维护清单和实际正文后判断进度。'};
}
export async function hashWorkspaceFile(workspace:string,relative:string) {
  if(path.isAbsolute(relative)||relative.includes('\\')||relative.split('/').includes('..')||/^[a-z]+:/i.test(relative))throw new CommandError('INVALID_PATH','--path 必须是工作区内的相对文件路径');
  const file=path.resolve(workspace,relative);
  if(!file.startsWith(path.resolve(workspace)+path.sep))throw new CommandError('INVALID_PATH','文件必须在工作区内');
  await noSymlinks(file);
  const bytes=await readFile(file);
  return {path:path.relative(workspace,file).split(path.sep).join('/'),sha256:hash(bytes),bytes:bytes.length};
}

/** Save Agent-authored, validated content; never generate wording or refresh provenance. */
export async function savePresentation(inputFile:string,workspace:string,expected?:string) {
  if(expected!==undefined&&!/^[a-f0-9]{64}$/.test(expected))throw new CommandError('INVALID_ARGUMENT','--if-match 必须是原内容包的 SHA-256');
  await noSymlinks(inputFile);
  if((await stat(inputFile)).size>16*1024*1024)throw new CommandError('PACKAGE_TOO_LARGE','内容包超过 16 MiB，无法纳入简历集合；请核对候选内容');
  const checked=await check(inputFile,workspace);
  const config=await json<{schema:string}>(path.join(workspace,'career.json'));
  if(config.schema!=='career-workspace/v1')throw new CommandError('INVALID_WORKSPACE','请先初始化有效工作区');
  const listed=await listPresentations(workspace),id=checked.input.id;
  const directory=path.join(await presentationDirectory(workspace),id),file=path.join(directory,'package.json');
  if(listed.entries.some(entry=>entry.id===id&&entry.file!==file)||listed.warnings.some(w=>w.code==='DUPLICATE_PACKAGE'&&w.path===id))throw new CommandError('PACKAGE_CONFLICT','其他目录已使用这个内容包 ID，请先核对：'+id);
  await noSymlinks(file);
  const readExisting=async()=>{try{return await readFile(file,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}};
  const content=JSON.stringify(checked.bundle??checked.input,null,2)+'\n';
  if(Buffer.byteLength(content)>16*1024*1024)throw new CommandError('PACKAGE_TOO_LARGE','内容包超过 16 MiB，无法纳入简历集合；请核对候选内容');
  const verify=(old:string|null)=>{
    if(expected!==undefined&&(!old||hash(old)!==expected))throw new CommandError('PACKAGE_CONFLICT','原内容包已改变或不存在；重新读取并合并后再保存');
    if(old!==null&&old!==content&&expected===undefined)throw new CommandError('PACKAGE_EXISTS','内容包已存在；核对原文件后，用 --if-match <原文件SHA-256> 保存更新',{file,sha256:hash(old)});
    if(old!==null){let oldId:string;try{oldId=JSON.parse(old).id;}catch{throw new CommandError('PACKAGE_CONFLICT','原内容包不是有效 JSON，请先核对');}if(oldId!==id)throw new CommandError('PACKAGE_CONFLICT','目录中的原内容包 ID 不同，不覆盖');}
  };
  verify(await readExisting());
  await mkdir(directory,{recursive:true});
  const lock=path.join(directory,'.save-lock');
  try{await writeFile(lock,'career resume save\n',{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw new CommandError('PACKAGE_BUSY','此内容包正在保存，请稍后重新读取再试');throw e;}
  const temporary=path.join(directory,'.package-'+randomUUID()+'.tmp');
  let backup:string|null=null;
  try {
    const old=await readExisting();verify(old);
    if(old===content)return {id,file,sha256:hash(content),changed:false,backup,warnings:checked.warnings};
    if(old!==null){const history=path.join(directory,'.history');await noSymlinks(history);await mkdir(history,{recursive:true});backup=path.join(history,randomUUID()+'.json');await writeFile(backup,old,{flag:'wx'});}
    await writeFile(temporary,content,{flag:'wx'});
    if(await readExisting()!==old)throw new CommandError('PACKAGE_CONFLICT','保存期间原文件发生变化；未覆盖，请重新读取');
    await rename(temporary,file);
    return {id,file,sha256:hash(content),changed:true,backup,warnings:checked.warnings};
  }finally{await rm(temporary,{force:true});await rm(lock,{force:true});}
}
