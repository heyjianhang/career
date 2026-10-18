import {readFileSync} from 'node:fs';
import {escape} from '../escape.js';
import {resumeBlocks} from '../content.js';
import {contactValue,itemLinks} from '../links.js';
import type {ResumeTemplate, TemplateInput} from './registry.js';
import type {ResumeItem} from '../types.js';

type Layout = 'inline' | 'grid' | 'left' | 'center';
type Design = {
  id:string; name:string; reference:string; color:string; layout:Layout;
  heading:'plain'|'tab'|'dot'|'rule'|'arrow'|'ring'|'band'|'squares'|'bar'|'ribbon'|'short-rule';
  masthead?:'english'|'ribbon'|'bar'|'line'; round?:boolean;
};

// Stable IDs: one content contract, independently selectable visual treatments.
const designs:Design[] = [
  {id:'mono-line',name:'黑白细线',reference:'JLB00116',color:'#333333',layout:'inline',heading:'plain'},
  {id:'blue-tab',name:'蓝色标签',reference:'JLB00101',color:'#4975ba',layout:'grid',heading:'tab'},
  {id:'teal-dot',name:'青绿圆点',reference:'JLB00109',color:'#477a73',layout:'inline',heading:'dot',round:true},
  {id:'blue-rule',name:'蓝色横线',reference:'JLB00114',color:'#496b99',layout:'inline',heading:'rule'},
  {id:'navy-tag',name:'深蓝标签',reference:'JLB00107',color:'#2a56a1',layout:'inline',heading:'arrow'},
  {id:'slate-header',name:'浅灰页头',reference:'JLB00115',color:'#626466',layout:'left',heading:'ring',masthead:'line',round:true},
  {id:'taupe-band',name:'暖灰分区',reference:'JLB00130',color:'#837a73',layout:'inline',heading:'band',masthead:'english'},
  {id:'skyline',name:'城市横幅',reference:'JLB00108',color:'#31597a',layout:'center',heading:'squares',round:true},
  {id:'graphite-bar',name:'灰色条带',reference:'JLB00128',color:'#55585b',layout:'grid',heading:'bar',masthead:'bar'},
  {id:'blue-ribbon',name:'蓝色缎带',reference:'JLB00102',color:'#105e8c',layout:'inline',heading:'ribbon',masthead:'ribbon'},
  {id:'taupe-ring',name:'暖灰圆环',reference:'JLB00113',color:'#837a73',layout:'left',heading:'ring',masthead:'line',round:true},
  {id:'navy-rule',name:'深蓝短线',reference:'JLB00131',color:'#2b4d66',layout:'inline',heading:'short-rule'}
];
const commonCss=readFileSync(new URL('./selected.css',import.meta.url),'utf8');
const variants=readFileSync(new URL('./variants.css',import.meta.url),'utf8');
const icons = Object.fromEntries(['record-circle-fill','front'].map(name=>[name,
  readFileSync(new URL(`./assets/bootstrap-icons/${name}.svg`,import.meta.url),'utf8')
    .replace('<svg ', '<svg aria-hidden="true" focusable="false" ')
]));
const heading=(title:string,d:Design)=>title?`<h2 class="design-heading" data-heading="${d.heading}">${['dot','ring','squares'].includes(d.heading)?icons[d.heading==='squares'?'front':'record-circle-fill']:''}<span>${escape(title)}</span></h2>`:'';

// Infer presentation only from the supplied structure, never from section names.
// A dated paragraph remains a paragraph in the saved content; no fields are rewritten.
function listLayout(items:ResumeItem[]):'facts'|'dated'|undefined {
  if(!items.length||items.some(i=>!i.title||i.subtitle||i.technologies||i.page_break_before||i.bullets.length||i.links?.length||i.title.length>48||/[\r\n]/.test(i.title)||
    i.paragraphs.length>1||i.paragraphs.some(p=>p.length>180||/[\r\n]/.test(p))||
    (i.period?i.paragraphs.length>0:i.paragraphs.length!==1)))return;
  const date=(value:string)=>/\d{4}/.test(value)&&/^[\d\s年月至今现在./—–~～-]+$/.test(value)&&value.length<=24;
  return items.every(i=>i.period||date(i.paragraphs[0]!))?'dated':'facts';
}

