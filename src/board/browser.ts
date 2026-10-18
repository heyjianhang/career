import type {overview,show} from '../opportunities/store.js';
type Board=Awaited<ReturnType<typeof overview>>;
type Detail=Awaited<ReturnType<typeof show>>;
type Outreach=import('../opportunities/outreach.js').Outreach;
type MatchSummary=import('../opportunities/match.js').MatchSummary;
type Session={token:string;stages:Record<string,string>;outcomes:Record<string,string>;interviewStatuses:Record<string,string>;platforms:Record<string,string>;documents:{id:string;label:string;path:string}[]};
type DocumentResult={content:string;source:string;html:string;toc:{id:string;label:string;level:number}[];sha256:string};
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const icons:Record<string,string>=JSON.parse($('#board-icons').textContent!);
const icon=(name:string)=>icons[name]??icons['file-earmark-text']!;
document.querySelectorAll<HTMLElement>('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon!));
const drawer=$<HTMLDialogElement>('#opportunity-drawer'),view=$('#document-view'),kanban=$('#kanban'),tree=$('#file-tree'),readerTools=$('#reader-tools'),documentActions=$('#document-actions');
let session:Session,board:Board,detail:Detail|null=null,tab='overview',fileSelection='job.md',sourceMode=false,docVersion='',loadId=0,refreshing=false,mutating=false;
let roundId:string|null=null,roundDoc='record',mockPath='',roundListVersion='',stageMenuMode='stages',preferredWidth=820;
const positions=new Map<string,number>();
let currentKey='',activePath='',pdf:any=null,pdfTask:any=null,pdfRender:any=null,pdfPage=1,pdfZoom=1,pdfEpoch=0,imageZoom=1;
const fileUrl=(p:string,download=false)=>'/api/board/file?'+new URLSearchParams({id:detail!.id,path:p,...(download?{download:'1'}:{})});
function toast(text:string){const host=drawer.open?drawer:document.body;let box=host.querySelector<HTMLElement>(drawer.open?'#toast-inline':'#toast');if(!box){box=document.createElement('div');box.id='toast-inline';host.append(box);}box.textContent=text;box.classList.add('visible');const current=box;setTimeout(()=>{if(current.id==='toast-inline')current.remove();else current.classList.remove('visible');},4000);}

async function api<T=any>(route:string,data?:unknown):Promise<T>{const response=await fetch('/api/board/'+route,{cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/json','X-Career-Token':session.token},body:JSON.stringify(data)}:{})});const value=await response.json();if(!response.ok)throw new Error(value.error??'读取失败');return value;}
function notice(error:unknown){$('#board-error').hidden=false;$('#board-error').textContent=error instanceof Error?error.message:String(error);}
function action(title:string,description:string,text:string,confirm:string,onConfirm:(value:string)=>Promise<void>,readOnly=false){
 const dialog=$<HTMLDialogElement>('#action-dialog');$('#action-title').textContent=title;$('#action-description').textContent=description;const input=$<HTMLTextAreaElement>('#action-text');input.value=text;input.readOnly=readOnly;$('#action-confirm').textContent=confirm;$('#action-error').textContent='';
 $('#action-confirm').onclick=async()=>{const button=$<HTMLButtonElement>('#action-confirm');button.disabled=true;try{await onConfirm(input.value);dialog.close();}catch(e){$('#action-error').textContent=(e as Error).message;}finally{button.disabled=false;}};
 $('#action-cancel').onclick=()=>dialog.close();dialog.showModal();if(readOnly){input.focus();input.select();}
}
async function writeClipboard(text:string){const desktop=(window as unknown as {careerDesktop?:{copyText?:(text:string)=>Promise<unknown>}}).careerDesktop;if(desktop?.copyText)await desktop.copyText(text);else await navigator.clipboard.writeText(text);}
async function copy(text:string){try{await writeClipboard(text);toast('已复制，发送给 Agent 即可继续');}catch{action('复制给 Agent','请选择并复制下面的内容。',text,'已复制',async()=>{},true);}}
const startPrompt='请帮我记录一个求职岗位。先读取工作区 AGENTS.md 和 career-board Skill，向我收集职位描述或链接，创建岗位卡片并把 JD 原文保存到 job.md；来源、公司和职位按我提供的信息记录。需要分析时按 career-board 编排调用 career-company 和 career-match，未关联简历先推荐并询问。';
function addWithAgent(stage='inbox'){
 if(!session||!Object.hasOwn(session.stages,stage))return;
 const label=session.stages[stage]!,prompt=startPrompt+`\n我从「${label}」列发起添加，请将新岗位记录到此阶段（stage: ${stage}），按我提供的实际进展整理。`+(stage==='ended'?`\n保存前先向我确认结束结果：${Object.values(session.outcomes).join('、')}；不要猜测结果。`:'');
 action('添加岗位',`添加到「${label}」。把这段指令发给工作区的 Agent，再提供职位链接或招聘信息。`,prompt,'复制指令',async text=>{await writeClipboard(text);toast('已复制开始指令');},true);
}
function addOpportunity(stage='inbox'){if(!session)return;window.careerJDImporter.open({stage,stages:session.stages,outcomes:session.outcomes,platforms:session.platforms,agent:()=>addWithAgent(stage),create:v=>api('import',v),done:async r=>{await refresh();await openJob(r.id);toast(r.duplicate?'已有相同来源的岗位，已打开原卡片':'岗位已加入看板');}});}
$('#add-opportunity').onclick=()=>addOpportunity();
function starMarkup(rating:number|null){return `<span class="stars" aria-label="${rating?rating+' 星':'未评分'}">${[1,2,3,4,5].map(n=>icon(rating&&n<=rating?'star-fill':'star')).join('')}</span>`;}
function sourceMarkup(source:any,link=false){const name=session.platforms[source.platform]??'其他',label=source.label&&source.platform==='other'?source.label:name;
 const href=typeof source.url==='string'&&/^https?:\/\//.test(source.url)?source.url:'';
 return link&&href?`<a class="source-tag" data-platform="${esc(source.platform)}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}${icon('box-arrow-up-right')}</a>`:`<span class="source-tag" data-platform="${esc(source.platform)}">${esc(label)}</span>`;
}
function renderBoard(){
 if(!board||draggedCard)return;const query=$<HTMLInputElement>('#board-search').value.trim().toLowerCase(),platform=$<HTMLButtonElement>('#source-filter').value,rating=Number($<HTMLButtonElement>('#rating-filter').value),archived=$<HTMLInputElement>('#archive-filter').checked;
 const cards=board.cards.filter(c=>c.archived===archived&&(!query||`${c.title} ${c.company} ${c.location??''}`.toLowerCase().includes(query))&&(!platform||c.sources.some((s:any)=>s.platform===platform))&&(!rating||(c.user_rating??0)>=rating));
 $('#filter-count').textContent=[!!platform,!!rating,archived].filter(Boolean).length?String([!!platform,!!rating,archived].filter(Boolean).length):'';
 if(!cards.length&&(query||platform||rating||archived)){kanban.innerHTML=`<div class="board-empty">${icon('search')}<h2>没有符合条件的岗位</h2><p>换个关键词或清除筛选，再看看其他机会。</p><button class="button primary" id="empty-board-action">清除筛选</button></div>`;$('#empty-board-action').onclick=clearFilters;return;}
 const focus=document.activeElement instanceof HTMLElement?document.activeElement.dataset.opportunity:undefined;
 const scrolls=new Map(Array.from(kanban.querySelectorAll<HTMLElement>('.column-cards')).map(e=>[e.dataset.stage,e.scrollTop]));
 kanban.innerHTML=Object.entries(session.stages).map(([id,label])=>{
  const list=cards.filter(c=>c.stage===id),empty='<p class="column-empty">暂无岗位</p>';
  return `<section class="kanban-column" data-drop-stage="${id}" aria-label="${esc(label)}"><header class="column-heading"><h2>${esc(label)}</h2><span class="column-count">${list.length}</span><button class="icon-button column-new" data-add-stage="${esc(id)}" aria-label="在「${esc(label)}」中新建岗位" title="在「${esc(label)}」中新建岗位" aria-haspopup="dialog">${icon('plus-lg')}</button></header><div class="column-cards" data-stage="${id}">${list.map(c=>`<button class="job-card ${detail?.id===c.id&&drawer.open?'selected':''}" data-opportunity="${c.id}" draggable="${!c.archived}" aria-haspopup="dialog" title="${esc(c.title)}${c.archived?'':' · 拖动可更换阶段'}"><span class="card-heading"><h3>${esc(c.title)}</h3>${c.resume?'<span class="card-resume">已关联简历</span>':''}</span><p class="company" title="${esc(c.company)}">${esc(c.company)}</p><span class="card-location"><span class="location">${esc([c.location,c.salary].filter(Boolean).join(' · '))}</span>${c.stage==='ended'?`<span class="card-result">${esc(session.outcomes[c.outcome??'']??'结果待确认')}</span>`:''}</span><span class="card-meta">${starMarkup(c.user_rating)}${c.sources[0]?sourceMarkup(c.sources[0]):''}</span></button>`).join('')||empty}</div></section>`;}).join('');
 kanban.querySelectorAll<HTMLButtonElement>('[data-add-stage]').forEach(button=>button.onclick=()=>addOpportunity(button.dataset.addStage));
 kanban.querySelectorAll<HTMLElement>('.column-cards').forEach(e=>e.scrollTop=scrolls.get(e.dataset.stage)??0);
 kanban.querySelectorAll<HTMLButtonElement>('[data-opportunity]').forEach(e=>e.onclick=()=>{if(Date.now()>=suppressCardClickUntil&&!mutating&&!stageMove)void openJob(e.dataset.opportunity!);});
 if(focus&&!drawer.open)kanban.querySelector<HTMLElement>(`[data-opportunity="${focus}"]`)?.focus({preventScroll:true});
 if(board.issues.length)notice(`有 ${board.issues.length} 项资料需要核对：${board.issues[0]!.message}`);
}
type BoardCard=Board['cards'][number];
let draggedCard:BoardCard|null=null,stageMove:BoardCard|null=null,suppressCardClickUntil=0,dragFrame=0;
let dragPoint:{x:number;y:number}|null=null;
let boardRefreshId=0,refreshAgain=false;
const moveDialog=document.createElement('dialog');moveDialog.id='move-result-dialog';moveDialog.className='action-dialog';moveDialog.setAttribute('aria-labelledby','move-result-title');document.body.append(moveDialog);
function focusCard(id:string){kanban.querySelector<HTMLElement>(`[data-opportunity="${id}"]`)?.focus({preventScroll:true});}
function clearDropTarget(){kanban.querySelectorAll('.drop-target').forEach(e=>e.classList.remove('drop-target'));}
function finishDrag(){
 const id=draggedCard?.id;draggedCard=null;dragPoint=null;cancelAnimationFrame(dragFrame);dragFrame=0;clearDropTarget();kanban.classList.remove('is-dragging');kanban.querySelector('.dragging')?.classList.remove('dragging');suppressCardClickUntil=Date.now()+350;
 if(id&&!mutating&&!stageMove){renderBoard();focusCard(id);}
}
function dropColumn(target:EventTarget|null){return target instanceof Element?target.closest<HTMLElement>('.kanban-column[data-drop-stage]'):null;}
function scrollWhileDragging(){
 if(!draggedCard||!dragPoint)return;
 const {x,y}=dragPoint,r=kanban.getBoundingClientRect();
 if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom){
  const speed=(at:number,start:number,end:number)=>at<start+48?-Math.ceil((start+48-at)/4):at>end-48?Math.ceil((at-end+48)/4):0;
  kanban.scrollLeft+=speed(x,r.left,r.right);
  const column=dropColumn(document.elementFromPoint(x,y));
  const list=column?.querySelector<HTMLElement>('.column-cards');if(list){const b=list.getBoundingClientRect();list.scrollTop+=speed(y,b.top,b.bottom);}
  clearDropTarget();if(column&&column.dataset.dropStage!==draggedCard.stage)column.classList.add('drop-target');
 }
 dragFrame=requestAnimationFrame(scrollWhileDragging);
}
async function saveCardStage(card:BoardCard,stage:string,outcome?:string){
 if(mutating)return false;mutating=true;
 const tile=kanban.querySelector<HTMLElement>(`[data-opportunity="${card.id}"]`);tile?.classList.add('saving');tile?.setAttribute('aria-busy','true');
 try{
  await api('stage?id='+encodeURIComponent(card.id),{stage,sha256:card.sha256,...(outcome?{outcome}:{})});
  toast(`已移到${session.stages[stage]}`);return true;
 }catch(e){toast((e as Error).message+'；未移动卡片，请查看最新状态后重试');return false;}
 finally{mutating=false;tile?.classList.remove('saving');tile?.removeAttribute('aria-busy');}
}
async function completeCardMove(card:BoardCard,stage:string,outcome?:string){
 const saved=await saveCardStage(card,stage,outcome);
 if(stageMove?.id===card.id)stageMove=null;
 // Read back the saved file (or the newest version after a conflict), never just move the DOM.
 await refresh(true);focusCard(card.id);return saved;
}
function chooseMoveResult(card:BoardCard){
 stageMove=card;let outcome='';
 moveDialog.innerHTML=`<form id="move-result-form"><h2 id="move-result-title">结束这个岗位</h2><p>${esc(card.company)} · ${esc(card.title)}</p><div class="move-result-field"><span id="move-result-label">结果</span><button id="move-result" type="button" class="stage-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="move-result-menu" aria-labelledby="move-result-label move-result-value"><span id="move-result-value">请选择结果</span>${icon('chevron-down')}</button><div id="move-result-menu" class="stage-menu result-menu" role="listbox" aria-label="岗位结果" hidden>${Object.entries(session.outcomes).map(([id,label])=>`<button type="button" role="option" aria-selected="false" tabindex="-1" data-result="${id}">${esc(label)}</button>`).join('')}</div></div><div class="action-buttons"><button id="move-result-cancel" class="button" type="button">取消</button><button class="button primary" type="submit" disabled>移到已结束</button></div></form>`;
 const trigger=$('#move-result'),menu=$('#move-result-menu'),submit=$<HTMLButtonElement>('#move-result-form [type=submit]');
 const closeMenu=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
 const openMenu=()=>{menu.hidden=false;trigger.setAttribute('aria-expanded','true');(menu.querySelector<HTMLElement>('[aria-selected=true]')??menu.querySelector<HTMLElement>('button'))?.focus();};
 trigger.onclick=()=>menu.hidden?openMenu():closeMenu();trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();openMenu();}};
 menu.onclick=e=>{const button=(e.target as HTMLElement).closest<HTMLElement>('[data-result]');if(!button)return;outcome=button.dataset.result!;$('#move-result-value').textContent=session.outcomes[outcome]!;menu.querySelectorAll<HTMLElement>('[data-result]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.result===outcome)));submit.disabled=false;closeMenu();trigger.focus();};
 menu.onkeydown=e=>{
  const buttons=Array.from(menu.querySelectorAll<HTMLButtonElement>('button')),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();}
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();trigger.focus();}
  if(e.key==='Tab'){closeMenu();trigger.focus();}
 };
 moveDialog.onpointerdown=e=>{if(!(e.target as HTMLElement).closest('.move-result-field'))closeMenu();};
 const cancel=()=>{stageMove=null;moveDialog.close();focusCard(card.id);void refresh(true);};
 $('#move-result-cancel').onclick=cancel;moveDialog.oncancel=e=>{e.preventDefault();if(!menu.hidden){closeMenu();trigger.focus();}else if(!mutating)cancel();};
 $('#move-result-form').onsubmit=async e=>{
  e.preventDefault();if(!Object.hasOwn(session.outcomes,outcome)||mutating)return;
  moveDialog.close();await completeCardMove(card,'ended',outcome);
 };
 moveDialog.showModal();trigger.focus();
}
kanban.addEventListener('dragstart',e=>{
 const button=(e.target as HTMLElement).closest<HTMLElement>('[data-opportunity]');
 const card=board?.cards.find(c=>c.id===button?.dataset.opportunity);
 if(!card||card.archived||mutating||stageMove||drawer.open||!e.dataTransfer){e.preventDefault();return;}
 boardRefreshId++;draggedCard={...card};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',card.id);kanban.classList.add('is-dragging');
 requestAnimationFrame(()=>{if(draggedCard?.id===card.id)button?.classList.add('dragging');});
});
kanban.addEventListener('dragover',e=>{
 if(!draggedCard)return;const column=dropColumn(e.target);if(!column)return;
 e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';dragPoint={x:e.clientX,y:e.clientY};
 if(!dragFrame)dragFrame=requestAnimationFrame(scrollWhileDragging);
});
kanban.addEventListener('dragleave',e=>{if(!kanban.contains(e.relatedTarget as Node|null)){dragPoint=null;cancelAnimationFrame(dragFrame);dragFrame=0;clearDropTarget();}});
kanban.addEventListener('drop',e=>{
 if(!draggedCard)return;e.preventDefault();const card=draggedCard,stage=dropColumn(e.target)?.dataset.dropStage;
 // Ignore same-column and external drops; dropping into a stage only changes that stage.
 if(!stage||stage===card.stage||!Object.hasOwn(session.stages,stage)){finishDrag();return;}
 stageMove=card;finishDrag();if(stage==='ended')chooseMoveResult(card);else void completeCardMove(card,stage);
});
document.addEventListener('dragend',finishDrag);
window.addEventListener('blur',()=>{if(draggedCard)finishDrag();});

type FilterChoice={value:string;label:string};
const filterMenus=new Map<string,{set:(value:string)=>void;close:()=>void}>();
function closeFilterMenus(){filterMenus.forEach(control=>control.close());}
function initFilter(id:string,choices:FilterChoice[]){
 const trigger=$<HTMLButtonElement>('#'+id),menu=$('#'+id+'-menu'),field=trigger.closest<HTMLElement>('.filter-control')!;
 menu.innerHTML=choices.map(c=>`<button type="button" role="option" aria-selected="${c.value===trigger.value}" tabindex="-1" data-value="${esc(c.value)}">${esc(c.label)}</button>`).join('');
 const options=Array.from(menu.querySelectorAll<HTMLButtonElement>('[role=option]'));
 const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
 const set=(value:string)=>{trigger.value=value;$('#'+id+'-value').textContent=choices.find(c=>c.value===value)!.label;options.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.value===value)));};
 const focus=(button:HTMLButtonElement|undefined)=>{button?.focus({preventScroll:true});button?.scrollIntoView({block:'nearest'});};
 const open=()=>{
  closeFilterMenus();const bounds=trigger.getBoundingClientRect();
  menu.style.maxHeight=Math.max(80,window.innerHeight-bounds.bottom-18)+'px';
  menu.hidden=false;trigger.setAttribute('aria-expanded','true');focus(options.find(b=>b.dataset.value===trigger.value));
 };
 trigger.onclick=()=>menu.hidden?open():close();
 trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}};
 menu.onclick=e=>{const option=(e.target as HTMLElement).closest<HTMLButtonElement>('[role=option]');if(!option)return;set(option.dataset.value!);close();trigger.focus({preventScroll:true});renderBoard();};
 menu.onkeydown=e=>{
  const index=options.indexOf(document.activeElement as HTMLButtonElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();focus(options[e.key==='Home'?0:e.key==='End'?options.length-1:(index+(e.key==='ArrowDown'?1:options.length-1))%options.length]);}
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();trigger.focus({preventScroll:true});}
  if(e.key==='Tab'){close();trigger.focus({preventScroll:true});}
 };
 document.addEventListener('pointerdown',e=>{if(!field.contains(e.target as Node))close();});
 document.addEventListener('focusin',e=>{if(!field.contains(e.target as Node))close();});
 filterMenus.set(id,{set,close});
}
window.addEventListener('resize',closeFilterMenus);
function clearFilters(){$<HTMLInputElement>('#board-search').value='';filterMenus.forEach(control=>control.set(''));closeFilterMenus();$<HTMLInputElement>('#archive-filter').checked=false;renderBoard();}
$('#clear-filters').onclick=clearFilters;
$('#filter-toggle').onclick=()=>{closeFilterMenus();const hidden=!$('#board-filters').hidden;$('#board-filters').hidden=hidden;$('#filter-toggle').setAttribute('aria-expanded',String(!hidden));};
for(const id of ['board-search','archive-filter'])$('#'+id).addEventListener('input',renderBoard);
async function refresh(force=false){if(mutating||draggedCard||stageMove)return;if(refreshing){if(force)refreshAgain=true;return;}refreshing=true;const request=boardRefreshId;try{
 const previous=board,next=await api<Board>('overview');if(request!==boardRefreshId||draggedCard||stageMove||mutating)return;board=next;$('#board-error').hidden=true;
 if(force||JSON.stringify(previous?.cards)!==JSON.stringify(board.cards)||board.issues.length)renderBoard();
 if(drawer.open&&detail){const id=detail.id,latest=await api<Detail>('detail?id='+encodeURIComponent(id));if(detail?.id!==id)return;const changed=detail.card.sha256!==latest.card.sha256,filesChanged=JSON.stringify(detail.files)!==JSON.stringify(latest.files);detail=latest;if(changed)renderHeader();if(tab==='files'&&filesChanged)renderTree();if(tab==='resume'){await renderResumes(true);}else if(tab==='outreach'){await renderOutreach(true);}else if(tab==='interviews'){const version=JSON.stringify(detail.interviews);if(force||roundListVersion!==version){if(roundId&&!detail.interviews.some(r=>r.meta.id===roundId))roundId=null;renderInterviews();}if(roundId)await loadDocument(true);}else if(force||activePath.toLowerCase().endsWith('.md'))await loadDocument(true);}
 }catch(e){notice(e);}finally{refreshing=false;if(refreshAgain){refreshAgain=false;void refresh(true);}}}
