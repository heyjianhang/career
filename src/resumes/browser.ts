import type {ResumePackage,Experience} from './model.js';
import type {library} from './store.js';
type LibraryEntry=Awaited<ReturnType<typeof library>>['entries'][number];
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const content=$('#library-content'),editId=document.body.dataset.editId!;
let token='',entries:LibraryEntry[]=[],draft:ResumePackage|null=null,sha='',dirty=false,busy=false,from:string|undefined,conflict=false,editRevision=0;
const themeNames=new Map<string,string>(),pageCounts=new Map<string,number>();
let menuTrigger:HTMLButtonElement|null=null,menuEntry:LibraryEntry|null=null,exportingPdf=false;
const thumbnailKey=(entry:LibraryEntry)=>entry.id+':'+entry.sha256+':'+entry.theme;
let noticeTimer:ReturnType<typeof setTimeout>;
function toast(text:string){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
async function api(route:string,data?:unknown){const r=await fetch('/api/library/'+route,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json','X-Career-Token':token}:{},body:data?JSON.stringify(data):undefined});const v=await r.json();if(!r.ok)throw new Error(v.error??'读取失败');return v;}
function alert(message:string){$('#library-alert').textContent=message;$('#library-alert').hidden=!message;}
function markDirty(){editRevision++;dirty=true;$('#save-state').textContent='有未保存的修改';schedulePreview();}
const thumbnailObserver=new ResizeObserver(items=>items.forEach(({target})=>{
 const cover=target as HTMLElement,paper=cover.querySelector<HTMLElement>('.resume-thumbnail')!,frame=paper.querySelector('iframe')!;
 const style=getComputedStyle(cover);
 const width=cover.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
 const height=cover.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
 // Keep the full page width and crop its lower half within the card.
 const scale=Math.max(0,width/(210*96/25.4));
 paper.style.width=width+'px';paper.style.height=height+'px';frame.style.transform=`scale(${scale})`;
}));
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.type!=='career-pagination')return;
 for(const frame of content.querySelectorAll<HTMLIFrameElement>('.resume-thumbnail iframe')){
  if(event.source!==frame.contentWindow)continue;
  const cover=frame.closest<HTMLElement>('.resume-cover')!,tile=cover.closest<HTMLElement>('.resume-tile')!;
  const doc=frame.contentDocument?.documentElement,state=doc?.dataset.pagination;
  if(state!=='ready'&&state!=='error')return;
  cover.dataset.preview=state;
  const status=cover.querySelector<HTMLElement>('.thumbnail-status');
  const count=Number(doc?.dataset.pageCount),label=tile.querySelector<HTMLElement>('.tile-page-count')!;
  const key=tile.dataset.thumbnailKey!;
  if(state==='ready'){
   status?.remove();
   if(Number.isSafeInteger(count)&&count>0){pageCounts.set(key,count);label.textContent=` · ${count} 页`;}
  }else{pageCounts.delete(key);label.textContent='';if(status)status.textContent='暂时无法预览，点击查看';}
  break;
 }
});
function updatedLabel(value:string){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
 const year=date.getFullYear(),prefix=year===new Date().getFullYear()?'':year+'年';
 return `${prefix}${date.getMonth()+1}月${date.getDate()}日更新`;
}
function renderLibrary(){
 closeTileMenu();thumbnailObserver.disconnect();
 const query=$<HTMLInputElement>('#resume-search').value.toLowerCase();const found=entries.filter(e=>`${e.title} ${e.name} ${e.headline}`.toLowerCase().includes(query));
 if(!entries.length){content.innerHTML='<section class="library-empty"><div class="empty-mark">▤</div><h2>从第一份简历开始</h2><p>把旧简历、项目资料交给 Agent，或从一段经历聊起。结合目标岗位的要求，把经历聊清楚，再生成可以查看、编辑和导出的简历。</p><div class="steps"><span>01 盘点与调研</span><span>02 深入整理经历</span><span>03 生成简历</span></div><button id="copy-intake" class="button primary">复制给 Agent</button></section>';$('#copy-intake').onclick=async()=>{try{const r=await api('session');await navigator.clipboard.writeText(r.prompt);toast('已复制');}catch(e){alert((e as Error).message);}};return;}
 content.innerHTML='<div class="library-grid" style="--resume-count:'+Math.max(1,found.length)+'">'+found.map(e=>{
  const key=thumbnailKey(e),count=pageCounts.get(key),theme=themeNames.get(e.theme)??e.theme;
  const edit=e.editable?`<a class="tile-action" href="/resumes/${e.id}/edit" aria-label="编辑：${esc(e.title)}">编辑</a>`:`<button class="tile-action" data-copy="${e.id}" aria-label="创建可编辑副本：${esc(e.title)}">编辑副本</button>`;
  return `<article class="resume-tile" data-thumbnail-key="${esc(key)}"><a class="resume-cover" href="${e.href}" aria-label="打开 ${esc(e.title)}"><span class="thumbnail-status">正在生成预览…</span><span class="resume-thumbnail"><iframe title="${esc(e.title)}缩略预览" src="/api/library/thumbnail?id=${e.id}&revision=${e.sha256}&theme=${encodeURIComponent(e.theme)}" loading="lazy" tabindex="-1" aria-hidden="true" sandbox="allow-scripts allow-same-origin"></iframe></span></a><div class="tile-actions">${edit}<button class="tile-action tile-more" data-more="${e.id}" aria-label="更多操作：${esc(e.title)}" title="更多操作" aria-haspopup="menu" aria-expanded="false" aria-controls="tile-menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button></div><div class="tile-body"><h2 title="${esc(e.title)}"><a href="${e.href}">${esc(e.title)}</a></h2><div class="tile-meta"><span class="tile-format" title="${esc(theme)}"><span class="tile-theme">${esc(theme)}</span><span class="tile-page-count">${count?' · '+count+' 页':''}</span></span><time datetime="${esc(e.updated_at)}" title="更新于 ${esc(new Date(e.updated_at).toLocaleString('zh-CN'))}">${esc(updatedLabel(e.updated_at))}</time></div></div></article>`;
 }).join('')+'</div>'+(!found.length?'<p class="library-loading">没有匹配的简历</p>':'');
 content.querySelectorAll<HTMLElement>('[data-copy]').forEach(b=>b.onclick=()=>openCreate(b.dataset.copy));
 content.querySelectorAll<HTMLButtonElement>('[data-more]').forEach(b=>{
  b.onclick=()=>menuTrigger===b?closeTileMenu(true):openTileMenu(b);
  b.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();openTileMenu(b,e.key==='ArrowUp');}};
 });
 content.querySelectorAll<HTMLElement>('.resume-cover').forEach(cover=>thumbnailObserver.observe(cover));
}
function closeTileMenu(restoreFocus=false){
 const trigger=menuTrigger;$('#tile-menu').hidden=true;trigger?.setAttribute('aria-expanded','false');trigger?.closest('.resume-tile')?.classList.remove('menu-open');menuTrigger=null;menuEntry=null;
 if(restoreFocus&&trigger?.isConnected)trigger.focus();
}
function openTileMenu(trigger:HTMLButtonElement,last=false){
 closeTileMenu();menuEntry=entries.find(e=>e.id===trigger.dataset.more)??null;if(!menuEntry)return;
 menuTrigger=trigger;const menu=$('#tile-menu');menu.setAttribute('aria-label',menuEntry.title+'的操作');menu.hidden=false;
 trigger.setAttribute('aria-expanded','true');trigger.closest('.resume-tile')!.classList.add('menu-open');
 const anchor=trigger.getBoundingClientRect(),box=menu.getBoundingClientRect();
 menu.style.left=Math.max(8,Math.min(anchor.right-box.width,innerWidth-box.width-8))+'px';
 menu.style.top=Math.max(8,anchor.bottom+6+box.height<=innerHeight-8?anchor.bottom+6:anchor.top-box.height-6)+'px';
 const items=menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');items[last?items.length-1:0]!.focus();
}
$('#tile-menu').onkeydown=e=>{
 const items=Array.from($('#tile-menu').querySelectorAll<HTMLButtonElement>('[role="menuitem"]')),index=items.indexOf(document.activeElement as HTMLButtonElement);
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeTileMenu(true);}
 else if(e.key==='Tab')closeTileMenu(true);
 else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]!.focus();}
};
$('#tile-menu').addEventListener('focusout',e=>{const next=e.relatedTarget as Node|null;if(menuTrigger&&next&&!$('#tile-menu').contains(next)&&next!==menuTrigger)closeTileMenu();});
$('#tile-menu-copy').onclick=()=>{const entry=menuEntry;closeTileMenu(true);if(entry)openCreate(entry.id);};
$('#tile-menu-pdf').onclick=()=>{const entry=menuEntry;closeTileMenu(true);if(entry)void exportCardPdf(entry);};
document.addEventListener('click',e=>{if(menuTrigger&&!$('#tile-menu').contains(e.target as Node)&&!menuTrigger.contains(e.target as Node))closeTileMenu();});
content.addEventListener('scroll',()=>closeTileMenu(),{passive:true});window.addEventListener('resize',()=>closeTileMenu());
async function exportCardPdf(entry:LibraryEntry){
 if(exportingPdf){toast('PDF 正在生成，请稍候');return;}
 exportingPdf=true;toast('正在生成 PDF…');
 try{
  const response=await fetch('/api/pdf',{method:'POST',headers:{'Content-Type':'application/json','X-Career-Token':token},body:JSON.stringify({resumeId:entry.id,theme:entry.theme,sha256:entry.sha256})});
  if(!response.ok){const error=await response.json();throw new Error(error.error??'PDF 导出失败');}
  const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=entry.title+'-'+entry.theme+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('PDF 已生成');
 }catch(e){toast((e as Error).message);}finally{exportingPdf=false;}
}
function openCreate(id?:string){from=id;$('#resume-dialog-title').textContent=id?(entries.find(e=>e.id===id)?.editable?'另存为新简历':'创建可编辑副本'):'新建简历';$<HTMLInputElement>('#resume-name').value=id?(entries.find(e=>e.id===id)?.title??'简历')+' · 副本':'';$('#resume-dialog-error').textContent='';$<HTMLDialogElement>('#resume-dialog').showModal();$('#resume-name').focus();}
$('#dialog-cancel').onclick=()=>$<HTMLDialogElement>('#resume-dialog').close();
$('#resume-dialog-form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;try{const r=await api('create',{title:$<HTMLInputElement>('#resume-name').value,from});location.href=`/resumes/${r.id}/edit`;}catch(e){$('#resume-dialog-error').textContent=(e as Error).message;}finally{busy=false;}};
let editorTheme='classic',savedTheme='classic',previewTimer:ReturnType<typeof setTimeout>,previewRequest=0,previewZoom='fit',previewPage=1,portraitData='';
let previewAbort:AbortController|undefined;let focusedEntry='';
function locatePreviewEntry(){if(!focusedEntry)return;const frame=$('#editor-preview-paper')?.querySelector<HTMLIFrameElement>('iframe:not([data-pending])'),entry=Array.from(frame?.contentDocument?.querySelectorAll<HTMLElement>('[data-entry-id]')??[]).find(e=>e.dataset.entryId===focusedEntry);if(!frame||!entry)return;const scale=frame.getBoundingClientRect().width/PAPER_WIDTH;const top=entry.getBoundingClientRect().top*scale;$('#editor-preview-scroll').scrollTo({top:Math.max(0,top-30),behavior:'smooth'});}
const PAPER_WIDTH=210*96/25.4;
function orderedRefs(){if(!draft)return [];const c=draft.content,refs=[{ref:'summary',title:c.summary_title??'个人简介',anchor:'edit-summary'},...c.sections.map((s,n)=>({ref:'section:'+s.id,title:s.title,anchor:'edit-section-'+n})),...c.common.sections.map((s,n)=>({ref:'common:'+s.id,title:s.title,anchor:'edit-common-'+n}))];const order=c.layout?.sectionOrder??[];return refs.sort((a,b)=>{const rank=(ref:string)=>{const n=order.indexOf(ref);return n<0?(ref==='summary'?-1:Infinity):n;};return rank(a.ref)-rank(b.ref);});}
function moveSection(ref:string,before:string){const order=orderedRefs().map(s=>s.ref),from=order.indexOf(ref),to=order.indexOf(before);if(from<0||to<0||from===to)return;order.splice(from,1);order.splice(to,0,ref);draft!.content.layout={...draft!.content.layout,sectionOrder:order};markDirty();renderEditor();}
function previewResize(){const host=$('#editor-preview-paper'),frame=host?.querySelector<HTMLIFrameElement>('iframe:not([data-pending])');if(!host||!frame)return;const h=frame.contentDocument?.documentElement.scrollHeight??1123,scale=previewZoom==='fit'?Math.min(1,host.parentElement!.clientWidth/PAPER_WIDTH):Number(previewZoom);frame.style.height=h+'px';frame.style.transform=`scale(${scale})`;host.style.height=h*scale+'px';host.style.width=PAPER_WIDTH*scale+'px';}
const editorResizeObserver=new ResizeObserver(()=>previewResize());
function previewGo(delta:number){const frame=$('#editor-preview-paper')?.querySelector<HTMLIFrameElement>('iframe:not([data-pending])'),pages=frame?.contentDocument?.querySelectorAll<HTMLElement>('.pagedjs_page');if(!pages?.length)return;previewPage=Math.max(1,Math.min(pages.length,previewPage+delta));const viewport=$('#editor-preview-scroll'),scale=frame!.getBoundingClientRect().width/PAPER_WIDTH;viewport.scrollTo({top:pages[previewPage-1]!.offsetTop*scale,behavior:'smooth'});$('#editor-page-number').textContent=`${previewPage} / ${pages.length}`;}
function schedulePreview(){if(!draft||!$('#editor-preview-paper'))return;clearTimeout(previewTimer);$('#editor-preview-status').textContent='正在更新…';previewTimer=setTimeout(()=>void updatePreview(),650);}
async function updatePreview(){
 if(!draft)return;const request=++previewRequest;previewAbort?.abort();previewAbort=new AbortController();
 try{const response=await fetch('/api/library/preview',{method:'POST',headers:{'Content-Type':'application/json','X-Career-Token':token},body:JSON.stringify({package:draft,theme:editorTheme}),signal:previewAbort.signal});const result=await response.json();if(request!==previewRequest)return;if(!response.ok)throw new Error(result.error??'预览失败');
 portraitData=result.photoDataUrl??'';const image=$<HTMLImageElement>('#portrait-preview');if(image&&portraitData){image.src=portraitData;image.hidden=false;updatePortrait();}
 const host=$('#editor-preview-paper');if(!host)return;host.querySelector('[data-pending]')?.remove();const frame=document.createElement('iframe');frame.title='正在更新简历预览';frame.dataset.pending='true';frame.dataset.request=String(request);frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.srcdoc=result.document;host.append(frame);
 }catch(e){if((e as Error).name!=='AbortError'&&request===previewRequest&&$('#editor-preview-status'))$('#editor-preview-status').textContent='预览暂未更新：'+(e as Error).message;}
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.type!=='career-pagination'||!editId)return;
 const host=$('#editor-preview-paper'),frame=host?.querySelector<HTMLIFrameElement>('iframe[data-pending]');if(!frame||event.source!==frame.contentWindow||frame.dataset.request!==String(previewRequest))return;
 if(event.data.state!=='ready'){console.warn('Resume pagination failed:',frame.contentDocument?.documentElement.dataset.paginationError);frame.remove();$('#editor-preview-status').textContent='分页失败，请检查内容或调整字号';return;}
 host.querySelectorAll('iframe:not([data-pending])').forEach(f=>f.remove());delete frame.dataset.pending;frame.title='简历实时分页预览';previewResize();
 const count=Number(frame.contentDocument!.documentElement.dataset.pageCount);previewPage=Math.min(previewPage,count);$('#editor-page-number').textContent=`${previewPage} / ${count}`;$('#editor-preview-status').textContent=(dirty?'未保存的预览':'与已保存内容一致')+(frame.contentDocument!.documentElement.dataset.layoutWarning?' · '+frame.contentDocument!.documentElement.dataset.layoutWarning:'');locatePreviewEntry();
});
function updatePortrait(){const photo=draft?.content.profile.photo,img=$<HTMLImageElement>('#portrait-preview');if(!photo||!img)return;const p=photo.position??{x:50,y:50,zoom:1};img.style.objectPosition=`${p.x}% ${p.y}%`;img.style.transform=`scale(${p.zoom??1})`;img.style.transformOrigin=`${p.x}% ${p.y}%`;}
function previewPanel(){return `<aside class="editor-preview" aria-label="实时预览"><div class="editor-preview-toolbar"><strong>分页预览</strong><label>缩放<select id="editor-zoom"><option value="fit">适应宽度</option><option value="1">100%</option><option value="1.25">125%</option></select></label><div class="editor-pages"><button type="button" id="editor-prev" aria-label="上一页">‹</button><span id="editor-page-number">—</span><button type="button" id="editor-next" aria-label="下一页">›</button></div></div><p id="editor-preview-status" role="status">正在生成预览…</p><div id="editor-preview-scroll"><div id="editor-preview-paper"></div></div></aside>`;}

