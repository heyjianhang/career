import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {savePresentation,CommandError} from '../agent-api.js';
import {listPresentations,presentationDirectory} from '../presentation/collection.js';
import {hash,noSymlinks,check,readPreference} from '../presentation/io.js';
import {blankPackage,importLegacy,type ResumePackage} from './model.js';
import {overview,show,assignResume,recordSubmission,attach} from '../opportunities/store.js';
import {html} from '../presentation/render.js';
import {themes} from '../presentation/io.js';

export async function readResume(w:string,id:string){
 if(!/^[a-z][a-z0-9-]{0,79}$/.test(id))throw new CommandError('INVALID_ARGUMENT','无效简历 ID');
 const entry=(await listPresentations(w)).entries.find(e=>e.id===id);if(!entry)throw new CommandError('NOT_FOUND','简历不存在或内容需要修正：'+id);
 await noSymlinks(entry.file);const bytes=await readFile(entry.file);const data=JSON.parse(bytes.toString());return {...entry,sha256:hash(bytes),package:data,editable:data.schema==='career-resume-package/v1'};
}
export async function library(w:string){
 const listed=await listPresentations(w),board=await overview(w);
 const entries=await Promise.all(listed.entries.map(async e=>{const r=await readResume(w,e.id);return {id:e.id,title:e.title,updated_at:e.generated_at,sha256:r.sha256,theme:await readPreference(w,e.id),editable:r.editable,name:r.editable?r.package.content.profile.name:r.package.resume.name,headline:r.editable?r.package.content.profile.headline:r.package.resume.headline,synthetic:r.package.synthetic,href:`/resumes/${e.id}/index.html`,jobs:board.cards.filter(c=>c.resume?.id===e.id).map(c=>({id:c.id,title:c.title,company:c.company,stage:c.stage,archived:c.archived})),submission_count:board.cards.reduce((n,c)=>n+(c.submissions??[]).filter((s:any)=>s.resume_id===e.id).length,0)};}));
 return {entries,warnings:[...listed.warnings,...board.issues]};
}
export async function savePackage(w:string,data:ResumePackage,expected?:string){
 if(data.schema!=='career-resume-package/v1')throw new CommandError('INVALID_ARGUMENT','网页编辑使用统一简历包；旧内容包请先复制为可编辑版');
 const candidate=structuredClone(data);
 let previous:Awaited<ReturnType<typeof readResume>>|undefined;
 try{previous=await readResume(w,data.id);}catch(e){if(!(e instanceof CommandError)||e.code!=='NOT_FOUND')throw e;}
 if(previous&&!previous.editable)throw new CommandError('PACKAGE_CONFLICT','旧包请另存为可编辑副本，不在原 ID 上转换');
 candidate.updated_at=previous?.package.updated_at??candidate.updated_at;
 if(!previous||JSON.stringify(candidate)!==JSON.stringify(previous.package))candidate.updated_at=new Date().toISOString();
 const tmp=path.join(w,'.local','resume-candidates',randomUUID()+'.json');await noSymlinks(tmp);await mkdir(path.dirname(tmp),{recursive:true});
 try{await writeFile(tmp,JSON.stringify(candidate));return await savePresentation(tmp,w,expected);}finally{await rm(tmp,{force:true});}
}
export async function createResume(w:string,title:string,from?:string){
 if(typeof title!=='string'||!title.trim()||title.length>160)throw new CommandError('INVALID_ARGUMENT','请输入 1–160 字的简历名称');
 const id='resume-'+randomUUID();let data=blankPackage(id,title.trim());
 if(from){const old=await readResume(w,from);data=old.editable?{...structuredClone(old.package),id,title:title.trim(),created_at:data.created_at,updated_at:data.updated_at}:importLegacy(old.package,id,title.trim());data.derived_from={id:from,sha256:old.sha256};}
 return savePackage(w,data);
}
export async function resumeRelations(w:string,id:string){await readResume(w,id);const b=await overview(w);return {id,jobs:b.cards.filter(c=>c.resume?.id===id),submissions:b.cards.flatMap(c=>(c.submissions??[]).filter((s:any)=>s.resume_id===id).map((s:any)=>({...s,opportunity_id:c.id,company:c.company,job_title:c.title}))),issues:b.issues};}
export async function selectResume(w:string,op:string,id:string|null,expected:string,actor='agent'){
 const r=id?await readResume(w,id):null;return assignResume(w,op,r?{id:r.id,path:path.relative(w,r.file).split(path.sep).join('/')}:null,expected,actor);
}
export async function submitResume(w:string,op:string,input:{resume_id:string;resume_sha256:string;submitted_at:string;channel:string;theme:string;confirmed:boolean},expected:string,actor='agent'){
 if(input.confirmed!==true)throw new CommandError('CONFIRM_REQUIRED','仅在用户确认实际投递后记录；关联或导出不等于投递');
 if(!Number.isFinite(Date.parse(input.submitted_at))||!input.channel?.trim()||input.channel.length>100||!themes.includes(input.theme))throw new CommandError('INVALID_ARGUMENT','请填写投递时间、渠道及有效样式');
 const d=await show(w,op);if(d.card.sha256!==expected)throw new CommandError('RECORD_CONFLICT','岗位已改变，请重新读取');
 const r=await readResume(w,input.resume_id);if(r.sha256!==input.resume_sha256)throw new CommandError('PACKAGE_CONFLICT','简历内容已改变，请核对实际投递版本');
 const checked=await check(r.file,w),snapshotHtml=await html(checked,input.theme,false);
 // Check again after rendering so the receipt cannot pair different content and hash.
 if(hash(await readFile(r.file))!==r.sha256)throw new CommandError('PACKAGE_CONFLICT','生成快照期间简历已改变');
 const key='submission-'+randomUUID(),tmp=path.join(w,'.local',key+'.json');await noSymlinks(tmp);await mkdir(path.dirname(tmp),{recursive:true});
 try{
  await writeFile(tmp,JSON.stringify({schema:'career-submission/v1',package:r.package,html:snapshotHtml,theme:input.theme,submitted_at:input.submitted_at,channel:input.channel}));
  const saved=await attach(w,op,tmp,key+'.json',actor);
  return await recordSubmission(w,op,{id:key,resume_id:r.id,resume_title:r.title,resume_sha256:r.sha256,submitted_at:input.submitted_at,channel:input.channel,theme:input.theme,snapshot:saved.path,sha256:saved.sha256},expected,actor);
 }finally{await rm(tmp,{force:true});}
}
export async function submissionHtml(w:string,op:string,key:string){
 const d=await show(w,op),s=(d.card.meta.submissions??[]).find((x:any)=>x.id===key);if(!s)throw new CommandError('NOT_FOUND','投递记录不存在');
 if(typeof s.snapshot!=='string'||s.snapshot!==`opportunities/${op}/attachments/${key}.json`||!/^submission-[a-z0-9-]+$/.test(key))throw new Error('无效快照路径');
 const file=path.join(w,s.snapshot);await noSymlinks(file);const bytes=await readFile(file);if(hash(bytes)!==s.sha256)throw new Error('投递快照已改变，请核对原始文件');
 const saved=JSON.parse(bytes.toString());if(saved.schema!=='career-submission/v1'||typeof saved.html!=='string')throw new Error('无效投递快照');return saved.html as string;
}
