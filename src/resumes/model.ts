import type {Presentation,ResumeContent,Contact,Platform,PlatformRules,Report,ResumeItem} from '../presentation/types.js';

export interface Experience {
  id:string; kind:'employment'|'project'|'education'|'other'; title:string; subtitle:string;
  start:string; end:string; current:boolean; company:string; qualification:string;
  description:string; responsibilities:string; achievements:string;
  links:{label:string;url:string}[]; [key:string]:unknown;
}
export interface ResumePackage {
  schema:'career-resume-package/v1'; id:string; title:string; created_at:string; updated_at:string; synthetic:boolean;
  source:Presentation['source']; derived_from?:{id:string;sha256:string};
  content:{profile:{name:string;headline:string;contacts:Contact[];photo?:ResumeContent['photo'];[key:string]:unknown};summary:string;sections:{id:string;title:string;items:Experience[];[key:string]:unknown}[];common:{sections:{id:string;title:string;fields:Contact[]}[]};[key:string]:unknown};
  legacy?:{original:Presentation;review:string[]}; [key:string]:unknown;
}
export const join=(...values:(string|undefined)[])=>values.filter(v=>v?.trim()).join('\n\n');
const paragraphs=(text:string)=>text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
const lines=(text:string)=>text.split('\n').map(x=>x.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean);
export function blankPackage(id:string,title:string):ResumePackage {
 const now=new Date().toISOString();return {schema:'career-resume-package/v1',id,title,created_at:now,updated_at:now,synthetic:false,source:{resume_id:id,files:[]},content:{profile:{name:'',headline:'',contacts:[]},summary:'',sections:[],common:{sections:[]}}};
}
export function blankExperience(kind:Experience['kind'],id:string):Experience {return {id,kind,title:'',subtitle:'',start:'',end:'',current:false,company:'',qualification:'',description:'',responsibilities:'',achievements:'',links:[]};}
/** The one semantic document feeds every layout and supported platform field. No model is called. */
export function projectPackage(bundle:ResumePackage,registry:Record<Platform,PlatformRules>):Presentation {
 const c=bundle.content;
 const resume:ResumeContent={...c.profile,summary:paragraphs(c.summary),sections:c.sections.filter(s=>s.items.length).map(s=>({id:s.id,title:s.title,items:s.items.map(i=>({id:i.id,title:i.title,subtitle:join(i.subtitle,i.kind==='education'?i.qualification:'').replaceAll('\n\n',' · '),period:[i.start,i.current?'至今':i.end].filter(Boolean).join(' — ')||(typeof i.original_period==='string'?i.original_period:''),paragraphs:paragraphs(i.description),bullets:[...lines(i.responsibilities),...lines(i.achievements)],links:i.links}))}))};
 for(const section of c.common.sections){if(!section.fields.length)continue;resume.sections.push({id:'common-'+section.id,title:section.title,items:section.fields.map((f,i)=>({id:'common-'+section.id+'-'+i,title:f.label,paragraphs:[f.value],bullets:[],...(f.url?{links:[{label:f.label,url:f.url}]}:{})}))});}
 const reports:Presentation['reports']={};
 for(const [platform,rule] of Object.entries(registry)) {
  const sections:Report['sections']=[];
  const push=(id:string,kind:string,title:string,values:Record<string,string>)=>{
   const fields=Object.entries(values).filter(([key,value])=>value.trim()&&rule.fields[kind+'.'+key]).map(([key,value])=>({key,value}));
   if(fields.length)sections.push({id,kind,title,fields});
  };
  push('summary','summary','个人概述',{text:c.summary});
  for(const section of c.sections)for(const i of section.items){
   const when={start:i.start,end:i.current?'至今':i.end};
   const links=i.links.map(l=>`${l.label}：${l.url}`).join('\n');
   if(i.kind==='employment')push(i.id,i.kind,i.title,{company:i.title,title:i.subtitle,...when,content:join(i.description,i.responsibilities,rule.fields['employment.achievements']?'':i.achievements,links),achievements:i.achievements});
   if(i.kind==='project')push(i.id,i.kind,i.title,{name:i.title,role:i.subtitle,company:i.company,...when,description:join(!rule.fields['project.role']&&i.subtitle?`项目角色：${i.subtitle}`:'',!rule.fields['project.company']&&i.company?`所属公司：${i.company}`:'',i.description,rule.fields['project.responsibilities']?'':i.responsibilities,rule.fields['project.achievements']?'':i.achievements,links),responsibilities:i.responsibilities,achievements:i.achievements});
   if(i.kind==='education')push(i.id,i.kind,i.title,{school:i.title,major:i.subtitle,qualification:i.qualification,...when,description:join(i.description,i.responsibilities,i.achievements,links)});
  }
  reports[platform as Platform]={sections,notes:[]};
 }
 return {schema:'career-presentation/v1',id:bundle.id,title:bundle.title,generated_at:bundle.updated_at,synthetic:bundle.synthetic,source:bundle.source,resume,common:c.common,reports};
}
/** Legacy import is a new draft. Original per-platform wording stays embedded for review. */
export function importLegacy(old:Presentation,id:string,title:string):ResumePackage {
 const b=blankPackage(id,title);b.synthetic=old.synthetic;b.source=structuredClone(old.source);
 b.content.profile={name:old.resume.name,headline:old.resume.headline,contacts:structuredClone(old.resume.contacts),...(old.resume.photo?{photo:structuredClone(old.resume.photo)}:{})};b.content.summary=old.resume.summary.join('\n\n');b.content.common=structuredClone(old.common??{sections:[]});
 const all=Object.values(old.reports).flatMap(r=>r.sections);
 b.content.sections=old.resume.sections.map(s=>({id:s.id,title:s.title,items:s.items.map(i=>{
  const matching=all.filter(r=>r.id===i.id),kind=matching.find(r=>['employment','project','education'].includes(r.kind))?.kind as Experience['kind']|undefined;
  const item:Experience={...blankExperience(kind??'other',i.id),title:i.title,subtitle:i.subtitle??'',description:i.paragraphs.join('\n\n'),responsibilities:i.bullets.join('\n'),links:structuredClone(i.links??[])};
  // Only exact structured values are imported; original attachment text remains authoritative.
  const field=(key:string)=>matching.flatMap(r=>r.fields).find(f=>f.key===key)?.value??'';
  item.start=field('start');item.end=field('end');item.current=item.end==='至今';if(item.current)item.end='';item.company=field('company');item.qualification=field('qualification');
  if(kind==='education'&&field('major'))item.subtitle=field('major');
  if(!item.start&&!item.end&&i.period)item.original_period=i.period;
  return item;
 })}));
 b.legacy={original:structuredClone(old),review:['已按附件正文建立可编辑副本。旧平台稿可能有不同措辞，完整原包保存在 legacy.original；请核对后再投递。','未明确拆分的职责和成果保持原文，不推断日期或量化结果。']};
 return b;
}
