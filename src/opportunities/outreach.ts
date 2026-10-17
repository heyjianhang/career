import path from 'node:path';
import {Ajv,type ValidateFunction} from 'ajv';
import MarkdownIt from 'markdown-it';
import {root,json} from '../presentation/io.js';
import {decode} from './files.js';
import {show,readDocument} from './store.js';
import {readResume} from '../resumes/store.js';

export const outreachPath='analysis/outreach.md';
type Metadata={schema:string;opportunity_id:string;resume_id:string;resume_sha256:string;jd_sha256:string;generated_at:string;channel:string};
export type Outreach={exists:boolean;path:string;sha256?:string;state:'missing'|'current'|'stale'|'invalid'|'unverified';warnings:string[];meta?:Metadata;variants:{label:string;text:string}[]};
const ajv=new Ajv({allErrors:true,strict:false});
const markdown=new MarkdownIt({html:false,linkify:false});
let validation:Promise<ValidateFunction<Metadata>>|undefined;
function metadataValidator(){
 return validation??=json<object>(path.join(root,'schemas/outreach.v1.schema.json')).then(schema=>ajv.compile<Metadata>(schema));
}

// Only the explicitly named, plain-text sections are copyable. Rationale and
// metadata remain in the document; malformed sections never fall back to copying it all.
export function outreachVariants(body:string){
 const tokens=markdown.parse(body,{}),variants:{label:string;text:string}[]=[];
 const seen=new Set<string>();
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i]!,label=tokens[i+1]?.content??'';
  if(token.type!=='heading_open'||token.level!==0||token.tag!=='h2'||!['推荐稿','简短版'].includes(label))continue;
  if(seen.has(label))throw new Error('打招呼稿有重复的正文标题，请先整理文档');
  seen.add(label);let text='';
  for(let j=i+3;j<tokens.length;j++){
   const part=tokens[j]!;
   if(part.type==='heading_open'&&part.level===0)break;
   if(part.type==='inline'&&part.level===1){
    if(part.children?.some(c=>!['text','softbreak','hardbreak'].includes(c.type)))throw new Error('打招呼正文请使用普通文本段落');
    text+=(text?'\n\n':'')+(part.children??[]).map(c=>c.type==='text'?c.content:'\n').join('');
   }else if(!['paragraph_open','paragraph_close'].includes(part.type))throw new Error('打招呼正文请使用普通文本段落');
  }
  if(!text.trim()||text.length>6000)throw new Error('打招呼正文为空或过长，请先整理文档');
  variants.push({label,text:text.trim()});
 }
 if(!seen.has('推荐稿'))throw new Error('尚未找到可复制的推荐稿，请让 Agent 整理格式');
 return variants;
}

export async function readOutreach(w:string,op:string):Promise<Outreach>{
 const detail=await show(w,op);
 const base={exists:false,path:outreachPath,state:'missing' as const,warnings:[],variants:[]};
 if(!detail.files.some(f=>f.path===`opportunities/${op}/${outreachPath}`))return base;
 const doc=await readDocument(w,op,outreachPath);
 const result:Outreach={...base,exists:true,sha256:doc.sha256,state:'invalid'};
 try{
  const parsed=decode(Buffer.from(doc.content),outreachPath);
  const validate=await metadataValidator();
  if(!validate(parsed.meta))throw new Error('草稿的岗位、简历版本或生成时间不完整，请让 Agent 核对');
  const meta=parsed.meta as Metadata;
  if(!Number.isFinite(Date.parse(meta.generated_at)))throw new Error('草稿的生成时间无效，请先核对');
  if(meta.opportunity_id!==op)throw new Error('这份草稿属于另一岗位，请先核对');
  result.variants=outreachVariants(parsed.body);result.meta=meta;result.state='current';
  if(detail.card.meta.resume?.id!==meta.resume_id){result.state='stale';result.warnings.push(detail.card.meta.resume?'关联简历已更换，请核对草稿':'当前未关联这份简历，请先确认投递版本');}
  const checks=await Promise.allSettled([readDocument(w,op,'job.md'),readResume(w,meta.resume_id)]);
  for(const [i,check] of checks.entries()){
   if(check.status==='rejected'){if(result.state==='current')result.state='unverified';result.warnings.push(i===0?'JD 暂时无法读取，未能核对版本':'所用简历暂时无法读取，未能核对版本');}
   else if(check.value.sha256!==(i===0?meta.jd_sha256:meta.resume_sha256)){result.state='stale';result.warnings.push(i===0?'JD 已更新，请核对草稿':'简历内容已更新，请核对草稿');}
  }
 }catch(e){result.variants=[];result.warnings=[(e as Error).message];}
 return result;
}
