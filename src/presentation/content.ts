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
      period:hasText(i.period)?i.period:undefined,paragraphs:i.paragraphs.filter(hasText),
      bullets:i.bullets.filter(hasText),links:visibleLinks(i.links)
    })).filter(i=>i.title||i.subtitle||i.period||i.paragraphs.length||i.bullets.length||i.links.length)}))
      .filter(s=>s.items.length)};
}
