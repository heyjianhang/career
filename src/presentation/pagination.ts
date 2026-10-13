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
      const flow=await new PagedModule.Previewer().preview(content,[{'about:blank':styles}],document.getElementById('pages'));
      document.documentElement.dataset.pageCount=String(flow.total);
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
