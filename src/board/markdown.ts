import path from 'node:path';
import MarkdownIt from 'markdown-it';
import {escape} from '../presentation/escape.js';
import {isWebUrl} from '../presentation/links.js';

export const fileUrl=(id:string,file:string,download=false)=>'/api/board/file?'+new URLSearchParams({id,path:file,...(download?{download:'1'}:{})});
export function localLink(current:string,href:string):string|null {
  try {
    const decoded=decodeURIComponent(href.split('#')[0]!.split('?')[0]!);
    if(!decoded||/^[a-z][a-z\d+.-]*:|^[\/\\]|[\x00-\x1f\\]/i.test(decoded))return null;
    const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(current),decoded));
    if(resolved.startsWith('../')||resolved.split('/').some(p=>p.startsWith('.')))return null;
    return resolved;
  } catch{return null;}
}
export function renderMarkdown(source:string,id:string,current:string,urlForFile=(file:string)=>fileUrl(id,file)) {
  const content=source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');
  const md=new MarkdownIt({html:false,linkify:true,breaks:false});
  const toc:{id:string;label:string;level:number}[]=[],slugs=new Map<string,number>();
  md.renderer.rules.heading_open=(tokens,index,options,_env,self)=>{
    const label=tokens[index+1]?.content??'',slug=label.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-|-$/g,'')||'section';
    const count=(slugs.get(slug)??0)+1;slugs.set(slug,count);const anchor=slug+(count>1?'-'+count:'');
    tokens[index]!.attrSet('id',anchor);toc.push({id:anchor,label,level:Number(tokens[index]!.tag.slice(1))});return self.renderToken(tokens,index,options);
  };
  md.renderer.rules.link_open=(tokens,index,options,_env,self)=>{
    const token=tokens[index]!,href=String(token.attrGet('href')??'');
    if(isWebUrl(href)){token.attrSet('target','_blank');token.attrSet('rel','noopener noreferrer');}
    else if(/^#[^\s]*$/.test(href)){}
    else {const file=localLink(current,href);token.attrSet('href',file?urlForFile(file):'#');if(file)token.attrSet('data-document',file);else token.attrSet('aria-disabled','true');}
    return self.renderToken(tokens,index,options);
  };
  md.renderer.rules.image=(tokens,index)=>{
    const token=tokens[index]!,file=localLink(current,String(token.attrGet('src')??''));
    if(!file||!(/\.(png|jpe?g|gif|webp)$/i.test(file)))return `<span class="image-label">${escape(token.content||'图片')}</span>`;
    return `<img src="${escape(urlForFile(file))}" alt="${escape(token.content)}" loading="lazy">`;
  };
  return {content,html:md.render(content),toc};
}
