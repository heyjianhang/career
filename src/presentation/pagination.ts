import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {templateCss} from './templates/registry.js';

const require=createRequire(import.meta.url);
const engine=readFileSync(path.join(path.dirname(require.resolve('pagedjs')),'../dist/paged.min.js'),'utf8');
const license=readFileSync(path.join(path.dirname(require.resolve('pagedjs')),'../LICENSE.md'),'utf8');
const layoutCss=`
*{box-sizing:border-box}html,body{margin:0;padding:0}h1,h2,h3,p{margin:0}
${templateCss}
@page{size:A4;margin:14mm}
.resume-paper,.resume-paper[data-template]{width:auto;max-width:none;min-height:0;padding:0;margin:0;box-shadow:none}
`;
export function paginationResources(fonts:string) {return {engine:'/* '+license+' */\n'+engine,css:layoutCss,fonts};}

/** Kept self-contained: this exact function also runs in exported offline HTML. */
export function paginationDocument(markup:string, resources:{engine:string;css:string;fonts:string}, title:string) {
  const safe=(s:string)=>s.replace(/<\/script/gi,'<\\/script');
  const label=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const boot=`(async()=>{
    try {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map(i=>i.decode()));
      const source=document.getElementById('source');
      const content=source.innerHTML;
      source.remove();
      const styles=JSON.parse(document.getElementById('layout-data').textContent);

      // Legacy templates may fill bounded page slack after natural pagination.
      // Engineering deliberately skips this pass to keep spacing consistent.
      // Paged.js protects the next heading + first body lines. When that opening
      // cannot fit, distribute a bounded amount of the remaining space between
      // existing blocks, rather than leaving all of it at the foot of the page.
      // Never stretch text, force a page count, or balance last/manual pages.
      const measureInk=content=>{
        const box=content.getBoundingClientRect(),range=document.createRange();
        const walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT);
        let bottom=box.top,inside=true,node;
        const measure=rect=>{
          if(!rect.width||!rect.height)return;
          bottom=Math.max(bottom,rect.bottom);
          // Paged.js uses columns. Overflow can move text sideways into an
          // invisible column instead of increasing the reported bottom edge.
          // Top ink may overhang its line box; added bottom spacing cannot
          // move it upward, so only bottom and side bounds constrain balancing.
          if(rect.left<box.left-1||rect.right>box.right+1||rect.bottom>box.bottom+1)inside=false;
        };
        while(node=walker.nextNode())if(node.textContent.trim()){
          range.selectNodeContents(node);for(const rect of range.getClientRects())measure(rect);
        }
        for(const img of content.querySelectorAll('img'))measure((img.closest('.eng-photo,.standard-photo-frame,.design-photo-frame')??img).getBoundingClientRect());
        return {bottom,inside};
      };
      const flow=await new PagedModule.Previewer().preview(content,[{'about:blank':styles}],document.getElementById('pages'));
      document.documentElement.dataset.pageCount=String(flow.total);
      const pages=Array.from(document.querySelectorAll('.pagedjs_page'));
      for(let index=0;index<pages.length-1;index++){
        const content=pages[index].querySelector('.pagedjs_page_content');
        const next=pages[index+1].querySelector('.pagedjs_page_content');
        const paper=content?.querySelector('.resume-paper');
        if(!paper||!next||paper.dataset.density==='compact'||paper.dataset.template==='compact'||paper.dataset.template==='engineering')continue;
        // Engineering uses fixed spacing and natural flow, never page stretching.
        // An explicit break expresses the author's intent, including breaks
        // promoted to a section by the shared stylesheet.
        if(next.querySelector('[data-break-before="true"], [data-break-before="page"]'))continue;
        const box=content.getBoundingClientRect(),initial=measureInk(content),bottom=initial.bottom;
        if(!initial.inside)continue;
        const line=parseFloat(getComputedStyle(paper).lineHeight);
        const slack=box.bottom-bottom;
        if(!Number.isFinite(line)||bottom-box.top<box.height*.7||slack<line*1.5||slack>line*6)continue;
        const blocks=Array.from(content.querySelectorAll('.eng-section>h2,.eng-section>p,.eng-facts,.eng-lead,.eng-item>p,.eng-item>ul>li,.resume-section>h2,.resume-section>p,.resume-item>.flow-lead,.resume-item>p,.resume-item>ul>li,.design-section>h2,.design-section>p,.design-item>.flow-lead,.design-item>p,.design-item>ul>li'))
          .filter(el=>{const rect=el.getBoundingClientRect();return rect.height>0&&rect.bottom<bottom-2&&!el.hasAttribute('data-split-to');});
        if(!blocks.length)continue;
        const inset=Math.max(4,line*.35),available=slack-inset;
        const addition=Math.min(8,available/blocks.length);
        const saved=blocks.map(el=>({el,padding:parseFloat(getComputedStyle(el).paddingBottom)||0,inline:el.style.paddingBottom}));
        const apply=factor=>saved.forEach(({el,padding})=>el.style.paddingBottom=(padding+addition*factor)+'px');
        const fits=()=>{const ink=measureInk(content);return ink.inside&&ink.bottom<=box.bottom-inset;};
        apply(1);
        if(!fits()){
          let low=0,high=1;
          for(let attempt=0;attempt<10;attempt++){
            const middle=(low+high)/2;apply(middle);
            if(fits())low=middle;else high=middle;
          }
          apply(low);
        }
        // Both vertical and horizontal bounds are checked after final rounding.
        if(!fits())saved.forEach(({el,inline})=>el.style.paddingBottom=inline);
        else content.dataset.pageBalanced='true';
      }
      const last=pages.at(-1)?.querySelector('.pagedjs_page_content');
      const occupied=last?Math.max(0,...Array.from(last.querySelectorAll('h1,h2,h3,p,li,img')).map(e=>e.getBoundingClientRect().bottom-last.getBoundingClientRect().top)):0;
      const shortTail=flow.total>1&&last&&occupied<last.getBoundingClientRect().height*.25;
      if(shortTail)document.documentElement.dataset.layoutWarning='末页内容较少，可调整间距或分页';
      document.documentElement.dataset.pagination='ready';
      parent.postMessage({type:'career-pagination',state:'ready'},'*');
    } catch(e) {document.documentElement.dataset.pagination='error';document.documentElement.dataset.paginationError=String(e);parent.postMessage({type:'career-pagination',state:'error'},'*');}
  })();`;
  return `<!doctype html><html lang="zh-CN" data-pagination="loading"><head><meta charset="utf-8"><title>${label}</title><style data-pagedjs-ignore>${resources.fonts}</style><style data-pagedjs-ignore>${resources.css}</style><style data-pagedjs-ignore>
    html,body{background:transparent;width:210mm;overflow-x:hidden}
    #source{position:absolute;left:0;top:0;width:182mm;visibility:hidden}
    .pagedjs_pages{display:flex;flex-direction:column;gap:24px}
    .pagedjs_page{background:white;flex:none}
    @media print{html,body{width:auto;background:white;overflow:visible!important;height:auto!important;max-height:none!important}.pagedjs_pages{display:block}.pagedjs_page{margin:0;box-shadow:none;break-after:page}.pagedjs_page:last-child{break-after:auto}}
  </style></head><body><div id="source">${markup}</div><div id="pages"></div><script id="layout-data" type="application/json">${JSON.stringify(resources.css).replace(/</g,'\\u003c')}</script><script>${safe(resources.engine)}</script><script>${safe(boot)}</script></body></html>`;
}
