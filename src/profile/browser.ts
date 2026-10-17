import type {MaterialFile} from './store.js';
type Group={id:string;label:string;prefix:string};
type Index={groups:Group[];files:MaterialFile[];revision:string;truncated:boolean};
type Document={path:string;title:string;source:string;sha256:string;modified:string;fields:{label:string;value:string}[];links:{label:string;url:string}[];references:{title:string;path:string}[];warning:string;html:string;toc:{id:string;label:string;level:number}[]};
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const icons=JSON.parse($('#profile-icons').textContent!) as Record<string,string>;
const icon=(name:string)=>name==='layout-sidebar'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>':icons[name]??icons['file-earmark-text']??'';
document.querySelectorAll<HTMLElement>('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon!));
const fileUrl=(p:string,download=false)=>'/api/profile/file?'+new URLSearchParams({path:p,...(download?{download:'1'}:{})});
let index:Index={groups:[],files:[],revision:'',truncated:false},group='profile',selected='',doc:Document|null=null,mode='preview',requestId=0,refreshing=false;
let pdfTask:any=null,pdf:any=null,pdfPage=1,pdfScale=1,renderTask:any=null,renderId=0,imageScale=1;
const expanded=new Set<string>(),body=$('#material-body'),scroll=$('#material-scroll');
let toastTimer:ReturnType<typeof setTimeout>;
function toast(message:string){const e=$('#toast');e.textContent=message;e.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('visible'),3000);}
async function api<T>(url:string):Promise<T>{const r=await fetch(url);const data=await r.json();if(!r.ok)throw new Error(data.error??'资料读取失败');return data;}
async function copy(text:string){try{await navigator.clipboard.writeText(text);toast('已复制');}catch{const d=$<HTMLDialogElement>('#copy-fallback'),input=d.querySelector('textarea')!;input.value=text;d.showModal();input.focus();input.select();}}
function closeNav(){ $('.materials-layout').classList.remove('nav-open');$('#materials-backdrop').hidden=true;$('#open-materials-nav').setAttribute('aria-expanded','false');}
$('#open-materials-nav').onclick=()=>{const open=!$('.materials-layout').classList.contains('nav-open');$('.materials-layout').classList.toggle('nav-open',open);$('#materials-backdrop').hidden=!open;$('#open-materials-nav').setAttribute('aria-expanded',String(open));};
$('#close-materials-nav').onclick=()=>{closeNav();$('#open-materials-nav').focus();};$('#materials-backdrop').onclick=closeNav;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#material-outline').hidden){$('#material-outline').hidden=true;$('#outline-toggle').setAttribute('aria-expanded','false');}else closeNav();}});
function writeLocation(){history.replaceState(null,'','#'+new URLSearchParams({section:group,...(selected?{file:selected}:{})}));}
function groupFiles(id=group){return id==='files'?index.files:index.files.filter(f=>f.group===id);}
function renderNav(){
 $('#material-groups').hidden=group==='files';$('#all-files').hidden=group!=='files';

 $('#material-groups').innerHTML=index.groups.map(g=>{
  const files=groupFiles(g.id),nested=g.prefix.endsWith('/')&&g.id!=='files';
  return `<div class="material-group ${g.id==='context'?'nav-secondary':''}"><div class="group-row"><button class="group-link" data-group="${g.id}" ${group===g.id?'aria-current="page"':''}><span>${esc(g.label)}</span>${nested&&files.length?`<small>${files.length}</small>`:''}</button>${nested&&files.length?`<button class="group-expand" data-expand="${g.id}" aria-label="${expanded.has(g.id)?'收起':'展开'}${g.label}" aria-expanded="${expanded.has(g.id)}" aria-controls="entries-${g.id}">${icon('chevron-right')}</button>`:''}</div>${nested&&files.length?`<div id="entries-${g.id}" class="material-entries" ${expanded.has(g.id)?'':'hidden'}>${files.map(f=>`<button class="entry-link" data-entry="${esc(f.path)}" title="${esc(f.title)}" ${selected===f.path?'aria-current="page"':''}>${esc(f.title)}</button>`).join('')}</div>`:''}</div>`;
 }).join('');
 if(group==='files'){
  type Tree={dirs:Map<string,Tree>;files:MaterialFile[]};const root:Tree={dirs:new Map(),files:[]};
  for(const f of index.files){let node=root;const parts=f.path.split('/');for(const part of parts.slice(0,-1)){if(!node.dirs.has(part))node.dirs.set(part,{dirs:new Map(),files:[]});node=node.dirs.get(part)!;}node.files.push(f);}
  function tree(t:Tree,prefix=''):string{return [...t.dirs].map(([name,node])=>{const p=prefix+name+'/';return `<details class="file-directory" ${selected.startsWith(p)||!prefix?'open':''}><summary>${esc(name)}</summary>${tree(node,p)}</details>`;}).join('')+t.files.map(f=>`<button class="file-link" data-entry="${esc(f.path)}" ${selected===f.path?'aria-current="page"':''} title="${esc(f.path)}">${icon(f.kind==='image'?'image':f.kind==='pdf'?'file-earmark-pdf':'file-earmark-text')}<span>${esc(f.path.split('/').pop())}</span></button>`).join('');}
  $('#all-files').innerHTML=`<button class="files-back" data-group="profile">${icon('chevron-left')}资料分类</button>${tree(root)}${index.truncated?'<p class="material-warning">资料较多，仅显示前 1500 份。</p>':''}`;
 }
}
$('#materials-nav').addEventListener('click',e=>{
 const target=e.target as Element,entry=target.closest<HTMLElement>('[data-entry]'),expand=target.closest<HTMLElement>('[data-expand]'),g=target.closest<HTMLElement>('[data-group]');
 if(entry)void openFile(entry.dataset.entry!);
 else if(expand){const id=expand.dataset.expand!;expanded.has(id)?expanded.delete(id):expanded.add(id);renderNav();$('#materials-nav').querySelector<HTMLElement>(`[data-expand="${id}"]`)?.focus();}
 else if(g)void selectGroup(g.dataset.group!);
});
async function releaseMedia(){renderId++;renderTask?.cancel();renderTask=null;pdf=null;const task=pdfTask;pdfTask=null;$('#media-tools').hidden=true;if(task)try{await task.destroy();}catch{}}
function tools(available:boolean){$('#outline-toggle').hidden=!available;$('#preview-mode').hidden=!available;$('#source-mode').hidden=!available;$('#copy-material').hidden=!available;$('#download-material').hidden=!selected;$('#material-outline').hidden=true;$('#outline-toggle').setAttribute('aria-expanded','false');}
function empty(label:string,description:string){body.className='material-body';body.innerHTML=`<div class="material-empty">${icon('folder2-open')}<h3>${esc(label)}</h3><p>${esc(description)}</p><button class="button" data-agent>让 Agent 帮我整理</button></div>`;}
async function selectGroup(id:string){
 group=id;selected='';doc=null;mode='preview';requestId++;void releaseMedia();tools(false);expanded.add(id);writeLocation();renderNav();closeNav();
 const g=index.groups.find(g=>g.id===id);$('#material-title').textContent=g?.label??'资料';scroll.scrollTop=0;
 const files=groupFiles();if(files.length===1&&id!=='files'){await openFile(files[0]!.path);return;}
 if(!files.length){empty('还没有'+(g?.label??'资料'),id==='goals'?'和 Agent 聊聊你希望寻找的岗位、城市，以及看重的工作条件。':'可以先提供已有材料，或与 Agent 聊聊这部分经历。');return;}
 body.className='material-body';body.innerHTML=`<div class="material-list">${files.map(f=>`<button data-document="${esc(f.path)}">${icon(f.kind==='pdf'?'file-earmark-pdf':'file-earmark-text')}<span>${esc(f.title)}</span><small>${f.modified.slice(0,10)}</small>${icon('chevron-right')}</button>`).join('')}</div>`;
}
function renderDocument(){
 if(!doc)return;const isMarkdown=selected.endsWith('.md');$('#outline-toggle').hidden=!isMarkdown;body.className='material-body'+(mode==='source'||!isMarkdown?' source-view':'');
 $('#preview-mode').classList.toggle('active',mode==='preview');$('#source-mode').classList.toggle('active',mode==='source');$('#preview-mode').setAttribute('aria-pressed',String(mode==='preview'));$('#source-mode').setAttribute('aria-pressed',String(mode==='source'));
 if(mode==='source'||!isMarkdown){body.innerHTML=`<pre class="source-code"><code>${esc(doc.source)}</code></pre>`;$('#material-outline').hidden=true;$('#outline-toggle').setAttribute('aria-expanded','false');return;}
 const visibleFields=doc.fields.filter(f=>!(f.value===doc!.title&&['名称','公司','学校'].includes(f.label)));
 const fields=visibleFields.length?`<dl class="material-fields">${visibleFields.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`:'';
 body.innerHTML=(doc.warning?`<p class="material-warning">${esc(doc.warning)}</p>`:'')+fields+doc.html+
 (doc.links.length?`<section class="material-reference"><h3>相关链接</h3>${doc.links.map(l=>`<a class="reference-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join('')}</section>`:'')+
 (doc.references.length?`<section class="material-reference"><h3>来源与关联资料</h3>${doc.references.map(f=>`<a class="reference-link" data-document="${esc(f.path)}" href="${esc(fileUrl(f.path))}">${esc(f.title)}</a>`).join('')}</section>`:'');
 const first=body.querySelector('h1');if(first&&first.textContent===doc.title)first.remove();
 if(!body.textContent?.trim())empty('这份资料还没有内容','让 Agent 根据你的材料补充这份记录。');
 $('#material-outline').innerHTML=doc.toc.filter(t=>body.querySelector(`[id="${CSS.escape(t.id)}"]`)).map(t=>`<a href="#${encodeURIComponent(t.id)}" data-anchor="${esc(t.id)}" style="padding-left:${8+Math.max(0,t.level-2)*10}px">${esc(t.label)}</a>`).join('');
 $<HTMLButtonElement>('#outline-toggle').disabled=!$('#material-outline').children.length;
}
async function openFile(p:string,keepScroll=false){
 const f=index.files.find(f=>f.path===p);if(!f){toast('没有找到这份资料，文件可能已移动');return;}
 const myRequest=++requestId,oldScroll=scroll.scrollTop;await releaseMedia();if(myRequest!==requestId)return;
 selected=p;if(group!=='files'&&f.group!=='files'){group=f.group;expanded.add(group);}doc=null;if(!keepScroll)mode='preview';
 $('#material-title').textContent=f.title;tools(false);$<HTMLAnchorElement>('#download-material').href=fileUrl(p,true);writeLocation();renderNav();if(!keepScroll)closeNav();body.className='material-body';body.innerHTML='<p class="material-loading">正在读取资料…</p>';if(!keepScroll)scroll.scrollTop=0;
 try{
  if(f.kind==='markdown'||f.kind==='text'){
   const data=await api<Document>(fileUrl(p));if(myRequest!==requestId)return;doc=data;tools(true);$('#material-title').textContent=data.title;renderDocument();
  }else if(f.kind==='image'){
   body.className='material-body material-media';body.innerHTML=`<img src="${esc(fileUrl(p))}" alt="${esc(f.title)}">`;imageScale=1;
   const img=body.querySelector('img')!;img.onerror=()=>{if(myRequest===requestId)empty('图片暂时无法预览','可以下载原文件查看。');};
   $('#media-tools').innerHTML='<button class="tool" data-image="out" aria-label="缩小图片">−</button><span id="image-scale">适合宽度</span><button class="tool" data-image="in" aria-label="放大图片">＋</button><button class="tool" data-image="fit">适合宽度</button>';$('#media-tools').hidden=false;
  }else if(f.kind==='pdf'){
   const moduleUrl='/board-assets/pdf/pdf.mjs',lib=await import(moduleUrl);if(myRequest!==requestId)return;lib.GlobalWorkerOptions.workerSrc='/board-assets/pdf/pdf.worker.mjs';
   pdfTask=lib.getDocument({url:fileUrl(p),cMapUrl:'/board-assets/pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'/board-assets/pdf/standard_fonts/',wasmUrl:'/board-assets/pdf/wasm/'});const loaded=await pdfTask.promise;if(myRequest!==requestId)return;pdf=loaded;pdfPage=1;pdfScale=1;
   $('#media-tools').innerHTML='<button class="tool" data-pdf="prev" aria-label="上一页">←</button><span id="pdf-page"></span><button class="tool" data-pdf="next" aria-label="下一页">→</button><button class="tool" data-pdf="out" aria-label="缩小 PDF">−</button><button class="tool" data-pdf="in" aria-label="放大 PDF">＋</button><button class="tool" data-pdf="fit">适合宽度</button>';$('#media-tools').hidden=false;await renderPdf();
  }else empty('这份文件可以下载查看','保留原始格式，方便你和 Agent 继续使用。');
  if(keepScroll)scroll.scrollTop=oldScroll;
 }catch(e){if(myRequest!==requestId)return;body.className='material-body';body.innerHTML=`<div class="material-empty"><h3>暂时无法读取</h3><p>${esc((e as Error).message)}</p><button class="button" data-retry>重新读取</button></div>`;}
}
async function renderPdf(){
 if(!pdf)return;const rendering=++renderId;renderTask?.cancel();const current=pdf;try{
 const page=await current.getPage(pdfPage);if(rendering!==renderId||current!==pdf)return;
 const base=page.getViewport({scale:1}),scale=Math.min(1.5,Math.max(.2,(scroll.clientWidth-48)/base.width))*pdfScale,ratio=Math.min(2,devicePixelRatio||1),view=page.getViewport({scale:scale*ratio});
 body.className='material-body material-media';body.innerHTML='<canvas aria-label="PDF 页面"></canvas>';const canvas=body.querySelector('canvas')!;canvas.width=view.width;canvas.height=view.height;canvas.style.width=view.width/ratio+'px';canvas.style.maxWidth='none';
 $('#pdf-page').textContent=`${pdfPage} / ${pdf.numPages}`;$<HTMLButtonElement>('[data-pdf="prev"]').disabled=pdfPage<=1;$<HTMLButtonElement>('[data-pdf="next"]').disabled=pdfPage>=pdf.numPages;
 renderTask=page.render({canvasContext:canvas.getContext('2d')!,viewport:view});await renderTask.promise;
 }catch(e){if(rendering===renderId&&(e as Error).name!=='RenderingCancelledException')toast('PDF 暂时无法显示，请下载查看');}
}
$('#media-tools').onclick=e=>{const el=(e.target as Element).closest<HTMLElement>('[data-pdf],[data-image]');if(!el)return;if(el.dataset.pdf&&pdf){const action=el.dataset.pdf;if(action==='prev')pdfPage=Math.max(1,pdfPage-1);if(action==='next')pdfPage=Math.min(pdf.numPages,pdfPage+1);if(action==='in')pdfScale=Math.min(3,pdfScale+.25);if(action==='out')pdfScale=Math.max(.5,pdfScale-.25);if(action==='fit')pdfScale=1;void renderPdf();}else if(el.dataset.image){const action=el.dataset.image;imageScale=action==='fit'?1:Math.max(.5,Math.min(3,imageScale+(action==='in'?.25:-.25)));const img=body.querySelector('img')!;body.classList.toggle('image-zoom',imageScale!==1);img.style.width=imageScale===1?'':Math.max(80,(scroll.clientWidth-48)*imageScale)+'px';$('#image-scale').textContent=imageScale===1?'适合宽度':Math.round(imageScale*100)+'%';}};
$('#preview-mode').onclick=()=>{mode='preview';renderDocument();};$('#source-mode').onclick=()=>{mode='source';renderDocument();};
$('#outline-toggle').onclick=()=>{if(mode==='source'){mode='preview';renderDocument();}const open=$('#material-outline').hidden;$('#material-outline').hidden=!open;$('#outline-toggle').setAttribute('aria-expanded',String(open));};
$('#copy-material').onclick=()=>{if(doc)void copy(doc.source);};
function agentPrompt(){
 const g=index.groups.find(g=>g.id===group);
 const task=group==='research'?'按 jd-research Skill 继续岗位研究。复用已有样本与进度，保留原文来源，更新要求与经历的证据映射、补足计划和简历使用记录；未确认的能力先问我，不写成已有经历。':'与我核对并补充内容，更新原文件，保留来源和待确认问题。';
 return `请在当前 career 个人工作区继续整理我的${g?.label??'资料'}。先读取 AGENTS.md 和 context/INDEX.md，再${selected?'读取 '+JSON.stringify(selected)+'，':'查看相关资料，'}${task}`;
}
$('#copy-agent').onclick=()=>void copy(agentPrompt());
$('.material-reader').addEventListener('click',e=>{
 const target=e.target as Element,link=target.closest<HTMLElement>('[data-document]'),anchor=target.closest<HTMLElement>('[data-anchor]');
 if(link){e.preventDefault();void openFile(link.dataset.document!);}
 else if(anchor){e.preventDefault();body.querySelector<HTMLElement>(`[id="${CSS.escape(anchor.dataset.anchor!)}"]`)?.scrollIntoView({block:'start'});if(innerWidth<=1100){$('#material-outline').hidden=true;$('#outline-toggle').setAttribute('aria-expanded','false');}}
 else if(target.closest('[data-agent]'))void copy(agentPrompt());else if(target.closest('[data-retry]'))void openFile(selected);
});
async function refresh(initial=false){
 if(refreshing)return;refreshing=true;
 try{const data=await api<Index>('/api/profile/index');if(data.revision===index.revision&&!initial)return;const old=index,oldFile=old.files.find(f=>f.path===selected);index=data;
  if(initial){const params=new URLSearchParams(location.hash.slice(1));group=index.groups.some(g=>g.id===params.get('section'))?params.get('section')!:'profile';const p=params.get('file');if(p&&index.files.some(f=>f.path===p)){await openFile(p);return;}await selectGroup(group);return;}
  renderNav();const file=index.files.find(f=>f.path===selected);if(selected&&file){if(file.modified!==oldFile?.modified||file.size!==oldFile?.size)await openFile(selected,true);}else if(selected||!doc){await selectGroup(group);}
 }catch(e){if(initial){$('#material-title').textContent='我的资料';empty('资料暂时无法读取',(e as Error).message);}else toast('资料刷新失败，请稍后重试');}finally{refreshing=false;}
}
window.addEventListener('focus',()=>void refresh());setInterval(()=>{if(!document.hidden)void refresh();},4000);
let resizeTimer:ReturnType<typeof setTimeout>;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(pdf)void renderPdf();},150);}).observe(scroll);
void refresh(true);
export {};