$('#refresh-board').onclick=()=>void refresh(true);
function savePosition(){const scroller=view.querySelector<HTMLElement>('.reader-scroll,.media-canvas');if(scroller&&currentKey)positions.set(currentKey,scroller.scrollTop);}
function restorePosition(){const scroller=view.querySelector<HTMLElement>('.reader-scroll,.media-canvas');if(scroller)scroller.scrollTop=positions.get(currentKey)??0;}
function disposeMedia(){pdfEpoch++;pdfRender?.cancel();pdfRender=null;if(pdfTask)void pdfTask.destroy().catch(()=>{});pdfTask=null;pdf=null;}
async function openJob(id:string){const request=++loadId;try{const next=await api<Detail>('detail?id='+encodeURIComponent(id));if(request!==loadId)return;savePosition();disposeMedia();detail=next;tab='overview';roundId=null;roundDoc='record';closeStageMenu();sourceMode=false;fileSelection=next.files.some(f=>f.path.endsWith('/job.md'))?'job.md':'card.md';docVersion='';renderHeader();if(!drawer.open)drawer.showModal();renderBoard();await selectTab('overview');}catch(e){notice(e);}}
function renderHeader(){if(!detail)return;const m=detail.card.meta;
 $('#job-title').textContent=m.title;$('#job-company').textContent=m.company;$('#job-location').textContent=[m.location,m.salary].filter(Boolean).join(' · ');$('#job-breadcrumb').textContent=m.company+' / '+m.title;
 $('#stage-value').textContent=session.stages[m.stage]+(m.stage==='ended'?' · '+(session.outcomes[m.outcome??'']??'待确认'):'');$('#archive-job').textContent=m.archived?'移回看板':'归档';
 $('#job-rating').innerHTML=[1,2,3,4,5].map(n=>`<button type="button" aria-label="设为 ${n} 星" aria-pressed="${m.user_rating===n}" data-stars="${n}" title="${n} 星">${icon(n<=(m.user_rating??0)?'star-fill':'star')}</button>`).join('')+(m.user_rating?'<button class="clear-rating" data-stars="none" aria-label="清除星级">清除</button>':'');
 $('#job-rating').querySelectorAll<HTMLElement>('[data-stars]').forEach(e=>e.onclick=()=>void mutate('rate',{stars:e.dataset.stars}));$('#job-sources').innerHTML=m.sources.map((s:any)=>sourceMarkup(s,true)).join('');
}
async function mutate(type:string,values:Record<string,unknown>){if(!detail||mutating)return false;mutating=true;const id=detail.id;try{await api(type+'?id='+id,{...values,sha256:detail.card.sha256});toast(type==='rate'?'星级已保存':type==='archive'?'归档状态已保存':'阶段已保存');return true;}catch(e){toast((e as Error).message+'；已重新读取最新内容');return false;}finally{mutating=false;await refresh(true);}}
function closeStageMenu(){ $('#stage-menu').hidden=true;$('#job-stage').setAttribute('aria-expanded','false'); }
function renderStageMenu(){
 const m=detail!.card.meta,menu=$('#stage-menu');menu.innerHTML=stageMenuMode==='outcomes'?`<button class="menu-back" role="menuitem" data-back>← 返回阶段</button>`+Object.entries(session.outcomes).map(([id,label])=>`<button role="menuitemradio" aria-checked="${m.stage==='ended'&&m.outcome===id}" data-outcome="${id}">${esc(label)}</button>`).join(''):Object.entries(session.stages).map(([id,label])=>`<button role="menuitemradio" aria-checked="${m.stage===id}" data-stage="${id}">${esc(label)}${id==='ended'?icon('chevron-right'):''}</button>`).join('');
 menu.hidden=false;$('#job-stage').setAttribute('aria-expanded','true');
}
$('#job-stage').onclick=()=>{if(!$('#stage-menu').hidden){closeStageMenu();return;}stageMenuMode='stages';renderStageMenu();($('#stage-menu').querySelector<HTMLElement>('[aria-checked="true"]')??$('#stage-menu').querySelector<HTMLElement>('button'))?.focus();};
$('#stage-menu').onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('button');if(!b)return;if(b.hasAttribute('data-back')){stageMenuMode='stages';renderStageMenu();}else if(b.dataset.stage==='ended'){stageMenuMode='outcomes';renderStageMenu();}else{closeStageMenu();void mutate('stage',b.dataset.outcome?{stage:'ended',outcome:b.dataset.outcome}:{stage:b.dataset.stage});$('#job-stage').focus();return;}$('#stage-menu').querySelector<HTMLElement>('button')?.focus();};
$('#stage-menu').onkeydown=e=>{const buttons=Array.from($('#stage-menu').querySelectorAll<HTMLButtonElement>('button'));const i=buttons.indexOf(document.activeElement as HTMLButtonElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeStageMenu();$('#job-stage').focus();}};
document.addEventListener('pointerdown',e=>{if(!(e.target as HTMLElement).closest('.stage-control'))closeStageMenu();});
$('#archive-job').onclick=()=>void mutate('archive',{archived:!detail!.card.meta.archived});
function setExpanded(value:boolean){drawer.classList.toggle('expanded',value);const label=value?'退出展开':'展开阅读';$('#expand-drawer').setAttribute('aria-label',label);$('#expand-drawer').title=label;$('#expand-drawer').innerHTML=icon(value?'arrows-angle-contract':'arrows-angle-expand');}
function closeDrawer(){if(!$('#stage-menu').hidden){closeStageMenu();$('#job-stage').focus();return;}if(drawer.classList.contains('expanded')){setExpanded(false);return;}if(tab==='interviews'&&roundId){roundId=null;renderInterviews();return;}drawer.close();}
$('#expand-drawer').onclick=()=>setExpanded(!drawer.classList.contains('expanded'));
$('#close-drawer').onclick=closeDrawer;
drawer.addEventListener('cancel',e=>{e.preventDefault();closeDrawer();});
drawer.addEventListener('close',()=>{savePosition();loadId++;disposeMedia();setExpanded(false);renderBoard();if(detail)kanban.querySelector<HTMLElement>(`[data-opportunity="${detail.id}"]`)?.focus({preventScroll:true});});
drawer.addEventListener('click',e=>{if(e.target===drawer){const r=drawer.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right)closeDrawer();}});
$('#copy-job').onclick=async()=>{if(tab==='outreach'){$('#outreach-generate')?.click();return;}if(!detail)return;const op=detail.id,selectedTab=tab;try{const context=await api('context?id='+op);if(detail?.id!==op||tab!==selectedTab||!drawer.open)return;await copy(context.prompt+(selectedTab==='match'?'\n本次只处理以下请求：'+matchInstruction:selectedTab==='company'?'\n本次只处理以下请求：'+companyInstruction:''));}catch(e){toast((e as Error).message);}};
async function selectTab(value:string){savePosition();tab=value;sourceMode=false;docVersion='';$('#primary-tools').append(readerTools);setDocumentTools();$('#interview-navigation').hidden=tab!=='interviews';$('#interview-actions').hidden=tab!=='interviews'||!roundId;$('#job-panel').classList.toggle('files-mode',tab==='files');tree.hidden=tab!=='files';
 document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.tabIndex=b.dataset.tab===tab?0:-1;});$('#job-panel').setAttribute('aria-labelledby','tab-'+tab);keepSelectedTabVisible();if(tab==='resume'||tab==='outreach'){loadId++;disposeMedia();activePath='';if(tab==='resume')await renderResumes();else await renderOutreach();return;}if(tab==='files')renderTree();if(tab==='interviews'){renderInterviews();if(!roundId)return;}await loadDocument();}