function field(label:string,value:unknown,key:string,wide=false,multiline=false){return `<label class="edit-field ${wide?'wide':''}">${esc(label)}${multiline?`<textarea data-key="${key}" rows="4">${esc(value)}</textarea>`:`<input data-key="${key}" value="${esc(value)}">`}</label>`;}
function getAt(key:string){return key.split('.').reduce((o,k)=>o[k],draft as any);}
function setAt(key:string,value:unknown){const parts=key.split('.'),leaf=parts.pop()!;getAt(parts.join('.'))[leaf]=value;}
function contacts(fields:any[],prefix:string){return fields.map((f,i)=>`<div class="row-fields"><input aria-label="字段名称" data-key="${prefix}.${i}.label" value="${esc(f.label)}" placeholder="名称"><input aria-label="字段内容" data-key="${prefix}.${i}.value" value="${esc(f.value)}" placeholder="内容"><button type="button" data-remove="${prefix}.${i}" aria-label="删除 ${esc(f.label||'字段')}">×</button><input class="url-field" aria-label="可点击链接" data-key="${prefix}.${i}.url" value="${esc(f.url)}" placeholder="可选网址：https://…"></div>`).join('')+`<button class="add-field" type="button" data-add-contact="${prefix}">＋ 添加一项</button>`;}
const kindNames:Record<string,string>={employment:'工作经历',project:'项目经历',education:'教育经历',other:'其他经历'};
function itemForm(i:Experience,prefix:string){return `<details class="entry-item" open><summary>${esc(i.title||'新'+kindNames[i.kind])}</summary><div class="edit-grid">${field(i.kind==='employment'?'公司名称':i.kind==='education'?'学校名称':'名称',i.title,prefix+'.title')}${field(i.kind==='education'?'专业':'职位 / 角色',i.subtitle,prefix+'.subtitle')}${field('开始时间',i.start,prefix+'.start')}${field('结束时间（至今可填“至今”）',i.current?'至今':i.end,prefix+'.end')}${i.kind==='project'?field('所属公司（选填）',i.company,prefix+'.company'):''}${i.kind==='education'?field('学历',i.qualification,prefix+'.qualification'):''}${i.kind==='project'?field('技术栈（独立展示）',i.technologies,prefix+'.technologies',true):''}${field('描述',i.description,prefix+'.description',true,true)}${field('职责 / 工作要点（每行一条）',i.responsibilities,prefix+'.responsibilities',true,true)}${field('成果（每行一条）',i.achievements,prefix+'.achievements',true,true)}</div><div class="edit-hint">项目 / 作品链接</div>${i.links.map((l,n)=>`<div class="row-fields"><input aria-label="链接名称" data-key="${prefix}.links.${n}.label" value="${esc(l.label)}" placeholder="链接名称"><input aria-label="链接网址" data-key="${prefix}.links.${n}.url" value="${esc(l.url)}" placeholder="https://…"><button type="button" data-remove="${prefix}.links.${n}" aria-label="删除链接">×</button></div>`).join('')}<button class="add-field" type="button" data-add-link="${prefix}.links">＋ 添加链接</button><label class="page-break-control"><input type="checkbox" data-key="${prefix}.page_break_before" ${i.page_break_before?'checked':''}>此经历从新的一页开始</label><div class="entry-actions"><button type="button" data-up="${prefix}">上移</button><button type="button" data-down="${prefix}">下移</button><button type="button" class="remove" data-remove="${prefix}">删除此经历</button></div></details>`;}
function moduleHeading(ref:string,key:string,title:string,remove?:string){
 const refs=orderedRefs(),n=refs.findIndex(s=>s.ref===ref);
 return `<div class="module-heading" data-module-ref="${esc(ref)}"><label class="module-title-field"><span>模块名称</span><input data-key="${key}" data-module-title="${esc(ref)}" value="${esc(title)}" aria-label="模块名称：${esc(title||'未命名模块')}" placeholder="输入模块名称"></label><div class="module-actions"><button type="button" data-section-move="${n}" data-direction="-1" aria-label="上移模块：${esc(title)}" ${n===0?'disabled':''}>↑ 上移</button><button type="button" data-section-move="${n}" data-direction="1" aria-label="下移模块：${esc(title)}" ${n===refs.length-1?'disabled':''}>↓ 下移</button>${remove?`<button type="button" class="text-button module-remove" data-remove="${remove}">删除</button>`:''}</div></div>`;
}
function updateModuleLabel(ref:string,title:string){
 const label=title.trim()||'未命名模块';
 content.querySelectorAll<HTMLElement>('[data-module-label]').forEach(el=>{if(el.dataset.moduleLabel===ref)el.textContent=label;});
 content.querySelectorAll<HTMLElement>('[data-module-ref]').forEach(row=>{if(row.dataset.moduleRef===ref)row.querySelectorAll<HTMLElement>('[data-section-move]').forEach(button=>button.setAttribute('aria-label',(button.dataset.direction==='-1'?'上移模块：':'下移模块：')+label));});
}
function renderEditor(){if(!draft)return;const c=draft.content,refs=orderedRefs(),layout=c.layout??{};
 const scroll=content.scrollTop;
 content.innerHTML=`<div class="editor-mobile-tabs"><button type="button" data-editor-view="edit" aria-pressed="true">编辑内容</button><button type="button" data-editor-view="preview" aria-pressed="false">分页预览</button></div><div class="editor-shell" data-view="edit"><nav class="editor-nav" aria-label="简历编辑分组"><a href="#edit-layout">排版设置</a><a href="#edit-profile">基本信息</a><div class="outline-label">栏目顺序</div>${refs.map((s,n)=>`<div class="outline-row" draggable="true" data-module-ref="${esc(s.ref)}" data-section-ref="${esc(s.ref)}"><a href="#${s.anchor}" data-module-label="${esc(s.ref)}">${esc(s.title||'未命名模块')}</a><button type="button" data-section-move="${n}" data-direction="-1" aria-label="上移${esc(s.title)}" ${n===0?'disabled':''}>↑</button><button type="button" data-section-move="${n}" data-direction="1" aria-label="下移${esc(s.title)}" ${n===refs.length-1?'disabled':''}>↓</button></div>`).join('')}<a href="#edit-add">添加栏目</a></nav><form id="package-form" class="editor-form">${draft.legacy?'<div class="legacy-note">这是旧简历的可编辑副本。原包已保留；请核对职责、成果和日期后使用。</div>':''}<section class="edit-section" id="edit-layout"><h2>排版设置</h2><div class="edit-grid"><label class="edit-field">模板<select id="editor-theme">${Array.from(themeNames).map(([id,name])=>`<option value="${id}" ${editorTheme===id?'selected':''}>${esc(name)}</option>`).join('')}</select></label><label class="edit-field">段落间距<select data-layout="density"><option value="standard" ${layout.density!=='compact'?'selected':''}>舒展</option><option value="compact" ${layout.density==='compact'?'selected':''}>紧凑</option></select></label><label class="edit-field">正文字号<select data-layout="fontSize"><option value="">跟随模板</option>${[9,9.5,10,10.5,11,11.5,12].map(v=>`<option value="${v}" ${layout.fontSize===v?'selected':''}>${v} pt</option>`).join('')}</select></label><label class="edit-field">正文行高<select data-layout="lineHeight"><option value="">跟随模板</option>${[1.4,1.5,1.6,1.65,1.7,1.8,1.9].map(v=>`<option value="${v}" ${layout.lineHeight===v?'selected':''}>${v}</option>`).join('')}</select></label></div><p class="edit-hint">预览会随修改更新，点击右上角保存后生效。所有内容模块都能改名；在模块顶部或目录调整顺序，附件与 PDF 同步显示。</p><div class="mobile-outline">${refs.map((s,n)=>`<div data-module-ref="${esc(s.ref)}"><span data-module-label="${esc(s.ref)}">${esc(s.title||'未命名模块')}</span><button type="button" data-section-move="${n}" data-direction="-1" aria-label="上移${esc(s.title)}" ${!n?'disabled':''}>↑</button><button type="button" data-section-move="${n}" data-direction="1" aria-label="下移${esc(s.title)}" ${n===refs.length-1?'disabled':''}>↓</button></div>`).join('')}</div></section>
 <section class="edit-section" id="edit-profile"><h2>基本信息</h2><div class="edit-grid">${field('简历名称',draft.title,'title',true)}${field('姓名',c.profile.name,'content.profile.name')}${field('英文名（选填）',c.profile.english_name,'content.profile.english_name')}${field('求职方向',c.profile.headline,'content.profile.headline',true)}</div><div class="photo-tools"><label><span class="button">${c.profile.photo?'更换照片':'添加照片'}</span><input id="photo-input" type="file" accept="image/png,image/jpeg" aria-label="简历照片（选填）" style="position:absolute;width:1px;height:1px;opacity:0;padding:0"></label>${c.profile.photo?'<button type="button" class="text-button" id="remove-photo">移除</button>':''}</div>${c.profile.photo?`<div class="portrait-editor"><div class="portrait-frame"><img id="portrait-preview" alt="照片取景预览" ${portraitData?`src="${portraitData}"`:'hidden'}></div><div class="portrait-sliders">${[['x','水平位置',0,100,1],['y','垂直位置',0,100,1],['zoom','放大',1,2,.05]].map(([key,title,min,max,step])=>`<label>${title}<input type="range" data-photo-position="${key}" aria-label="照片${title}" min="${min}" max="${max}" step="${step}" value="${(c.profile.photo!.position as any)?.[String(key)]??(key==='zoom'?1:50)}"></label>`).join('')}<button type="button" class="text-button" id="reset-portrait">重置取景</button></div></div>`:''}<div class="edit-hint">联系方式、城市、个人网页</div>${contacts(c.profile.contacts,'content.profile.contacts')}</section>
 <div id="ordered-sections"><section class="edit-section" id="edit-summary">${moduleHeading('summary','content.summary_title',c.summary_title??'个人简介')}<p class="edit-hint">留空的内容不会出现在预览或导出中。</p>${field('介绍你的经验与优势',c.summary,'content.summary',true,true)}</section>${c.sections.map((s,n)=>`<section class="edit-section" id="edit-section-${n}">${moduleHeading('section:'+s.id,`content.sections.${n}.title`,s.title,`content.sections.${n}`)}${s.items.map((i,k)=>itemForm(i,`content.sections.${n}.items.${k}`)).join('')}<button type="button" class="add-field" data-add-item="${n}">＋ 添加经历</button></section>`).join('')}${c.common.sections.map((s,n)=>`<section class="edit-section" id="edit-common-${n}">${moduleHeading('common:'+s.id,`content.common.sections.${n}.title`,s.title,`content.common.sections.${n}`)}${contacts(s.fields,`content.common.sections.${n}.fields`)}</section>`).join('')}</div><section class="edit-section" id="edit-add"><h2>添加栏目</h2><div class="job-chips">${Object.entries(kindNames).map(([k,v])=>`<button type="button" class="add-field" data-add-section="${k}">＋ ${v}</button>`).join('')}<button class="add-field" type="button" id="add-common">＋ 技能 / 荣誉等资料</button></div></section><section class="edit-section" id="edit-relations"><h2>关联岗位</h2><div id="related-jobs" class="related-list">正在读取…</div></section></form>${previewPanel()}</div>`;
 refs.forEach(ref=>$('#ordered-sections').append($('#'+ref.anchor)));
 content.scrollTop=scroll;updatePortrait();editorResizeObserver.disconnect();editorResizeObserver.observe($('#editor-preview-scroll'));$<HTMLSelectElement>('#editor-zoom').value=previewZoom;
 content.querySelectorAll<HTMLElement>('[data-editor-view]').forEach(button=>button.onclick=()=>{$('.editor-shell').dataset.view=button.dataset.editorView;content.querySelectorAll('[data-editor-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));previewResize();if(button.dataset.editorView==='preview'&&!$('#editor-preview-paper iframe'))schedulePreview();});
 content.querySelectorAll<HTMLButtonElement>('[data-section-move]').forEach(button=>button.onclick=()=>{const n=Number(button.dataset.sectionMove);moveSection(refs[n]!.ref,refs[n+Number(button.dataset.direction)]!.ref);});
 let dragged='';content.querySelectorAll<HTMLElement>('[data-section-ref]').forEach(row=>{row.ondragstart=e=>{dragged=row.dataset.sectionRef!;e.dataTransfer?.setData('text/plain',dragged);};row.ondragover=e=>{e.preventDefault();row.classList.add('drag-over');};row.ondragleave=()=>row.classList.remove('drag-over');row.ondrop=e=>{e.preventDefault();row.classList.remove('drag-over');if(dragged)moveSection(dragged,row.dataset.sectionRef!);dragged='';};row.ondragend=()=>dragged='';});
 content.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('[data-key]').forEach(el=>el.oninput=()=>{const key=el.dataset.key!;if(key==='title')draft!.title=el.value;else if(el.type==='checkbox')setAt(key,(el as HTMLInputElement).checked);else if(key.endsWith('.end')){setAt(key,el.value==='至今'?'':el.value);setAt(key.replace(/\.end$/,'.current'),el.value==='至今');}else if(key.endsWith('.url')&&!el.value){const parts=key.split('.');parts.pop();delete getAt(parts.join('.')).url;}else setAt(key,el.value);if(el.dataset.moduleTitle)updateModuleLabel(el.dataset.moduleTitle,el.value);markDirty();});
 $<HTMLSelectElement>('#editor-theme').onchange=e=>{editorTheme=(e.target as HTMLSelectElement).value;markDirty();};
 content.querySelectorAll<HTMLSelectElement>('[data-layout]').forEach(el=>el.onchange=()=>{c.layout??={};const k=el.dataset.layout!;if(!el.value)delete (c.layout as any)[k];else (c.layout as any)[k]=k==='density'?el.value:Number(el.value);markDirty();});
 $<HTMLSelectElement>('#editor-zoom').onchange=e=>{previewZoom=(e.target as HTMLSelectElement).value;previewResize();};$('#editor-prev').onclick=()=>previewGo(-1);$('#editor-next').onclick=()=>previewGo(1);
 $('#editor-preview-scroll').onscroll=()=>{const frame=$('#editor-preview-paper').querySelector<HTMLIFrameElement>('iframe:not([data-pending])'),pages=frame?.contentDocument?.querySelectorAll<HTMLElement>('.pagedjs_page');if(!pages?.length)return;const scale=frame!.getBoundingClientRect().width/PAPER_WIDTH,top=$('#editor-preview-scroll').scrollTop+80;previewPage=Array.from(pages).filter(page=>page.offsetTop*scale<=top).length||1;$('#editor-page-number').textContent=`${previewPage} / ${pages.length}`;};
 content.querySelectorAll<HTMLInputElement>('[data-photo-position]').forEach(el=>el.oninput=()=>{const p=c.profile.photo!;p.position??={x:50,y:50,zoom:1};(p.position as any)[el.dataset.photoPosition!]=Number(el.value);updatePortrait();markDirty();});
 $('#reset-portrait')?.addEventListener('click',()=>{c.profile.photo!.position={x:50,y:50,zoom:1};markDirty();renderEditor();});
 $<HTMLFormElement>('#package-form').onsubmit=e=>e.preventDefault();
 $<HTMLFormElement>('#package-form').onfocusin=(e:FocusEvent)=>{const key=(e.target as HTMLElement).dataset.key??'',m=key.match(/^content\.sections\.(\d+)\.items\.(\d+)\./);if(m){focusedEntry=c.sections[Number(m[1])]?.items[Number(m[2])]?.id??'';locatePreviewEntry();}else focusedEntry='';};
 content.querySelectorAll<HTMLElement>('[data-remove],[data-up],[data-down]').forEach(b=>b.onclick=()=>{const key=b.dataset.remove??b.dataset.up??b.dataset.down!,parts=key.split('.'),index=Number(parts.pop()),arr=getAt(parts.join('.'));if(b.dataset.remove){if(!confirm('删除这一项？保存后才会写入文件。'))return;arr.splice(index,1);}else {const next=index+(b.dataset.up?-1:1);if(next<0||next>=arr.length)return;[arr[index],arr[next]]=[arr[next],arr[index]];}markDirty();renderEditor();});
 content.querySelectorAll<HTMLElement>('[data-add-contact],[data-add-link]').forEach(b=>b.onclick=()=>{getAt(b.dataset.addContact??b.dataset.addLink!).push(b.dataset.addContact?{label:'',value:''}:{label:'',url:''});markDirty();renderEditor();});
 content.querySelectorAll<HTMLElement>('[data-add-section]').forEach(b=>b.onclick=()=>{const kind=b.dataset.addSection!;c.sections.push({id:'section-'+crypto.randomUUID(),title:kindNames[kind]!,kind,items:[newItem(kind as Experience['kind'])]});markDirty();renderEditor();});
 content.querySelectorAll<HTMLElement>('[data-add-item]').forEach(b=>b.onclick=()=>{const s=c.sections[Number(b.dataset.addItem)]!;s.items.push(newItem(s.items[0]?.kind??(typeof s.kind==='string'&&s.kind in kindNames?s.kind as Experience['kind']:'other')));markDirty();renderEditor();});
 $('#add-common').onclick=()=>{c.common.sections.push({id:'common-'+crypto.randomUUID(),title:'技能 / 语言 / 证书',fields:[]});markDirty();renderEditor();};
 $('#remove-photo')?.addEventListener('click',()=>{delete c.profile.photo;portraitData='';markDirty();renderEditor();});
 $<HTMLInputElement>('#photo-input').onchange=async e=>{const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;if(f.size>5*1024*1024){toast('照片不能超过 5 MiB');return;}try{const bytes=new Uint8Array(await f.arrayBuffer());let data='';for(let n=0;n<bytes.length;n+=8192)data+=String.fromCharCode(...bytes.subarray(n,n+8192));const r=await api('photo',{id:editId,bytes:btoa(data)});c.profile.photo=r.photo;portraitData='';markDirty();renderEditor();}catch(e){alert((e as Error).message);}};
 void api('relations?id='+editId).then(r=>{if(!$('#related-jobs'))return;$('#related-jobs').innerHTML=r.jobs.length?r.jobs.map((j:any)=>`<a href="/board?opportunity=${j.id}">${esc(j.company)} · ${esc(j.title)}</a>`).join(''):'<p class="edit-hint">暂未关联岗位，可在岗位详情的“简历”页选择。</p>';}).catch(e=>alert(e.message));
 schedulePreview();
}

function newItem(kind:Experience['kind']):Experience{return {id:'item-'+crypto.randomUUID(),kind,title:'',subtitle:'',start:'',end:'',current:false,company:'',qualification:'',description:'',responsibilities:'',achievements:'',links:[]};}
async function readEditor(){const r=await api('read?id='+editId);if(!r.editable){location.replace(`/resumes/${editId}/index.html`);return;}draft=r.package;editorTheme=r.theme??'classic';savedTheme=editorTheme;sha=r.sha256;dirty=false;conflict=false;alert('');$('#save-state').textContent='已保存';renderEditor();}
async function poll(){if(busy||document.hidden||(!editId&&(menuTrigger||$<HTMLDialogElement>('#resume-dialog').open)))return;try{if(editId){const r=await api('stamp?id='+editId);if(r.sha256!==sha){if(dirty){conflict=true;alert('Agent 或其他页面更新了这份简历。你的修改已保留，请另存草稿或重新读取后合并。');$('#library-alert').insertAdjacentHTML('beforeend','<button id="download-draft">下载当前草稿</button><button id="reload-draft">读取最新内容</button>');$('#download-draft').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='resume-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};$('#reload-draft').onclick=()=>{if(confirm('已保留或另存当前修改？读取最新内容将替换编辑区。'))void readEditor();};}else await readEditor();}}else {const next=await api('list');if(JSON.stringify(entries)!==JSON.stringify(next.entries)){entries=next.entries;renderLibrary();}}}catch(e){alert((e as Error).message);}}
try{const s=await api('session');token=s.token;for(const theme of s.themes)themeNames.set(theme.id,theme.name);document.querySelectorAll<HTMLAnchorElement>('.sidebar a[href="#resume"],.sidebar a[href="#"]').forEach(a=>a.href='/');if(editId){await readEditor();$('#save-package').onclick=async()=>{if(busy)return;if(conflict){toast('请先合并最新内容，避免覆盖他人的修改');return;}busy=true;const savedRevision=editRevision,themeToSave=editorTheme;$<HTMLButtonElement>('#save-package').disabled=true;try{const r=await api('save',{package:draft,sha256:sha});sha=r.sha256;if(themeToSave!==savedTheme){await api('theme',{resumeId:editId,theme:themeToSave});savedTheme=themeToSave;}dirty=editRevision!==savedRevision;$('#save-state').textContent=dirty?'有未保存的修改':'已保存';alert('');if($('#editor-preview-status'))$('#editor-preview-status').textContent=dirty?'未保存的预览':'与已保存内容一致';toast(dirty?'上一批修改已保存，请继续保存新修改':'已保存，附件和平台填写稿已同步');if(r.warnings?.some((w:any)=>w.code==='LENGTH_REVIEW'))alert('已保存。部分平台字段超过参考长度，请在填写稿中核对。');}catch(e){alert((e as Error).message);await poll();}finally{busy=false;$<HTMLButtonElement>('#save-package').disabled=false;}};
 $('#preview-link').onclick=e=>{if(dirty){e.preventDefault();toast('请先保存修改，再查看生成结果');}};
 }else{const r=await api('list');entries=r.entries;renderLibrary();if(r.warnings.length)alert(r.warnings.map((w:any)=>w.message).join('；'));$('#new-resume').onclick=()=>openCreate();$('#resume-search').oninput=renderLibrary;}
}catch(e){alert((e as Error).message);content.innerHTML='<p class="library-loading">暂时无法读取，请刷新重试。</p>';}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});window.addEventListener('focus',()=>void poll());setInterval(()=>void poll(),5000);
export {};

// Keep the editing page alive until its draft has been saved; settings can still be read.
document.addEventListener('career:before-workspace-switch',e=>{if(dirty||busy){e.preventDefault();(e as CustomEvent).detail.reason=busy?'简历正在保存，请稍候再切换。':'简历有未保存的修改，请先关闭设置并保存，再切换工作区。';}});
