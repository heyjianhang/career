import {hash} from '../presentation/io.js';
import {checkedInput,checkedDraft} from '../ai/contracts.js';
import {locked,commitFiles} from './transactions.js';
import {entries,safe,existing,parseRecord,encode,now} from './files.js';
import {validate} from './validation.js';
import {stages,outcomes} from './types.js';

export async function importJD(workspace:string,value:unknown){
 const v=value as Record<string,any>;
 if(!v||typeof v.request_id!=='string'||!/^[a-f0-9-]{36}$/.test(v.request_id))throw new Error('导入请求标识无效。');
 const source=checkedInput(v.source),draft=checkedDraft(v.draft);
 if(!draft.company.trim()||!draft.title.trim()||!draft.raw_text.trim())throw new Error('请补充公司、职位名称和 JD 正文。');
 const stage=typeof v.stage==='string'?v.stage:'inbox';if(!Object.hasOwn(stages,stage))throw new Error('岗位阶段无效。');
 if(stage==='ended'&&!Object.hasOwn(outcomes,v.outcome))throw new Error('请为已结束的岗位选择结果。');
 const url=typeof v.url==='string'?v.url.trim():'';
 if(url.length>2000)throw new Error('来源链接过长。');
 const sources=await validate('create',{company:draft.company.trim(),title:draft.title.trim(),sources:[{platform:v.platform||'other',...(url?{url}:{}),captured_at:now()}]});
 const fingerprint=hash(Buffer.from(JSON.stringify([source.text,source.images.map(i=>i.data)])));
 return locked(workspace,async()=>{
  const op='opp-'+v.request_id;
  for(const entry of await entries(workspace,'opportunities')){
   if(!entry.isDirectory()||entry.isSymbolicLink()||!entry.name.startsWith('opp-'))continue;
   const p=`opportunities/${entry.name}/card.md`,bytes=await existing(await safe(workspace,p));if(!bytes)continue;
   const card=await parseRecord(bytes,p,'card');
   const imported=card.meta.extensions?.jd_import as {fingerprint?:string}|undefined;
   if(entry.name===op||imported?.fingerprint===fingerprint||(url&&card.meta.sources.some(s=>s.url===url)))return {id:entry.name,duplicate:true};
  }
  const at=now(),root=`opportunities/${op}/`,attachments=source.images.map((i,index)=>{const ext=i.data.startsWith('data:image/jpeg;')?'jpg':i.data.startsWith('data:image/webp;')?'webp':'png';return {path:root+`attachments/jd-${index+1}.${ext}`,bytes:Buffer.from(i.data.split(',')[1]!,'base64'),old:null};});
  if(source.text)attachments.push({path:root+'attachments/source.txt',bytes:Buffer.from(source.text),old:null});
  const meta=await validate('card',{schema:'career-opportunity/v1',id:op,company:sources.company,title:sources.title,location:draft.location.trim()||null,salary:draft.salary.trim()||null,stage,user_rating:null,sources:sources.sources,recommendation:null,next_action:null,links:[],archived_reason:null,archived:false,outcome:stage==='ended'?v.outcome:null,created_at:at,updated_at:at,extensions:{jd_import:{fingerprint,method:source.images.length?'image-transcription':'pasted-text',reviewed_at:at,original_files:attachments.map(f=>f.path.slice(root.length)),warnings:draft.warnings}}});
  const body='';
  const doc='# 岗位原文\n\n> '+(source.images.length?'由岗位截图识别，经用户核对；识别内容可能有误，以原始截图为准。':'从粘贴文字导入，经用户核对；粘贴原文保存在资料中。')+'\n\n'+draft.raw_text+'\n';
  await commitFiles(workspace,op,[{path:root+'card.md',bytes:encode(meta,body),old:null},{path:root+'job.md',bytes:Buffer.from(doc),old:null},...attachments],'核对并导入 JD','user');
  return {id:op,duplicate:false};
 });
}