function keepSelectedTabVisible(){
 if(!drawer.open)return;const nav=$('#job-tabs'),selected=$('#tab-'+tab);if(!selected)return;
 const bounds=nav.getBoundingClientRect(),item=selected.getBoundingClientRect();
 if(item.left<bounds.left)nav.scrollLeft+=item.left-bounds.left;else if(item.right>bounds.right)nav.scrollLeft+=item.right-bounds.right;
}
new ResizeObserver(keepSelectedTabVisible).observe($('#job-tabs'));
$('#job-tabs').addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLElement>('[data-tab]');if(button)void selectTab(button.dataset.tab!);});
$('#job-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=['overview','company','match','interviews','files','resume','outreach'];const index=e.key==='Home'?0:e.key==='End'?tabs.length-1:(tabs.indexOf(tab)+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;$('#tab-'+tabs[index]).focus();void selectTab(tabs[index]!);});
function fileIcon(p:string){return /\.pdf$/i.test(p)?'file-earmark-pdf':/\.(png|jpe?g|webp|gif)$/i.test(p)?'file-earmark-image':'file-earmark-text';}
function renderTree(){if(!detail)return;const wasOpen=new Set(Array.from(tree.querySelectorAll<HTMLDetailsElement>('details[open]')).map(e=>e.dataset.folder));const first=!tree.dataset.card||tree.dataset.card!==detail.id;tree.dataset.card=detail.id;const scroll=tree.scrollTop;
 type Node={files:string[];dirs:Map<string,Node>};const root:Node={files:[],dirs:new Map()};const prefix=`opportunities/${detail.id}/`;
 for(const f of detail.files){const p=f.path.slice(prefix.length);let node=root;const parts=p.split('/');for(const part of parts.slice(0,-1)){if(!node.dirs.has(part))node.dirs.set(part,{files:[],dirs:new Map()});node=node.dirs.get(part)!;}node.files.push(p);}
 const names:Record<string,string>={analysis:'分析',interviews:'面试',attachments:'附件',tasks:'协作记录',activity:'变更记录'};
 function nodes(node:Node,parent=''):string{return node.files.map(p=>`<button class="file-item ${p===fileSelection?'active':''}" data-file="${esc(p)}" title="${esc(p)}">${icon(fileIcon(p))}<span>${esc(p.split('/').at(-1))}</span></button>`).join('')+Array.from(node.dirs).map(([name,child])=>{const p=parent?parent+'/'+name:name;const opened=wasOpen.has(p)||(first&&!['activity','tasks'].includes(name))||fileSelection.startsWith(p+'/');return `<details data-folder="${esc(p)}" ${opened?'open':''}><summary>${icon('folder2-open')}<span>${esc(names[name]??name)}</span></summary><div class="tree-children">${nodes(child,p)}</div></details>`;}).join('');}
 tree.innerHTML='<p class="file-tree-title">岗位资料</p>'+nodes(root);tree.scrollTop=scroll;
 tree.querySelectorAll<HTMLElement>('[data-file]').forEach(e=>e.onclick=()=>{savePosition();fileSelection=e.dataset.file!;sourceMode=false;docVersion='';renderTree();void loadDocument();});
}
const matchInstruction='请使用 career-match Skill，读取 report 和 storage 要求，只分析 JD 与当前关联简历。正文先给投递判断，再写主要匹配证据、差距与未知、具体简历修改建议及面试准备重点；区分本版未体现与真实能力差距，不编造经历。按 career-match/v1 将总体结论、逐项证据与 0–4 评分、权重、必要条件及真实输入摘要写在 analysis/match.md 的 YAML 文件头；正文不要堆 ID、路径、哈希和行号。未知分数为 null，不按关键词凑分。保存前后运行 opportunity match-check 核对结果，不把文件已写入当分析完成。若未关联简历，先推荐并询问；不静默绑定、不改简历或个人星标，不展开公司研究。';
const companyInstruction='请使用 career-company Skill，读取 report 要求，只做这家公司与具体岗位环境的分析并保存到 analysis/company.md。先给是否继续了解的结论，再写已核实的公司业务、岗位与团队、机会与风险、优先核实的问题及下一步，关键判断附可读来源与日期。资料不足明确限制，不猜经营或团队情况；不把用户离职处境、聊天记录、文件路径或哈希堆进正文，不在此做简历逐项匹配。企查查未配置时可使用可用公开来源，保留已有用户笔记和有效证据。';
function matchMarkup(result:MatchSummary){
 const hint=result.state==='unscored'?'这份报告只有文字分析，尚未保存总体结果。更新分析可补齐评分依据、差距和具体建议。':result.state==='invalid'?'已保留原文；请更新分析，核对评分格式与输入版本。':'结合具体经历核对岗位要求，给出投递判断、简历修改建议与面试准备重点。';
 const score=result.score,meta=result.meta,old=result.state==='stale'||result.state==='unverified';
 const value=score?.value??null,percent=value===null?0:Math.max(0,Math.min(100,value));
 const unknown=score&&score.coverage<100;
 const verdict=result.state==='missing'?'还没有匹配分析':result.state==='unscored'?'已有分析，尚未形成总体评分':result.state==='invalid'?'总体评分待核对':value===null?'证据不足，暂不评分':old?'上次分析结果':unknown?'基于已知证据的匹配度':'总体匹配度';
 return `<section class="match-overview" aria-labelledby="match-title"><header><div><p class="match-eyebrow">简历与岗位匹配</p><h3 id="match-title">${verdict}</h3></div><button id="update-match" class="button">${result.exists?'更新分析':'开始分析'}</button></header>${result.warnings.length?`<p class="outreach-warning" role="status">${esc(result.warnings.join('；'))}</p>`:''}${score?`<div class="match-score-row"><div class="match-score"><strong>${value===null?'—':value}</strong>${value===null?'':'<span> / 100</span>'}<div class="match-stars" role="img" aria-label="${value===null?'证据不足，未评分':`匹配分 ${value}，满分 100`}"><span aria-hidden="true">${[1,2,3,4,5].map(()=>icon('star')).join('')}</span><span aria-hidden="true" class="match-stars-fill" style="width:${percent}%">${[1,2,3,4,5].map(()=>icon('star-fill')).join('')}</span></div></div><div class="match-coverage"><strong>证据覆盖 ${score.coverage}%</strong><p>${unknown?'部分要求尚无法判断，需补充后再看总体结论。':'各项要求均有可判定依据。'}</p>${unknown?`<small>未知项取极值时：${score.lower}–${score.upper} 分</small>`:''}</div></div>`:`<p class="edit-hint">${hint}</p>`}${meta?`<p class="match-conclusion">${esc(meta.summary)}</p>${meta.hard_conditions.length?`<ul class="match-conditions">${meta.hard_conditions.map(c=>`<li data-condition="${c.status}"><strong>${c.status==='unmet'?'条件不满足':c.status==='unknown'?'条件待确认':'条件符合'} · ${esc(c.label)}</strong><span>${esc(c.reason)}</span></li>`).join('')}</ul>`:''}<p class="match-source">依据：${esc(result.resumeTitle??meta.resume_id)} · ${esc(meta.assessed_at.slice(0,10))}${old?' · 待更新':''}</p><details class="match-method"><summary>评分怎么看</summary><p>按各项任务的 0–4 分及权重计算，未知项不当作零分。证据覆盖表示可判断的要求占比；分数用于辅助判断，不代表录用概率。星形图示按百分制等比例展示，与上方个人星标独立。</p><ul>${meta.criteria.map(c=>`<li><strong>${esc(c.id)}</strong><span>权重 ${c.weight}% · ${c.score===null?'待补充':`${c.score} / 4`}</span><p>${esc(c.reason)}</p></li>`).join('')}</ul></details>`:''}</section>`;
}
function bindMatch(){
 $('#update-match')?.addEventListener('click',async()=>{if(!detail)return;const op=detail.id;try{const context=await api('context?id='+op);if(detail?.id!==op||tab!=='match'||!drawer.open)return;await copy(context.prompt+'\n本次只处理以下请求：'+matchInstruction);}catch(e){toast((e as Error).message);}});
}
function emptyDocument(label:string,p:string){
 const jd=p==='job.md';
 const hint=jd?'粘贴招聘原文或提供来源链接，让 Agent 补充到这里。':'让 Agent 结合已有岗位资料整理，完成后会显示在这里。';
 const instruction=jd?'请补充这个岗位的 JD 原文并保存到 job.md；先核对已有来源和资料，读不到时请我提供正文。不要把旧概况、待确认事项或推测写成招聘原文。':p==='analysis/company.md'?companyInstruction:p==='analysis/match.md'?matchInstruction:`请整理${label}，保存到该岗位的 ${p}；标注资料来源和待核实内容。`;
 view.innerHTML=`<div class="empty-document">${icon('file-earmark-text')}<h3>${jd?'尚未保存职位描述':'还没有'+esc(label)}</h3><p>${hint}</p><button id="create-document" class="button primary">${icon('copy')}${jd?'复制补充指令':'复制整理指令'}</button></div>`;
 $('#create-document').onclick=async()=>{try{const context=await api('context?id='+detail!.id);await copy(context.prompt+'\n本次只处理以下请求：'+instruction);}catch(e){toast((e as Error).message);}};
}
let outlineOpen=window.innerWidth>1100,wideReader=window.innerWidth>1100;
window.addEventListener('resize',()=>{const wide=window.innerWidth>1100;if(wideReader&&!wide){outlineOpen=false;const outline=view.querySelector<HTMLElement>('.document-toc');if(outline){outline.hidden=true;outline.classList.remove('open-outline');}documentActions.querySelector('#toggle-outline')?.setAttribute('aria-expanded','false');}wideReader=wide;});
// One shared control group follows the active document, beside its tabs.
function setDocumentTools(p='',doc?:DocumentResult){
 const focused=documentActions.contains(document.activeElement)?(document.activeElement as HTMLElement)?.id:'';
 documentActions.innerHTML=p?`${doc?`<button id="toggle-outline" aria-expanded="${!sourceMode&&outlineOpen&&doc.toc.length>1}" aria-controls="document-outline" ${sourceMode||doc.toc.length<2?'disabled':''}>目录</button><button id="mode-preview" class="${sourceMode?'':'active'}" aria-pressed="${!sourceMode}">预览</button><button id="mode-source" class="${sourceMode?'active':''}" aria-pressed="${sourceMode}">原文</button>`:''}<a class="icon-button" href="${esc(fileUrl(p,true))}" download aria-label="下载文件" title="下载">${icon('download')}</a>`:'';
 if(focused)documentActions.querySelector<HTMLElement>('#'+focused)?.focus({preventScroll:true});
 if(!doc)return;
 $('#toggle-outline').onclick=()=>{outlineOpen=!outlineOpen;const outline=view.querySelector<HTMLElement>('.document-toc');if(outline){outline.hidden=!outlineOpen;outline.classList.toggle('open-outline',outlineOpen);}$('#toggle-outline').setAttribute('aria-expanded',String(outlineOpen));};
 $('#mode-preview').onclick=()=>{savePosition();sourceMode=false;docVersion='';void loadDocument();};
 $('#mode-source').onclick=()=>{savePosition();sourceMode=true;docVersion='';void loadDocument();};
}
async function loadDocument(quiet=false){
 if(!detail||!drawer.open||tab==='resume'||tab==='outreach')return;const selected=session.documents.find(d=>d.id===tab),p=tab==='files'?fileSelection:tab==='interviews'?interviewPath():selected!.path,id=detail.id;if(!p)return;if(quiet&&!/\.md$/i.test(p))return;const request=++loadId;
 const key=id+'/'+tab+'/'+p;if(key!==currentKey){savePosition();currentKey=key;setDocumentTools();}activePath=p;
 const summary=tab==='match'?await api<MatchSummary>('match-summary?id='+id).catch(()=>({exists:false,state:'unverified' as const,warnings:['暂时无法读取总体评分，请稍后重试']})):null;if(request!==loadId||!drawer.open)return;
 const summaryVersion=summary?JSON.stringify(summary):'';
 if(!detail.files.some(f=>f.path===`opportunities/${id}/${p}`)){if(quiet&&docVersion==='missing:'+p+summaryVersion)return;disposeMedia();setDocumentTools();docVersion='missing:'+p+summaryVersion;if(tab==='interviews'){emptyInterviewDocument();}else emptyDocument(selected?.label??'这份资料',p);if(summary){const scroll=document.createElement('div');scroll.className='reader-scroll match-missing';scroll.append(...view.childNodes);view.append(scroll);scroll.insertAdjacentHTML('afterbegin',matchMarkup(summary));bindMatch();}return;}
 try{
 if(/\.md$/i.test(p)){
   const doc=await api<DocumentResult>('file?'+new URLSearchParams({id,path:p}));if(request!==loadId||!drawer.open)return;
   if(quiet&&docVersion===doc.sha256+summaryVersion)return;savePosition();disposeMedia();docVersion=doc.sha256+summaryVersion;setDocumentTools(p,doc);
   if(tab==='interviews'&&!sourceMode&&!doc.content.trim()){emptyInterviewDocument();return;}
   if(tab==='overview'&&!sourceMode&&!doc.content.trim()){emptyDocument('JD',p);return;}
   const content=doc.content.trim()?doc.html:'<p class="loading">这份文档还没有正文。</p>';
   view.innerHTML=`<div class="reader-layout"><div class="reader-scroll">${sourceMode?`<pre class="source-code">${esc(doc.source)}</pre>`:`${summary?matchMarkup(summary):''}<article class="markdown-body">${content}</article>`}</div>${!sourceMode&&doc.toc.length>1?`<nav id="document-outline" class="document-toc" aria-label="本文目录" ${outlineOpen?'':'hidden'}><p>本文目录</p>${doc.toc.map(h=>`<a href="#${esc(h.id)}" class="${h.level>2?'subheading':''}">${esc(h.label)}</a>`).join('')}</nav>`:''}</div>`;
   if(summary&&!sourceMode)bindMatch();
   view.querySelectorAll<HTMLAnchorElement>('a[data-document]').forEach(a=>a.onclick=e=>{e.preventDefault();savePosition();fileSelection=a.dataset.document!;void selectTab('files');});
   view.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();const anchor=decodeURIComponent(a.getAttribute('href')!.slice(1));Array.from(view.querySelectorAll<HTMLElement>('.markdown-body [id]')).find(h=>h.id===anchor)?.scrollIntoView({block:'start'});view.querySelectorAll('.document-toc .active').forEach(e=>e.classList.remove('active'));if(a.closest('.document-toc'))a.classList.add('active');});view.querySelector('.document-toc')?.classList.toggle('open-outline',outlineOpen);restorePosition();
 }else if(quiet){return;}
 else if(/\.pdf$/i.test(p)){disposeMedia();docVersion='';await showPdf(p,request);}
 else if(/\.(png|jpe?g|webp|gif)$/i.test(p)){
   disposeMedia();docVersion='';imageZoom=1;setDocumentTools(p);documentActions.insertAdjacentHTML('afterbegin',`<div class="pdf-controls"><button id="image-fit">适应窗口</button><button id="image-minus" aria-label="缩小图片">${icon('dash-lg')}</button><span id="image-scale">100%</span><button id="image-plus" aria-label="放大图片">${icon('plus-lg')}</button></div>`);view.innerHTML=`<div class="media-canvas"><img id="preview-image" src="${esc(fileUrl(p))}" alt="${esc(p.split('/').at(-1))}"></div>`;
   const img=$<HTMLImageElement>('#preview-image');const scale=()=>{img.style.maxWidth=imageZoom===1?'100%':'none';img.style.width=imageZoom===1?'auto':(img.naturalWidth*imageZoom)+'px';$('#image-scale').textContent=Math.round(imageZoom*100)+'%';};$('#image-fit').onclick=()=>{imageZoom=1;scale();};$('#image-minus').onclick=()=>{imageZoom=Math.max(.25,imageZoom-.25);scale();};$('#image-plus').onclick=()=>{imageZoom=Math.min(3,imageZoom+.25);scale();};img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('p'),{textContent:'图片无法预览，可以下载原文件查看。'}));};img.onload=restorePosition;
 }else {disposeMedia();setDocumentTools(p);view.innerHTML=`<div class="empty-document">${icon('file-earmark-text')}<h3>下载查看这份文件</h3><p>这里支持 Markdown、PDF 和图片预览。</p><a class="button" href="${esc(fileUrl(p,true))}" download>${icon('download')}下载文件</a></div>`;}
 }catch(e){if(request!==loadId)return;setDocumentTools();view.innerHTML=`<div class="empty-document"><h3>暂时无法读取</h3><p>${esc((e as Error).message)}</p><button id="retry-file" class="button">重新读取</button></div>`;$('#retry-file').onclick=()=>void loadDocument();}
}
async function showPdf(p:string,request:number){
 const epoch=pdfEpoch;pdfPage=1;pdfZoom=1;setDocumentTools(p);documentActions.insertAdjacentHTML('afterbegin',`<div class="pdf-controls"><button id="pdf-prev" aria-label="上一页">${icon('chevron-left')}</button><span id="pdf-page">正在加载…</span><button id="pdf-next" aria-label="下一页">${icon('chevron-right')}</button><button id="pdf-minus" aria-label="缩小 PDF">${icon('dash-lg')}</button><span id="pdf-scale">100%</span><button id="pdf-plus" aria-label="放大 PDF">${icon('plus-lg')}</button><button id="pdf-fit">适应宽度</button></div>`);view.innerHTML=`<div class="media-canvas"><canvas id="pdf-canvas" aria-label="PDF 页面预览"></canvas></div>`;
 const moduleUrl='/board-assets/pdf/pdf.mjs',lib=await import(moduleUrl);if(request!==loadId||epoch!==pdfEpoch)return;lib.GlobalWorkerOptions.workerSrc='/board-assets/pdf/pdf.worker.mjs';
 pdfTask=lib.getDocument({url:fileUrl(p),cMapUrl:'/board-assets/pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'/board-assets/pdf/standard_fonts/',wasmUrl:'/board-assets/pdf/wasm/',isEvalSupported:false});
 pdf=await pdfTask.promise;if(request!==loadId||epoch!==pdfEpoch)return;
 async function draw(){const thisPdf=pdf,num=pdfPage;pdfRender?.cancel();try{const page=await thisPdf.getPage(num);if(pdf!==thisPdf||num!==pdfPage)return;const canvas=$<HTMLCanvasElement>('#pdf-canvas'),container=view.querySelector<HTMLElement>('.media-canvas')!;const normal=page.getViewport({scale:1});const scale=Math.min((container.clientWidth-48)/normal.width,1.5)*pdfZoom;const viewport=page.getViewport({scale}),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(viewport.width*dpr);canvas.height=Math.floor(viewport.height*dpr);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';pdfRender=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:dpr===1?null:[dpr,0,0,dpr,0,0]});await pdfRender.promise;
 $('#pdf-page').textContent=`${num} / ${thisPdf.numPages}`;$('#pdf-scale').textContent=Math.round(pdfZoom*100)+'%';$<HTMLButtonElement>('#pdf-prev').disabled=num===1;$<HTMLButtonElement>('#pdf-next').disabled=num===thisPdf.numPages;
 }catch(e){if((e as Error).name!=='RenderingCancelledException'&&epoch===pdfEpoch)toast('PDF 渲染失败，可以下载原文件查看');}}
 $('#pdf-prev').onclick=()=>{if(pdfPage>1){pdfPage--;void draw();}};$('#pdf-next').onclick=()=>{if(pdfPage<pdf.numPages){pdfPage++;void draw();}};$('#pdf-minus').onclick=()=>{pdfZoom=Math.max(.5,pdfZoom-.25);void draw();};$('#pdf-plus').onclick=()=>{pdfZoom=Math.min(2.5,pdfZoom+.25);void draw();};$('#pdf-fit').onclick=()=>{pdfZoom=1;void draw();};await draw();
}
function currentRound(){return detail?.interviews.find(r=>r.meta.id===roundId);}
function roundMocks(){const round=currentRound();return round?.documents.filter(p=>p.startsWith(`interviews/${roundId}/simulations/`)&&p.endsWith('.md')).sort()??[];}
function interviewPath(){if(!roundId)return '';if(roundDoc==='record')return `interviews/${roundId}/record.md`;if(roundDoc==='preparation')return `interviews/${roundId}/preparation.md`;const mocks=roundMocks();return mocks.includes(mockPath)?mockPath:mocks[0]??`interviews/${roundId}/simulations/session.md`;}
function roundDate(value:string|null|undefined){if(!value)return '时间待定';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value.replace(/-/g,'/');return new Intl.DateTimeFormat('zh-CN',{timeZone:board.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
function renderInterviews(){
 if(!detail||tab!=='interviews')return;roundListVersion=JSON.stringify(detail.interviews);const nav=$('#interview-navigation'),actions=$('#interview-actions');const round=currentRound();$('#primary-tools').append(readerTools);setDocumentTools();
 if(!round){loadId++;roundId=null;activePath='';docVersion='';disposeMedia();nav.hidden=true;nav.replaceChildren();actions.hidden=true;
  view.innerHTML=`<div class="interview-list"><div class="interview-list-heading"><h3>面试轮次</h3><button id="add-round" class="button">${icon('plus-lg')}添加轮次</button></div>${detail.interviews.length?detail.interviews.map(r=>`<button class="interview-row" data-round="${esc(r.meta.id)}"><div><h4>${esc(r.meta.title)}</h4><p>${esc(roundDate(r.meta.scheduled_at))}</p></div><span class="round-status">${esc(session.interviewStatuses[r.meta.status])}</span>${icon('chevron-right')}</button>`).join(''):'<div class="interview-list-empty"><h4>还没有面试轮次</h4><p>收到面试安排后，添加一轮开始记录。<br>也可以先做准备或模拟练习。</p></div>'}<div class="interview-general"><button class="text-button" id="general-prepare">岗位面试准备</button><button class="text-button" id="general-mock">模拟练习</button>${detail.files.some(f=>f.path.includes('/interviews/')&&!f.path.includes('/interviews/interview-'))?'<button class="text-button" id="other-interviews">其他面试资料</button>':''}</div></div>`;
  $('#add-round').onclick=()=>editRound();view.querySelectorAll<HTMLElement>('[data-round]').forEach(b=>b.onclick=()=>{savePosition();roundId=b.dataset.round!;roundDoc='record';sourceMode=false;docVersion='';renderInterviews();void loadDocument();});
  $('#general-prepare').onclick=()=>void interviewPrompt('preparation',true);$('#general-mock').onclick=()=>void interviewPrompt('simulation',true);
  view.querySelector<HTMLElement>('#other-interviews')?.addEventListener('click',()=>{fileSelection=detail!.files.find(f=>f.path.includes('/interviews/')&&!f.path.includes('/interviews/interview-'))!.path.split('/').slice(2).join('/');void selectTab('files');});return;
 }
 nav.hidden=false;actions.hidden=false;docVersion='';
 nav.innerHTML=`<div class="interview-heading"><h3><button id="back-rounds" type="button" class="interview-back" aria-label="${esc(round.meta.title)}，返回面试轮次" title="返回面试轮次">${icon('chevron-left')}<span>${esc(round.meta.title)}</span></button></h3><button class="text-button" id="edit-round">编辑轮次</button></div><div class="interview-controls"><div class="interview-docnav" role="group" aria-label="本轮文档">${[['record','面试记录'],['preparation','准备材料'],['simulation','模拟记录']].map(([id,label])=>`<button data-round-doc="${id}" aria-pressed="${roundDoc===id}">${label}</button>`).join('')}</div><div id="interview-tools"></div></div>${roundDoc==='simulation'&&roundMocks().length?`<div class="mock-selection"><select id="mock-picker" aria-label="选择模拟记录">${roundMocks().map((p,i)=>`<option value="${esc(p)}" ${p===interviewPath()?'selected':''}>第 ${i+1} 次模拟</option>`).join('')}</select></div>`:''}`;
 $('#interview-tools').append(readerTools);
 actions.innerHTML='<button class="button" data-round-action="preparation">准备本轮</button><button class="button" data-round-action="simulation">模拟本轮</button><button class="button primary" data-round-action="record">补充记录</button>';
 $('#back-rounds').onclick=()=>{savePosition();roundId=null;renderInterviews();};$('#edit-round').onclick=()=>editRound(round);
 nav.querySelectorAll<HTMLElement>('[data-round-doc]').forEach(b=>b.onclick=()=>{savePosition();roundDoc=b.dataset.roundDoc!;sourceMode=false;docVersion='';renderInterviews();void loadDocument();});
 nav.querySelector<HTMLSelectElement>('#mock-picker')?.addEventListener('change',e=>{savePosition();mockPath=(e.target as HTMLSelectElement).value;sourceMode=false;docVersion='';void loadDocument();});
 actions.querySelectorAll<HTMLElement>('[data-round-action]').forEach(b=>b.onclick=()=>void interviewPrompt(b.dataset.roundAction!));
}
function emptyInterviewDocument(){const label=roundDoc==='record'?'这轮还没有面试记录':roundDoc==='preparation'?'尚未整理本轮准备材料':'这轮还没有模拟记录';const note=roundDoc==='record'?'面试后把经过讲给 Agent，整理实际问题、回答和反馈。':'需要时再交给 Agent，准备与模拟都可以跳过。';view.innerHTML=`<div class="empty-document">${icon('file-earmark-text')}<h3>${label}</h3><p>${note}</p><button class="button" id="interview-empty-action">${icon('copy')}复制协作指令</button></div>`;$('#interview-empty-action').onclick=()=>void interviewPrompt(roundDoc);}
async function interviewPrompt(kind:string,general=false){
 if(!detail)return;try{const context=await api('context?id='+detail.id);const base=general?'interviews/general':`interviews/${roundId}`;
 const scope=general?'岗位通用面试练习':`真实面试轮次 ${roundId}（${currentRound()?.meta.title}）`;
 const command=(window as unknown as {careerDesktop?:{commandPrefix:string}}).careerDesktop?.commandPrefix??'npm run career --';
 const start=general?'先读取已有面试资料。':`先执行 ${command} interview context --opportunity ${detail.id} --round ${roundId} --json，结合之前轮次。`;
 const job=kind==='preparation'?`按我的需要准备面试，保存自由 Markdown 到 ${base}/preparation.md；已有内容先读取并合并。不要求填完固定提纲。`:kind==='simulation'?`先和我确定练习重点，再一次问一个问题，结束后整理本次模拟反馈。每次记录使用 ${base}/simulations/ 下独立且不重名的 Markdown 文件；标明模拟，不改变真实面试或岗位阶段。`:`请听我讲实际面试经过，保留问题、回答和反馈，按需要一起复盘。用 interview save 更新本轮 record.md 的 body，保留其他元数据，提供最新 --if-match；记录与分析分清，结果未知就留待确认。`;
 await copy(context.prompt+`\n本次范围：${scope}。${start}\n${job}\n准备、模拟与真实记录互不作为前置条件，只做我本次选择的事情。`);
 }catch(e){toast((e as Error).message);}
}
function editRound(round?:Detail['interviews'][number]){
 const dialog=$<HTMLDialogElement>('#interview-dialog'),form=$<HTMLFormElement>('#interview-form');$('#interview-form-title').textContent=round?'编辑面试轮次':'添加面试轮次';$<HTMLInputElement>('#round-title').value=round?.meta.title??'';$<HTMLInputElement>('#round-date').value=round?.meta.scheduled_at?.slice(0,10)??'';$<HTMLSelectElement>('#round-status').value=round?.meta.status??'planned';$('#round-error').textContent='';
 $('#round-cancel').onclick=()=>dialog.close();form.onsubmit=async e=>{e.preventDefault();if(mutating||!detail)return;const op=detail.id,submit=form.querySelector<HTMLButtonElement>('[type=submit]')!;submit.disabled=true;mutating=true;try{
  const date=$<HTMLInputElement>('#round-date').value;const scheduled_at=round&&date===(round.meta.scheduled_at?.slice(0,10)??'')?round.meta.scheduled_at??null:date||null;
  const result=await api('interview?id='+op,{title:$<HTMLInputElement>('#round-title').value.trim(),scheduled_at,status:$<HTMLSelectElement>('#round-status').value,...(round?{round:round.meta.id,sha256:round.sha256}:{})});
  detail=await api<Detail>('detail?id='+op);roundId=result.id;roundDoc='record';docVersion='';sourceMode=false;dialog.close();renderInterviews();await loadDocument();toast('面试轮次已保存');
 }catch(e){$('#round-error').textContent=(e as Error).message+'；如果记录已被修改，请取消后重新打开最新轮次。';}finally{submit.disabled=false;mutating=false;}};dialog.showModal();$('#round-title').focus();
}
function applyWidth(){drawer.style.setProperty('--drawer-width',preferredWidth+'px');}
async function persistWidth(){try{await api('preferences',{drawer_width:Math.round(preferredWidth)});}catch(e){toast('宽度暂未保存：'+(e as Error).message);}}
const resizeHandle=$('#drawer-resize');let resizeStart:{x:number;width:number}|null=null,widthTimer:ReturnType<typeof setTimeout>|undefined;
resizeHandle.addEventListener('pointerdown',e=>{if(window.innerWidth<=700||drawer.classList.contains('expanded'))return;resizeStart={x:e.clientX,width:drawer.getBoundingClientRect().width};resizeHandle.setPointerCapture(e.pointerId);drawer.classList.add('resizing');e.preventDefault();});
resizeHandle.addEventListener('pointermove',e=>{if(!resizeStart)return;preferredWidth=Math.max(480,Math.min(1920,window.innerWidth-68,resizeStart.width+resizeStart.x-e.clientX));applyWidth();});
function finishResize(){if(!resizeStart)return;resizeStart=null;drawer.classList.remove('resizing');void persistWidth();}
resizeHandle.addEventListener('pointerup',finishResize);resizeHandle.addEventListener('pointercancel',finishResize);
resizeHandle.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key)||window.innerWidth<=700)return;e.preventDefault();preferredWidth=Math.max(480,Math.min(1920,window.innerWidth-68,drawer.getBoundingClientRect().width+(e.key==='ArrowLeft'?24:-24)));applyWidth();clearTimeout(widthTimer);widthTimer=setTimeout(()=>void persistWidth(),250);});

try{session=await api<Session>('session');initFilter('source-filter',[{value:'',label:'全部来源'},...Object.entries(session.platforms).map(([value,label])=>({value,label}))]);initFilter('rating-filter',[['','全部星级'],['5','五星'],['4','四星及以上'],['3','三星及以上'],['2','二星及以上'],['1','已评分']].map(([value,label])=>({value:value!,label:label!})));try{const prefs=await api('preferences');if(Number.isFinite(prefs.board?.drawer_width))preferredWidth=prefs.board.drawer_width;}catch(e){toast('读取界面设置失败：'+(e as Error).message);}applyWidth();await refresh(true);const requested=new URLSearchParams(location.search).get('opportunity');if(requested)await openJob(requested);}catch(e){notice(e);kanban.innerHTML='<p class="loading">看板暂时无法读取，请刷新重试。</p>';}
setInterval(()=>{if(!document.hidden&&!$<HTMLDialogElement>('#action-dialog').open&&!$<HTMLDialogElement>('#interview-dialog').open&&!$<HTMLDialogElement>('#resume-choice').open&&!$<HTMLDialogElement>('#submission-dialog').open)void refresh();},15000);
window.addEventListener('focus',()=>{if(session&&!$<HTMLDialogElement>('#action-dialog').open&&!$<HTMLDialogElement>('#interview-dialog').open&&!$<HTMLDialogElement>('#resume-choice').open&&!$<HTMLDialogElement>('#submission-dialog').open)void refresh();});
export {};

async function resumeApi(route:string,data?:unknown){const r=await fetch('/api/library/'+route,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json','X-Career-Token':session.token}:{},body:data?JSON.stringify(data):undefined});const value=await r.json();if(!r.ok)throw new Error(value.error??'简历操作失败');return value;}
let resumeViewVersion='';
async function renderResumes(quiet=false){if(!detail)return;const op=detail.id,request=++loadId;setDocumentTools();if(!quiet){resumeViewVersion='';view.innerHTML='<p class="loading">正在读取简历…</p>';}try{
 const list=await resumeApi('list');if(tab!=='resume'||detail?.id!==op||request!==loadId)return;
 const version=JSON.stringify([op,list.entries,detail.card.sha256]);if(quiet&&resumeViewVersion===version)return;resumeViewVersion=version;
 const previousScroll=quiet?view.querySelector('.job-resume-panel')?.scrollTop??0:0;
 const chosen=list.entries.find((r:any)=>r.id===detail!.card.meta.resume?.id),history=detail.card.meta.submissions??[];
 view.innerHTML=`<div class="job-resume-panel"><div class="job-resume-heading"><h3>本岗位使用的简历</h3><button id="choose-resume" class="button">${chosen?'更换简历':'选择简历'}</button></div>${chosen?`<article class="chosen-resume"><span class="resume-symbol">▤</span><div><h3>${esc(chosen.title)}</h3><p>${esc(chosen.name)} · ${esc(chosen.headline)}</p><p class="edit-hint">关联 ${chosen.jobs.length} 个岗位 · 更新于 ${esc(chosen.updated_at.slice(0,10))}</p></div></article><div class="resume-actions"><a class="button" href="${chosen.href}">查看简历</a>${chosen.editable?`<a class="button" href="/resumes/${chosen.id}/edit">编辑内容</a>`:''}<button id="tailor-copy" class="button">另存岗位专用版</button><button id="unlink-resume" class="text-button">取消关联</button></div><button id="record-submission" class="button primary">记录实际投递</button>`:`<div class="resume-unlinked"><h3>为这个机会选一份简历</h3><p>可以关联现有简历，也可以请 Agent 基于岗位要求整理专用版本。</p><a class="button" href="/">前往简历库</a></div>`}<section class="submission-history"><h3>投递记录</h3>${history.length?history.slice().reverse().map((s:any)=>`<div class="submission-row"><div><strong>${esc(s.resume_title)}</strong><p>${esc(s.submitted_at.replace('T',' ').slice(0,16))} · ${esc(s.channel)}</p></div><a class="text-button" href="/api/library/submission?opportunity=${op}&id=${s.id}" download>下载当时快照</a></div>`).join(''):'<p class="edit-hint">还没有投递记录</p>'}</section></div>`;
 view.querySelector('.job-resume-panel')!.scrollTop=previousScroll;
 $('#choose-resume').onclick=()=>chooseResume(list.entries,chosen?.id,op);
 $('#unlink-resume')?.addEventListener('click',async()=>{try{await resumeApi('assign',{opportunity_id:op,resume_id:null,sha256:detail!.card.sha256});await refresh(true);toast('已取消关联，历史记录仍保留');}catch(e){toast((e as Error).message);}});
 $('#tailor-copy')?.addEventListener('click',()=>action('另存岗位专用版','新简历独立保存，其他岗位继续使用原简历。',`${detail!.card.meta.company} · ${chosen.title}`,'创建并关联',async title=>{const r=await resumeApi('create',{title,from:chosen.id});try{await resumeApi('assign',{opportunity_id:op,resume_id:r.id,sha256:detail!.card.sha256});}catch(e){throw new Error('新简历已创建，关联失败；可在简历库找到它。'+(e as Error).message);}location.href=`/resumes/${r.id}/edit`;}));
 $('#record-submission')?.addEventListener('click',()=>void openSubmission(chosen,op));
 }catch(e){if(tab==='resume'&&detail?.id===op&&request===loadId&&!quiet)view.innerHTML=`<div class="empty-document"><h3>暂时无法读取简历</h3><p>${esc((e as Error).message)}</p></div>`;}}
let outreachViewVersion='';
async function renderOutreach(quiet=false){
 if(!detail)return;const op=detail.id,request=++loadId;setDocumentTools();
 if(!quiet){outreachViewVersion='';view.innerHTML='<p class="loading">正在读取打招呼稿…</p>';}
 try{
  const draft=await api<Outreach>('outreach?id='+op);if(request!==loadId||tab!=='outreach'||detail?.id!==op||!drawer.open)return;
  const version=JSON.stringify([op,draft,detail.card.meta.resume]);if(quiet&&version===outreachViewVersion)return;outreachViewVersion=version;
  const scroll=quiet?view.querySelector('.outreach-page')?.scrollTop??0:0;
  view.innerHTML=`<div class="outreach-page">${outreachMarkup(draft)}<p class="edit-hint outreach-resume-hint">${detail.card.meta.resume?'根据本岗位关联的简历准备。':'还未关联简历，可以先选择投递版本。'}<button id="outreach-resume" class="text-button">查看关联简历 →</button></p></div>`;
  bindOutreach(draft,op);$('#outreach-resume').onclick=()=>void selectTab('resume');view.querySelector('.outreach-page')!.scrollTop=scroll;
 }catch(e){if(request!==loadId||tab!=='outreach'||detail?.id!==op)return;outreachViewVersion='';view.innerHTML=`<div class="empty-document"><h3>暂时无法读取打招呼稿</h3><p>${esc((e as Error).message)}</p><button id="retry-outreach" class="button">重新读取</button></div>`;$('#retry-outreach').onclick=()=>void renderOutreach();}
}
function outreachMarkup(draft:Outreach){
 const warning=draft.warnings.join('；');
 return `<section class="outreach-panel" aria-labelledby="outreach-title"><header class="job-resume-heading"><h3 id="outreach-title">给招聘方打招呼</h3><button id="outreach-generate" class="button">${draft.exists?'让 Agent 更新':'让 Agent 生成'}</button></header><p class="edit-hint">结合这个岗位和投递简历，准备给招聘方的开场消息。</p>${warning?`<p class="outreach-warning" role="status">${esc(warning)}</p>`:''}${draft.meta?`<p class="outreach-meta">${esc(draft.meta.channel)} · ${esc(draft.meta.generated_at.slice(0,10))} · 草稿${draft.state==='current'?' · 输入版本一致':''}</p>`:''}${draft.variants.map((v,i)=>`<article class="outreach-variant"><div class="outreach-variant-heading"><h4>${esc(v.label)}</h4><button class="text-button" data-copy-outreach="${i}" aria-label="复制${esc(v.label)}">${icon('copy')}复制正文</button></div><p class="outreach-message">${esc(v.text)}</p></article>`).join('')}${!draft.exists&&!warning?'<p class="outreach-empty">还没有打招呼稿。复制指令给工作区 Agent，完成后会显示在这里。</p>':''}${draft.exists?'<button id="outreach-document" class="text-button">查看完整稿件与依据 →</button>':''}</section>`;
}
function bindOutreach(draft:Outreach,op:string){
 $('#outreach-generate').onclick=async()=>{try{
  const context=await api('context?id='+op);if(tab!=='outreach'||detail?.id!==op||!drawer.open)return;
  const instruction=context.prompt+'\n本次只准备给招聘方的首次打招呼草稿，请使用「招聘开场白」技能（career-outreach）。读取当前 JD 和准备投递的简历；没有关联且我未指定版本时，先推荐并让我选择，不擅自绑定。已有沟通时先核对上下文。按 Skill 的 storage 格式将推荐稿、简短版、选材依据和真实输入摘要保存到 analysis/outreach.md；修改前读取旧稿和摘要，保留我的手改。若需修改简历先征求我同意。仅准备草稿，不发送消息，不改变投递阶段。';
  action(draft.exists?'更新打招呼稿':'生成打招呼稿','复制给工作区 Agent。保存后返回这里即可查看和复制正文。',instruction,'复制指令',async text=>{await writeClipboard(text);toast('已复制，发送给工作区 Agent 即可');},true);
 }catch(e){toast((e as Error).message);}};
 $('#outreach-document')?.addEventListener('click',()=>{fileSelection=draft.path;void selectTab('files');});
 view.querySelectorAll<HTMLButtonElement>('[data-copy-outreach]').forEach(button=>button.onclick=async()=>{
  const variant=draft.variants[Number(button.dataset.copyOutreach)];if(!variant)return;
  try{await writeClipboard(variant.text);toast('正文已复制');}catch{action('复制打招呼正文','请选择并复制下面的消息。',variant.text,'关闭',async()=>{},true);}
 });
}
function chooseResume(entries:any[],current:string|undefined,op:string){const dialog=$<HTMLDialogElement>('#resume-choice');let selected=current;const sha=detail!.card.sha256;$('#resume-choice-error').textContent='';$<HTMLInputElement>('#resume-choice-search').value='';
 function render(){const q=$<HTMLInputElement>('#resume-choice-search').value.toLowerCase();$('#resume-choice-list').innerHTML=entries.filter(r=>r.title.toLowerCase().includes(q)).map(r=>`<button class="resume-choice-row ${selected===r.id?'selected':''}" data-resume="${r.id}" aria-pressed="${selected===r.id}"><span>▤</span><div><strong>${esc(r.title)}</strong><small>${esc(r.headline)} · ${r.jobs.length} 个关联岗位</small></div>${selected===r.id?'✓':''}</button>`).join('')||'<p>没有可用简历。先去简历库生成一份。</p>';$('#resume-choice-list').querySelectorAll<HTMLElement>('[data-resume]').forEach(b=>b.onclick=()=>{selected=b.dataset.resume;render();});}
 $('#resume-choice-search').oninput=render;$('#resume-choice-cancel').onclick=()=>dialog.close();$('#resume-choice-apply').onclick=async()=>{if(!selected){$('#resume-choice-error').textContent='请选择一份简历';return;}try{await resumeApi('assign',{opportunity_id:op,resume_id:selected,sha256:sha});dialog.close();await refresh(true);toast('已关联简历');}catch(e){$('#resume-choice-error').textContent=(e as Error).message;}};render();dialog.showModal();}
async function openSubmission(chosen:any,op:string){try{const r=await resumeApi('read?id='+chosen.id),s=await resumeApi('session');const at=new Date(),local=new Date(at.getTime()-at.getTimezoneOffset()*60000).toISOString().slice(0,16);$<HTMLInputElement>('#submission-date').value=local;$<HTMLInputElement>('#submission-channel').value=session.platforms[detail!.card.meta.sources[0]?.platform??'']??'';$<HTMLInputElement>('#submission-confirm').checked=false;$('#submission-error').textContent='';$('#submission-theme').innerHTML=s.themes.map((t:any)=>`<option value="${t.id}" ${s.defaultTheme===t.id?'selected':''}>${esc(t.name)}</option>`).join('');const sha=detail!.card.sha256,dialog=$<HTMLDialogElement>('#submission-dialog');$('#submission-cancel').onclick=()=>dialog.close();$('#submission-form').onsubmit=async e=>{e.preventDefault();const button=$<HTMLButtonElement>('#submission-form button[type="submit"]');button.disabled=true;try{await resumeApi('submit',{opportunity_id:op,sha256:sha,resume_id:r.id,resume_sha256:r.sha256,submitted_at:new Date($<HTMLInputElement>('#submission-date').value).toISOString(),channel:$<HTMLInputElement>('#submission-channel').value,theme:$<HTMLSelectElement>('#submission-theme').value,confirmed:$<HTMLInputElement>('#submission-confirm').checked});dialog.close();await refresh(true);toast('投递记录与快照已保存');}catch(e){$('#submission-error').textContent=(e as Error).message;}finally{button.disabled=false;}};dialog.showModal();}catch(e){toast((e as Error).message);}}
