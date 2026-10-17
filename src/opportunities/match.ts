import path from 'node:path';
import {Ajv,type ValidateFunction} from 'ajv';
import {root,json} from '../presentation/io.js';
import {decode} from './files.js';
import {show,readDocument} from './store.js';
import {readResume} from '../resumes/store.js';

export type MatchCriterion={id:string;weight:number;score:number|null;evidence:string[];reason:string};
type Metadata={schema:string;opportunity_id:string;resume_id:string;resume_sha256:string;jd_sha256:string;assessed_at:string;summary:string;criteria:MatchCriterion[];hard_conditions:{label:string;status:'met'|'unmet'|'unknown';reason:string}[]};
export type MatchSummary={exists:boolean;state:'missing'|'unscored'|'current'|'stale'|'invalid'|'unverified';warnings:string[];meta?:Metadata;resumeTitle?:string;score?:{value:number|null;coverage:number;lower:number;upper:number}};
let validation:Promise<ValidateFunction<Metadata>>|undefined;
const round=(n:number)=>Math.round(n*100)/100;

// Same weighted 0–4 rubric as career-board's score-opportunity helper. Totals
// are calculated from evidence rows rather than trusting an authored total.
export function matchScore(criteria:MatchCriterion[]){
 let total=0,known=0,points=0;const ids=new Set<string>();
 for(const row of criteria){
  if(!row.id.trim()||ids.has(row.id))throw new Error('评分维度名称为空或重复，请核对分析');
  ids.add(row.id);
  if(!Number.isFinite(row.weight)||row.weight<=0||row.weight>100)throw new Error('评分权重无效，请核对分析');
  if(row.score!==null&&(!Number.isInteger(row.score)||row.score<0||row.score>4))throw new Error('单项评分须为 0–4，未知请留空');
  if(!row.reason.trim()||row.evidence.some(e=>!e.trim())||(row.score!==null&&!row.evidence.length))throw new Error('评分缺少依据或判断理由，请核对分析');
  total+=row.weight;if(row.score!==null){known+=row.weight;points+=row.weight*row.score;}
 }
 if(Math.abs(total-100)>0.000001)throw new Error('评分权重合计须为 100，未知项也要保留');
 const coverage=known/total*100,lower=points/(4*total)*100;
 return {value:known?round(points/(4*known)*100):null,coverage:round(coverage),lower:round(lower),upper:round(lower+100-coverage)};
}

export async function readMatchSummary(w:string,op:string):Promise<MatchSummary>{
 const detail=await show(w,op),result:MatchSummary={exists:false,state:'missing',warnings:[]};
 if(!detail.files.some(f=>f.path===`opportunities/${op}/analysis/match.md`))return result;
 result.exists=true;result.state='unscored';
 try{
  const doc=await readDocument(w,op,'analysis/match.md');
  // Legacy prose remains readable; never infer a number from prose or user stars.
  if(!/^---\r?\n/.test(doc.content))return result;
  const parsed=decode(Buffer.from(doc.content),'analysis/match.md');if(!parsed.meta||typeof parsed.meta!=='object'||!('schema' in parsed.meta))return result;
  const validate=await (validation??=json<object>(path.join(root,'schemas/match.v1.schema.json')).then(schema=>new Ajv({allErrors:true,strict:false}).compile<Metadata>(schema)));
  if(!validate(parsed.meta)||!Number.isFinite(Date.parse(parsed.meta.assessed_at as string)))throw new Error('总体评分的资料或版本信息不完整，请更新分析');
  const meta=parsed.meta as Metadata;if(meta.opportunity_id!==op)throw new Error('这份评分属于另一岗位，请核对分析');
  if(!meta.summary.trim()||meta.hard_conditions.some(c=>!c.label.trim()||!c.reason.trim()))throw new Error('总体结论或必要条件缺少说明');
  result.score=matchScore(meta.criteria);result.meta=meta;result.state='current';
  if(detail.card.meta.resume?.id!==meta.resume_id){result.state='stale';result.warnings.push(detail.card.meta.resume?'关联简历已更换，请重新分析':'尚未关联本次分析使用的简历，请先确认版本');}
  const checks=await Promise.allSettled([readDocument(w,op,'job.md'),readResume(w,meta.resume_id)]);
  for(const [i,check] of checks.entries()){
   if(check.status==='rejected'){if(result.state==='current')result.state='unverified';result.warnings.push(i===0?'职位描述暂时无法读取，未能核对评分':'所用简历暂时无法读取，未能核对评分');}
   else{
    if(i===1&&'package' in check.value)result.resumeTitle=check.value.package.title;
    if(check.value.sha256!==(i===0?meta.jd_sha256:meta.resume_sha256)){result.state='stale';result.warnings.push(i===0?'职位描述已更新，下方是上次分析结果':'简历内容已更新，下方是上次分析结果');}
   }
  }
 }catch(e){result.state='invalid';delete result.score;delete result.meta;result.warnings=[(e as Error).message];}
 return result;
}