function section(d:Design,s:TemplateInput['resume']['sections'][number]) {
  const layout=listLayout(s.items);
  const keep=layout&&s.items.length<=6&&s.items.reduce((n,i)=>n+i.title.length+(i.period?.length??0)+i.paragraphs.join('').length,0)<=500;
  const items=s.items.map(i=>{
    if(layout)return `<div class="design-item design-fact"><h3>${escape(i.title)}</h3><p>${escape(i.period??i.paragraphs[0]!)}</p></div>`;
    return `<div class="design-item" data-entry-id="${escape(i.id)}"${i.page_break_before?' data-break-before="true"':''}>${i.title||i.period||i.subtitle?`<div class="design-item-heading">${i.period?`<span class="design-period">${escape(i.period)}</span>`:''}${i.title?`<h3>${escape(i.title)}</h3>`:''}${i.subtitle?`<div class="design-subtitle">${escape(i.subtitle)}</div>`:''}</div>`:''}${i.technologies?`<p class="resume-technologies">${escape(i.technologies)}</p>`:''}${itemLinks(i.links)}${i.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}${i.bullets.length?`<ul>${i.bullets.map(b=>`<li>${escape(b)}</li>`).join('')}</ul>`:''}</div>`;
  }).join('');
  return `<section class="design-section"${layout?` data-layout="${layout}"`:''}${keep?' data-keep-together="true"':''}>${heading(s.title,d)}${items}</section>`;
}

function render(d:Design,{resume:r,assets,synthetic}:TemplateInput) {
  const photo=assets.photo;
  const portrait=photo?`<div class="design-photo-frame"><img class="resume-photo" src="${photo.dataUrl}" alt="${escape(photo.alt)}" style="object-position:${photo.x}% ${photo.y}%;transform:scale(${photo.zoom??1});transform-origin:${photo.x}% ${photo.y}%" width="112" height="140"></div>`:'';
  const contacts=r.contacts.length?`<dl class="design-contacts">${r.contacts.map(c=>`<div>${c.label?`<dt>${escape(c.label)}</dt>`:''}<dd>${contactValue(c)}</dd></div>`).join('')}</dl>`:'';
  const grid=d.layout==='grid';
  const masthead=d.masthead?`<div class="design-masthead" data-masthead="${d.masthead}" aria-hidden="true">${d.masthead==='english'?'PERSONAL RESUME':d.masthead==='ribbon'?'Personal Resume':d.masthead==='bar'?'<span>个人简历</span>':''}</div>`:'';
  return `${masthead}${grid&&d.id!=='graphite-bar'?heading('基本信息',d):''}<header class="design-header" data-layout="${d.layout}" data-photo="${!!photo}">${portrait}<div class="design-identity">${synthetic?'<div class="design-synthetic">虚构示例</div>':''}<h1>${grid?'<small>姓名</small>':''}${escape(r.name)}</h1>${grid?`${r.headline?`<p class="design-role"><small>求职方向</small>${escape(r.headline)}</p>`:''}${contacts}`:`${contacts}${r.headline?`<p class="design-role">${escape(r.headline)}</p>`:''}`}</div></header>${resumeBlocks(r).map(block=>block.kind==='summary'?`<section class="design-section">${heading(block.title,d)}${block.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</section>`:section(d,block.section)).join('')}`;
}

export const selectedTemplates:ResumeTemplate[] = designs.map(d=>{
  const selector=`.resume-paper[data-template="${d.id}"]`;
  return {id:d.id,name:d.name,version:5,description:d.name,tags:['单栏','A4',d.reference,d.round?'圆形照片':'证件照'],photo:'optional',
    css:`${selector}{--design-accent:${d.color}}\n`+commonCss.replaceAll('&',selector),
    render:input=>render(d,input)};
});

// Variant rules are already fully scoped. Kept once rather than repeated per template.
selectedTemplates.at(-1)!.css+='\n'+variants;
const skylineData=readFileSync(new URL('./assets/skyline.jpg',import.meta.url)).toString('base64');
selectedTemplates.find(t=>t.id==='skyline')!.css+=`\n.resume-paper[data-template="skyline"] .design-header{background-image:url("data:image/jpeg;base64,${skylineData}")}`;
