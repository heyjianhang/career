import {readFileSync} from 'node:fs';
import type {ResumeContent, ResolvedAssets} from '../types.js';
import {escape} from '../escape.js';
import {contactValue,itemLinks} from '../links.js';
import {engineeringTemplate} from './engineering.js';
import {selectedTemplates} from './selected.js';
import {visibleResume,resumeBlocks} from '../content.js';

/** Every renderer receives the same content and already resolved, offline assets. */
export interface TemplateInput {resume: ResumeContent; assets: ResolvedAssets; synthetic: boolean}
export interface ResumeTemplate {
  id: string; name: string; description: string; version: number; tags: string[];
  photo: 'optional'|'none'; css: string;
  render: (input: TemplateInput) => string;
}

// The existing two templates share a document structure. A future template may
// supply its own renderer without changing the package, CLI or selection UI.
function standard({resume:r,assets,synthetic}:TemplateInput) {
  const photo=assets.photo;
  return `<header class="resume-header"><div class="resume-identity">${synthetic?'<div class="resume-kicker">虚构示例</div>':''}<h1>${escape(r.name)}</h1>${r.headline?`<p class="resume-role">${escape(r.headline)}</p>`:''}</div>${r.contacts.length?`<div class="contacts">${r.contacts.map(c=>`<span>${c.label?`<small>${escape(c.label)}</small>`:''}${contactValue(c)}</span>`).join('')}</div>`:''}${photo?`<div class="standard-photo-frame"><img class="resume-photo" src="${photo.dataUrl}" alt="${escape(photo.alt)}" style="object-position:${photo.x}% ${photo.y}%;transform:scale(${photo.zoom??1});transform-origin:${photo.x}% ${photo.y}%" width="98" height="128"></div>`:''}</header>${resumeBlocks(r).map(block=>{if(block.kind==='summary')return `<section class="resume-section summary">${block.title?`<h2>${escape(block.title)}</h2>`:''}${block.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</section>`;const s=block.section;return `<section class="resume-section">${s.title?`<h2>${escape(s.title)}</h2>`:''}${s.items.map(i=>`<div class="resume-item" data-entry-id="${escape(i.id)}"${i.page_break_before?' data-break-before="true"':''}>${i.title||i.period?`<div class="item-heading">${i.title?`<h3>${escape(i.title)}</h3>`:''}${i.period?`<span class="period">${escape(i.period)}</span>`:''}</div>`:''}${i.subtitle?`<div class="item-subtitle">${escape(i.subtitle)}</div>`:''}${i.technologies?`<p class="resume-technologies">${escape(i.technologies)}</p>`:''}${itemLinks(i.links)}${i.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}${i.bullets.length?`<ul>${i.bullets.map(b=>`<li>${escape(b)}</li>`).join('')}</ul>`:''}</div>`).join('')}</section>`;}).join('')}`;
}
export const templates: ResumeTemplate[] = [
  {id:'classic',name:'经典',description:'留白舒展，层次清晰',version:4,tags:['单栏','A4'],photo:'optional',css:'',render:standard},
  {id:'compact',name:'紧凑',description:'紧凑间距，清晰分区',version:4,tags:['单栏','A4'],photo:'optional',css:readFileSync(new URL('./compact.css',import.meta.url),'utf8'),render:standard},
  engineeringTemplate,
  ...selectedTemplates
];
if(new Set(templates.map(t=>t.id)).size!==templates.length || templates.some(t=>! /^[a-z][a-z0-9-]{0,39}$/.test(t.id))) throw new Error('模板 ID 必须唯一且只含安全标识字符');
export const templateMetadata = templates.map(({render,css,...metadata})=>metadata);
export const templateCss = readFileSync(new URL('./base.css',import.meta.url),'utf8')+'\n'+templates.map(t=>t.css).join('\n');
export function renderTemplate(id:string,input:TemplateInput) {
  const template=templates.find(t=>t.id===id);
  if(!template) throw new Error('未知样式：'+id);
  const assets=template.photo==='none'?{}:input.assets;
  const layout=input.resume.layout;
  const style=[layout?.fontSize?`font-size:${layout.fontSize}pt`:'',layout?.lineHeight?`line-height:${layout.lineHeight}`:''].filter(Boolean).join(';');
  return `<article class="resume-paper" data-template="${template.id}" data-density="${layout?.density??'standard'}" style="${escape(style)}" aria-label="附件简历预览">${template.render({...input,resume:visibleResume(input.resume),assets})}</article>`;
}
