import {readFileSync} from 'node:fs';
import {escape} from '../escape.js';
import {resumeBlocks} from '../content.js';
import {contactValue,itemLinks} from '../links.js';
import type {ResumeTemplate,TemplateInput} from './registry.js';
import type {ResumeItem} from '../types.js';
const icon=(kind:string)=>{
 const paths:Record<string,string>={phone:'M6 3H3v4c0 7 7 14 14 14h4v-4l-5-2-2 2a17 17 0 0 1-7-7l2-2z',mail:'M3 5h18v14H3z M3 5l9 7 9-7',web:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2c-5 5-5 15 0 20 5-5 5-15 0-20',code:'M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18'};
 return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[kind]??paths.web}"/></svg>`;
};
// Only short lead-in labels are emphasized; arbitrary HTML is always escaped.
const prose=(s:string)=>escape(s).replace(/^([^：:·•]{2,14})([：:·•])\s*/, '<strong>$1</strong> $2 ');
function item(i:ResumeItem){
 const hasBody=i.paragraphs.length>0||i.bullets.length>0;
 // Keep only the heading stack together. Descriptions and bullets may flow across
 // pages. Each bullet flows independently; a short tail must not pull a whole pair forward.
 return `<div class="eng-item" data-entry-id="${escape(i.id)}" data-entry-title="${escape(i.title)}"${i.page_break_before?' data-break-before="true"':''}><div class="eng-lead"${hasBody?' data-has-body="true"':''}><div class="eng-item-title">${i.title?`<h3>${escape(i.title)}</h3>`:''}${i.period?`<span class="eng-period">${escape(i.period)}</span>`:''}${itemLinks(i.links)}</div>${i.subtitle?`<p class="eng-role">${escape(i.subtitle)}</p>`:''}${i.technologies?`<p class="resume-technologies">${escape(i.technologies)}</p>`:''}</div>${i.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}${i.bullets.length?`<ul>${i.bullets.map(b=>`<li>${prose(b)}</li>`).join('')}</ul>`:''}</div>`;
}
function render({resume:r,assets,synthetic}:TemplateInput){
 const photo=assets.photo;
 return `<header class="eng-header"><div class="eng-identity">${synthetic?'<p class="eng-synthetic">虚构示例</p>':''}<div class="eng-name"><h1>${escape(r.name)}</h1>${r.english_name?`<span>${escape(r.english_name)}</span>`:''}</div>${r.headline?`<p class="eng-headline">${escape(r.headline)}</p>`:''}<div class="eng-contacts">${r.contacts.map(c=>{const key=/github|gitlab/i.test(c.url??'')?'code':/@/.test(c.value)?'mail':/电话|手机/.test(c.label)||/^\+?[\d -]{7,}$/.test(c.value)?'phone':'web';return `<span>${icon(key)}${contactValue(c)}</span>`;}).join('')}</div></div>${photo?`<div class="eng-photo"><img src="${photo.dataUrl}" alt="${escape(photo.alt)}" style="object-position:${photo.x}% ${photo.y}%;transform:scale(${photo.zoom??1});transform-origin:${photo.x}% ${photo.y}%"></div>`:''}</header>${resumeBlocks(r).map(block=>{if(block.kind==='summary')return `<section class="eng-section">${block.title?`<h2>${escape(block.title)}</h2>`:''}${block.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</section>`;const s=block.section;
 const facts=s.id.startsWith('common-')&&s.items.every(i=>!i.subtitle&&!i.period&&!i.bullets.length&&!i.links?.length&&i.paragraphs.length<=1);
 return `<section class="eng-section" data-section-id="${escape(s.id)}">${s.title?`<h2>${escape(s.title)}</h2>`:''}${facts?`<div class="eng-facts">${s.items.map(i=>`<div class="eng-fact${i.paragraphs.join('').length>110?' eng-fact-wide':''}" data-entry-id="${escape(i.id)}"><h3>${escape(i.title)}</h3>${i.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</div>`).join('')}</div>`:s.items.map(item).join('')}</section>`;
 }).join('')}`;
}
export const engineeringTemplate:ResumeTemplate={id:'engineering',name:'简约研发',description:'技术栈独立成行，蓝灰层次与清晰分页',version:3,tags:['技术简历','单栏','A4'],photo:'optional',css:readFileSync(new URL('./engineering.css',import.meta.url),'utf8'),render};
