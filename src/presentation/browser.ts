type LocalSession = {token:string; defaultTheme:string; savedDefaultTheme:string|null; canSaveResumeTheme?:boolean};
let session: LocalSession|null = null;
let sessionReady:Promise<void>=Promise.resolve();
let applyingTheme=false;
let selectedTheme=document.body.dataset.theme || 'classic';
let galleryTheme=selectedTheme;
let preferenceBusy=false;
const resumeId=document.body.dataset.resumeId!;
let activeView='resume';
const $ = <T extends HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
const template=(id:string)=>document.getElementById('template-'+id) as HTMLTemplateElement|null;
const name=(id:string)=>template(id)?.dataset.name??id;
let toastTimer:ReturnType<typeof setTimeout>;
function toast(message:string) {const box=$('#toast');box.textContent=message;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),3200);}
declare function paginationDocument(markup:string,resources:{engine:string;css:string;fonts:string},title:string):string;
const pagination=JSON.parse($('#pagination-resources').textContent!);
const frames=new Map<HTMLElement,{frame:HTMLIFrameElement,height:number,timer:ReturnType<typeof setTimeout>}>();
function resizePreview(host:HTMLElement) {
  const item=frames.get(host);if(!item||!host.clientWidth)return;
  const scale=Math.min(1,host.clientWidth/(210*96/25.4));
  item.frame.style.transform=`scale(${scale})`;
  host.style.height=item.height?`${Math.ceil(item.height*scale)}px`:'300px';
}
const previewObserver=new ResizeObserver(entries=>entries.forEach(e=>resizePreview(e.target as HTMLElement)));
function previewError(host:HTMLElement,theme:string) {
  const item=frames.get(host);if(item)clearTimeout(item.timer);frames.delete(host);
  host.dataset.pagination='error';host.style.height='auto';
  const box=document.createElement('div');box.className='pagination-status';
  const label=document.createElement('p');label.textContent='简历暂时没有排版完成';
  const retry=document.createElement('button');retry.type='button';retry.className='button';retry.textContent='重新加载';retry.onclick=()=>showResume('#'+host.id,theme);
  box.append(label,retry);host.replaceChildren(box);
}
function releasePreview(host:HTMLElement) {
  const item=frames.get(host);if(item)clearTimeout(item.timer);frames.delete(host);previewObserver.unobserve(host);
  host.replaceChildren();host.style.removeProperty('height');host.dataset.pagination='idle';
}
function showResume(target:string,id:string) {
  const source=template(id);if(!source)throw new Error('此成果页没有该样式');
  const host=$(target),old=frames.get(host);if(old)clearTimeout(old.timer);
  host.classList.add('paged-preview');host.dataset.pagination='loading';host.dataset.theme=id;
  const status=document.createElement('p');status.className='pagination-status';status.setAttribute('role','status');status.textContent='正在排版…';
  const frame=document.createElement('iframe');frame.className='resume-frame';frame.title=name(id)+'简历分页预览';frame.style.visibility='hidden';
  frame.srcdoc=paginationDocument(source.innerHTML,pagination,document.title);
  frames.set(host,{frame,height:0,timer:setTimeout(()=>previewError(host,id),60_000)});
  host.replaceChildren(status,frame);previewObserver.observe(host);resizePreview(host);
}
window.addEventListener('message',event=>{
  if(event.data?.type!=='career-pagination')return;
  for(const [host,item] of frames) {
    if(event.source!==item.frame.contentWindow)continue;
    if(event.data.state!=='ready'){previewError(host,host.dataset.theme!);return;}
    clearTimeout(item.timer);
    const doc=item.frame.contentDocument!;
    item.height=Math.ceil(doc.querySelector('#pages')!.getBoundingClientRect().height);
    item.frame.style.height=item.height+'px';item.frame.style.visibility='visible';
    host.dataset.pagination='ready';host.dataset.pageCount=doc.documentElement.dataset.pageCount;
    host.querySelector('.pagination-status')?.remove();resizePreview(host);
  }
});
function selectTheme(theme:string) {
  if(!template(theme))return;
  selectedTheme=theme;document.body.dataset.theme=theme;if(activeView==='resume')showResume('#resume-preview',theme);
  $('#theme-label').textContent=name(theme);
}
const dialog=$<HTMLDialogElement>('#template-gallery');
function selectCandidate(id:string){
  galleryTheme=id;$('#gallery-selection').textContent=name(id);updateDefaultButton();
  document.querySelectorAll<HTMLElement>('[data-gallery-choice]').forEach(b=>{const active=b.dataset.galleryChoice===id;b.setAttribute('aria-pressed',String(active));b.closest('.template-card')!.classList.toggle('selected',active);});
}
function showCatalog(){
  releasePreview($('#gallery-resume'));
  $('#gallery-browse').hidden=false;$('#gallery-detail').hidden=true;
  $('#gallery-header').hidden=false;$('#gallery-footer').hidden=false;
  dialog.setAttribute('aria-labelledby','gallery-title');
}
function returnToCatalog(){showCatalog();document.querySelector<HTMLButtonElement>(`[data-preview-template="${galleryTheme}"]`)?.focus();}
function dismissGallery(){if(!$('#gallery-detail').hidden)returnToCatalog();else dialog.close();}
function filterTemplates(){
  const query=$<HTMLInputElement>('#template-search').value.trim().toLocaleLowerCase();let count=0;
  document.querySelectorAll<HTMLElement>('[data-template-card]').forEach(card=>{card.hidden=!card.dataset.search!.toLocaleLowerCase().includes(query);if(!card.hidden)count++;});
  $('#template-count').textContent=count+' 种样式';$('#template-empty').hidden=count!==0;
}
$('#open-gallery').addEventListener('click',()=>{selectCandidate(selectedTheme);showCatalog();$<HTMLInputElement>('#template-search').value='';filterTemplates();dialog.showModal();});
$('#template-search').addEventListener('input',filterTemplates);
document.querySelectorAll<HTMLButtonElement>('[data-gallery-choice]').forEach(b=>b.addEventListener('click',()=>selectCandidate(b.dataset.galleryChoice!)));
document.querySelectorAll<HTMLButtonElement>('[data-preview-template]').forEach(b=>b.addEventListener('click',()=>{
  selectCandidate(b.dataset.previewTemplate!);showResume('#gallery-resume',galleryTheme);
  $('#gallery-browse').hidden=true;$('#gallery-header').hidden=true;$('#gallery-footer').hidden=true;
  $('#gallery-detail').hidden=false;$('#gallery-detail').scrollTop=0;
  $('#preview-theme-name').textContent=name(galleryTheme);dialog.setAttribute('aria-labelledby','preview-theme-name');$('#back-gallery').focus();
}));
$('#back-gallery').addEventListener('click',returnToCatalog);
$('#close-preview').addEventListener('click',returnToCatalog);
$('#close-gallery').addEventListener('click',dismissGallery);
dialog.addEventListener('cancel',e=>{if(!$('#gallery-detail').hidden){e.preventDefault();returnToCatalog();}});
$('#cancel-gallery').addEventListener('click',()=>dialog.close());
async function applyGalleryTheme(){
  if(applyingTheme)return;
  const chosen=galleryTheme;
  const buttons=[$<HTMLButtonElement>('#apply-template'),$<HTMLButtonElement>('#apply-preview')];
  applyingTheme=true;buttons.forEach(b=>b.disabled=true);
  try{
    await sessionReady;
    if(location.protocol==='http:'&&['localhost','127.0.0.1'].includes(location.hostname)&&!session)throw new Error('未连接本地服务，请刷新后重试');
    if(session?.canSaveResumeTheme)await post('/api/library/theme',{resumeId,theme:chosen});
    selectTheme(chosen);
    const state=new URLSearchParams(location.hash.slice(1));state.set('theme',chosen);
    history.replaceState(null,'','#'+state.toString());
    dialog.close();toast(session?.canSaveResumeTheme?'已保存这份简历的样式':'已应用样式');
  }catch(e){toast((e as Error).message);}finally{applyingTheme=false;buttons.forEach(b=>b.disabled=false);}
}
$('#apply-template').addEventListener('click',applyGalleryTheme);
$('#apply-preview').addEventListener('click',applyGalleryTheme);
const library=$<HTMLDialogElement>('#resume-library');
$('#open-resumes').addEventListener('click',()=>{$<HTMLInputElement>('#resume-search').value='';filterResumes();library.showModal();});
$('#close-resumes').addEventListener('click',()=>library.close());
function filterResumes(){const query=$<HTMLInputElement>('#resume-search').value.trim().toLocaleLowerCase();let count=0;document.querySelectorAll<HTMLElement>('[data-resume-link]').forEach(link=>{link.hidden=!link.dataset.search!.toLocaleLowerCase().includes(query);if(!link.hidden)count++;});$('#resume-empty').hidden=count!==0;}
$('#resume-search').addEventListener('input',filterResumes);
document.querySelectorAll<HTMLAnchorElement>('[data-resume-link]').forEach(link=>link.addEventListener('click',e=>{
  if(link.dataset.resumeLink===resumeId){e.preventDefault();library.close();return;}
  const url=new URL(link.getAttribute('href')!,location.href);url.hash=new URLSearchParams({theme:selectedTheme,view:activeView}).toString();link.href=url.href;
}));
function switchView(id:string) {
  const button=document.querySelector<HTMLButtonElement>(`[data-view="${id}"]`);if(!button)return;activeView=id;
  document.querySelectorAll<HTMLElement>('.view').forEach(v=>v.hidden=v.id!=='view-'+id);
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(b=>{b.classList.toggle('active',b===button);if(b===button)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('#page-title').textContent=button.dataset.viewTitle!;$('#page-title').hidden=id==='resume';$('.document-scroll').scrollTop=0;
  const preview=$('#resume-preview');
  if(id==='resume'&&(preview.dataset.theme!==selectedTheme||!['ready','loading'].includes(preview.dataset.pagination??'')))showResume('#resume-preview',selectedTheme);
  else if(id!=='resume'&&preview.dataset.pagination==='loading')releasePreview(preview);$('#export-pdf').hidden=id!=='resume';$('#open-gallery').hidden=id!=='resume';
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view!)));
document.querySelectorAll('.brand[href="#resume"],.app-nav-item[href="#resume"]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();switchView('resume');}));
document.querySelectorAll<HTMLButtonElement>('.copy-field').forEach(button=>button.addEventListener('click',async()=>{
  const value=button.querySelector<HTMLElement>('.field-value')!;
  const selection=window.getSelection();
  // Selecting an excerpt with the mouse must not replace it with a full-field copy.
  if(selection?.toString()&&selection.anchorNode&&button.contains(selection.anchorNode))return;
  try {await navigator.clipboard.writeText(button.dataset.copyValue??value.textContent??'');toast('已复制'+button.querySelector('.field-label')!.textContent);}
  catch {const range=document.createRange();range.selectNodeContents(value);selection?.removeAllRanges();selection?.addRange(range);toast('已选中正文，请按 Ctrl / ⌘ + C 复制');}
}));
async function post(route:string,body:unknown) {
  if(!session) throw new Error('通过 CLI 打开可保存设置和直接导出 PDF。');
  const result=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json','X-Career-Token':session.token},body:JSON.stringify(body)});
  if(!result.ok) {let error='操作失败';try {error=(await result.json()).error||error;}catch{}throw new Error(error);}return result;
}
function download(blob:Blob,name:string) {const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export-pdf').addEventListener('click',async()=>{
  if(!session) {const host=$('#resume-preview');const frame=frames.get(host)?.frame;if(host.dataset.pagination!=='ready'||!frame){toast('请等简历排版完成后再导出');return;}toast('在打印窗口选择“另存为 PDF”');frame.contentWindow!.print();return;}
  const button=$<HTMLButtonElement>('#export-pdf');button.disabled=true;button.querySelector('span')!.textContent='正在生成…';
  try {const result=await post('/api/pdf',{theme:selectedTheme,resumeId,...(document.body.dataset.packageSha?{sha256:document.body.dataset.packageSha}:{})});download(await result.blob(),document.title.replace(' · career','')+'-'+selectedTheme+'.pdf');toast('PDF 已生成');}
  catch(e) {toast((e as Error).message);}finally {button.disabled=false;button.querySelector('span')!.textContent='导出 PDF';}
});
function updateDefaultButton(){
  const button=$<HTMLButtonElement>('#gallery-default');
  button.hidden=!session;
  button.disabled=preferenceBusy;
  button.textContent=session?.savedDefaultTheme===galleryTheme?'取消默认':'设为默认';
}
$('#gallery-default').addEventListener('click',async()=>{
  if(!session||preferenceBusy)return;
  const theme=session.savedDefaultTheme===galleryTheme?null:galleryTheme;
  preferenceBusy=true;updateDefaultButton();
  try {await post('/api/preference',{theme,resumeId});session.savedDefaultTheme=theme;toast(theme?'已设为默认，后续生成将使用此样式':'已取消默认样式');}
  catch(e){toast((e as Error).message);}finally{preferenceBusy=false;updateDefaultButton();}
});
$('#save-html').addEventListener('click',()=>{
  const clone=document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.live-resume-actions,.resume-back').forEach(e=>e.remove());
  clone.querySelectorAll<HTMLAnchorElement>('.sidebar a[href="/"]').forEach(a=>a.href='#resume');
  clone.querySelectorAll<HTMLElement>('.view').forEach(v=>v.hidden=v.id!=='view-resume');
  clone.querySelectorAll<HTMLElement>('[data-view]').forEach(v=>{const active=v.dataset.view==='resume';v.classList.toggle('active',active);if(active)v.setAttribute('aria-current','page');else v.removeAttribute('aria-current');});
  clone.querySelector<HTMLElement>('#export-pdf')!.hidden=false;clone.querySelector<HTMLElement>('#open-gallery')!.hidden=false;
  clone.querySelector('#toast')!.classList.remove('visible');clone.querySelector('#page-title')!.textContent='附件简历';
  clone.querySelectorAll('dialog').forEach(d=>d.removeAttribute('open'));
  // A downloaded single file contains only this resume. Do not preserve broken
  // links into the collection or leak other resumes' titles.
  clone.querySelectorAll<HTMLElement>('[data-resume-link]').forEach(link=>{if(link.dataset.resumeLink!==resumeId)link.remove();else{link.setAttribute('href','#');link.hidden=false;}});
  clone.querySelector<HTMLElement>('#gallery-default')!.hidden=true;
  clone.querySelectorAll('#resume-preview,#gallery-resume').forEach(v=>{v.replaceChildren();v.removeAttribute('style');v.removeAttribute('data-pagination');});
  clone.querySelector<HTMLElement>('#page-title')!.hidden=true;
  clone.querySelector('#library-note')!.textContent='当前页面只包含这一份简历。使用 CLI 从工作区生成集合后，可在这里切换其他简历。';
  download(new Blob(['<!doctype html>\n'+clone.outerHTML],{type:'text/html;charset=utf-8'}),'career-resume.html');toast('HTML 已导出');
});
updateDefaultButton();
$('#export-pdf').querySelector('span')!.textContent='打印 / 存为 PDF';
if(location.protocol==='http:' && ['localhost','127.0.0.1'].includes(location.hostname)) {
  sessionReady=fetch('/api/session?resume='+encodeURIComponent(resumeId)).then(r=>{if(!r.ok)throw new Error();return r.json();}).then((value:LocalSession)=>{
    if(!/^[a-f0-9]{64}$/.test(value.token)||typeof value.defaultTheme!=='string')throw new Error();
    session={...value,savedDefaultTheme:typeof value.savedDefaultTheme==='string'?value.savedDefaultTheme:null};updateDefaultButton();$('#export-pdf').querySelector('span')!.textContent='导出 PDF';
  }).catch(()=>{});
}
const state=new URLSearchParams(location.hash.slice(1));
selectTheme(state.get('theme')&&template(state.get('theme')!)?state.get('theme')!:selectedTheme);
const requestedView=state.get('view');if(requestedView&&['resume','common','boss','zhaopin','liepin','job51'].includes(requestedView))switchView(requestedView);
const thumbObserver=new ResizeObserver(entries=>entries.forEach(({target,contentRect})=>{
  const paper=target.querySelector<HTMLElement>('.thumbnail-document');if(paper&&contentRect.width)paper.style.transform=`scale(${contentRect.width/794})`;
}));
document.querySelectorAll('.template-thumb').forEach(thumb=>thumbObserver.observe(thumb));
export {};
