import type {Contact, ResumeContent, WebLink} from './types.js';

const hasText=(value:string|undefined)=>!!value?.trim();
/** Display copies only: unfinished editor rows remain in the saved source. */
export function visibleContacts(fields:Contact[]):Contact[] {
  return fields.filter(f=>hasText(f.value)||hasText(f.url)).map(f=>({...f,
    label:hasText(f.label)?f.label:'',value:hasText(f.value)?f.value:f.url!,
    url:hasText(f.url)?f.url:undefined}));
}
export function visibleLinks(links?:WebLink[]):WebLink[] {
  return (links??[]).filter(l=>hasText(l.url)).map(l=>({...l,label:hasText(l.label)?l.label:l.url}));
}
export function visibleResume(resume:ResumeContent):ResumeContent {
  return {...resume,headline:hasText(resume.headline)?resume.headline:'',
    contacts:visibleContacts(resume.contacts),summary:resume.summary.filter(hasText),
    sections:resume.sections.map(s=>({...s,title:hasText(s.title)?s.title:'',items:s.items.map(i=>({...i,
      title:hasText(i.title)?i.title:'',subtitle:hasText(i.subtitle)?i.subtitle:undefined,
      period:hasText(i.period)?i.period:undefined,technologies:hasText(i.technologies)?i.technologies:undefined,paragraphs:i.paragraphs.filter(hasText),
      bullets:i.bullets.filter(hasText),links:visibleLinks(i.links)
    })).filter(i=>i.title||i.subtitle||i.period||i.technologies||i.paragraphs.length||i.bullets.length||i.links.length)}))
      .filter(s=>s.items.length)};
}

/** Display labels and order are independent of entry kinds and platform mapping. */
export function resumeBlocks(resume:ResumeContent){
 type Block={ref:string;kind:'summary';title:string;paragraphs:string[]}|{ref:string;kind:'section';section:ResumeContent['sections'][number]};
 const blocks:Block[]=resume.sections.map(section=>({ref:section.id.startsWith('common-')?'common:'+section.id.slice(7):'section:'+section.id,kind:'section',section}));
 // Match explicit section IDs first, including a user-defined ID beginning with common-.
 for(const block of blocks)if(block.kind==='section'&&resume.layout?.sectionOrder?.includes('section:'+block.section.id))block.ref='section:'+block.section.id;
 const order=resume.layout?.sectionOrder??[],ranks=new Map(order.map((ref,index)=>[ref,index]));
 if(resume.summary.length)blocks.unshift({ref:'summary',kind:'summary',title:resume.summary_title??'个人简介',paragraphs:resume.summary});
 return blocks.sort((a,b)=>{
  const rank=(block:Block)=>block.kind==='summary'&&!ranks.has('summary')?-1:ranks.get(block.ref)??Infinity;
  return rank(a)-rank(b);
 });
}
