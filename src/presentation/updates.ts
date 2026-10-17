// Shared by every workbench view and the desktop welcome screen. No workspace data.
export {};
type UpdateRelease={version:string;tag:string;name:string;notes:string;size:number};
type UpdateState={currentVersion:string;platform:string;arch:string;automatic:boolean;preview:boolean;checking:boolean;lastChecked:number|null;latest:UpdateRelease|null;error:string};
type UpdatesBridge={updatesState:()=>Promise<UpdateState>;updatesCheck:()=>Promise<UpdateState>;updatesPreferences:(value:Partial<Pick<UpdateState,'automatic'|'preview'>>)=>Promise<UpdateState>;updatesClaimNotice:(tag:string)=>Promise<boolean>;updatesOpenDownload:(tag:string)=>Promise<boolean>;onUpdates:(fn:(state:UpdateState)=>void)=>()=>void};
declare global {interface Window {careerUpdatesUI?:{mount:(element:HTMLElement)=>void;connect:(trigger:HTMLElement,onOpen:()=>void)=>void;openStandalone:()=>void};}}
(()=>{
 const api=(window as unknown as {careerDesktop?:UpdatesBridge}).careerDesktop;
 if(!api?.updatesState)return;
 let current:UpdateState|undefined,host:HTMLElement|undefined,trigger:HTMLElement|undefined,open=()=>{},busy=false,feedback='',uiError='',noticePending=false,revision=0;
 const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const readable=(s:UpdateState)=>(s.platform==='darwin'?'macOS':s.platform==='win32'?'Windows':s.platform)+' · '+(s.platform==='darwin'?(s.arch==='arm64'?'Apple Silicon':'Intel'):s.arch.toUpperCase());
 function render(){
  if(!host?.isConnected)return;
  // Preserve keyboard focus across streamed status and preference changes.
  const focus=host.contains(document.activeElement)?(document.activeElement as HTMLElement).dataset.updateAction:undefined;
  if(!current){host.innerHTML=`<p role="status">${escape(uiError||'正在读取版本信息…')}</p>`;return;}
  const s=current,r=s.latest,disabled=busy||s.checking?'disabled':'';
  host.classList.add('career-updates');
  host.innerHTML=`<div class="updates-heading"><div><h3>关于与更新</h3><p>career · 个人求职工作台</p></div><span class="updates-version">v${escape(s.currentVersion)}</span></div>
   <p class="updates-platform">${escape(readable(s))}</p>
   <section class="updates-status" aria-label="版本状态"><div class="updates-status-line"><strong>${s.checking?'正在检查更新…':r?'发现新版本 v'+escape(r.version):s.error?'暂时无法检查更新':s.lastChecked?'当前渠道暂无可用更新':'检查是否有新版本'}</strong><button type="button" data-update-action="check" ${disabled}>${s.checking?'检查中…':'检查更新'}</button></div>
   <p class="updates-muted">${s.lastChecked?'上次成功检查：'+escape(new Date(s.lastChecked).toLocaleString('zh-CN',{hour12:false})):'从 GitHub 公开发布中检查适合这台电脑的安装包。'}</p>
   ${s.error?`<p class="updates-error" role="alert">${escape(s.error)}${r?' 下方保留上次查到的版本。':''}</p>`:''}
   ${r?`<div class="updates-release"><h4>本次更新</h4><pre class="updates-notes">${escape(r.notes||'此版本未提供更新说明。')}</pre><div class="updates-download"><button type="button" class="updates-primary" data-update-action="download" ${disabled}>下载安装包 ↗</button><span>${escape(readable(s))} · ${Math.ceil(r.size/1024/1024)} MB</span></div><p class="updates-muted">在浏览器下载后，退出 career 并打开安装包覆盖升级。你的工作区资料会保留。</p></div>`:''}</section>
   <div class="updates-options"><label><span><strong>自动检查更新</strong><small>启动后及使用期间定期检查，新版本轻提示只出现一次。</small></span><input type="checkbox" data-update-action="automatic" aria-label="自动检查更新" ${s.automatic?'checked':''} ${busy?'disabled':''}></label><label><span><strong>接收预览版</strong><small>包含 alpha、beta 等预览版本，可能仍有功能调整。</small></span><input type="checkbox" data-update-action="preview" aria-label="接收预览版" ${s.preview?'checked':''} ${busy?'disabled':''}></label></div>
   <p class="updates-feedback" role="status">${escape(feedback)}</p><p class="updates-error" role="alert">${escape(uiError)}</p>`;
  host.querySelector<HTMLButtonElement>('[data-update-action="check"]')!.onclick=()=>void action(async()=>{current=await api!.updatesCheck();});
  host.querySelector<HTMLButtonElement>('[data-update-action="download"]')?.addEventListener('click',()=>void action(async()=>{await api!.updatesOpenDownload(r!.tag);feedback='已在浏览器打开下载。下载完成后打开安装包即可升级。';}));
  for(const key of ['automatic','preview'] as const)host.querySelector<HTMLInputElement>(`[data-update-action="${key}"]`)!.onchange=e=>void action(async()=>{
   const enabled=(e.target as HTMLInputElement).checked;current=await api!.updatesPreferences({[key]:enabled});
   if(key==='preview'||enabled)current=await api!.updatesCheck();
  });
  if(focus)host.querySelector<HTMLElement>(`[data-update-action="${focus}"]`)?.focus({preventScroll:true});
 }
 async function action(fn:()=>Promise<void>){if(busy)return;const focus=host?.contains(document.activeElement)?(document.activeElement as HTMLElement).dataset.updateAction:undefined;busy=true;feedback='';uiError='';render();try{await fn();}catch(e){uiError=(e as Error).message;}finally{busy=false;render();badge();if(focus)host?.querySelector<HTMLElement>(`[data-update-action="${focus}"]`)?.focus({preventScroll:true});}}
 function badge(){
  if(!trigger)return;const available=!!current?.latest;
  trigger.classList.toggle('has-update',available);
  trigger.dataset.updateAvailable=String(available);
  const label=trigger.id==='open-settings'?'设置':'关于与更新';
  trigger.setAttribute('aria-label',label+(available?'，有新版本可用':''));trigger.title=label+(available?' · 有新版本':'');
 }
 function maybeNotice(){
  if(noticePending||!current?.latest||!current.automatic)return;
  noticePending=true;const tag=current.latest.tag;
  const show=async()=>{
   if(current?.latest?.tag!==tag||!current.automatic){noticePending=false;return;}
   // A passive toast must not cover a dialog, typing, or an unsaved editing session.
   const guard=new CustomEvent('career:before-workspace-switch',{cancelable:true,detail:{reason:''}});document.dispatchEvent(guard);
   if(document.hidden||document.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea,[contenteditable="true"]')||guard.defaultPrevented){setTimeout(()=>void show(),10000);return;}
   try{if(!await api!.updatesClaimNotice(tag)){noticePending=false;return;}
    if(current?.latest?.tag!==tag){noticePending=false;return;}
    document.querySelector('.update-notice')?.remove();
    const notice=document.createElement('aside');notice.className='update-notice';notice.dataset.tag=tag;notice.setAttribute('aria-label','软件更新');
    notice.innerHTML=`<div role="status"><strong>career 有新版本了</strong><p>v${escape(current.latest.version)} 已发布，可查看更新内容。</p></div><div><button type="button" data-notice="view">查看更新</button><button type="button" data-notice="later">稍后</button></div>`;
    notice.querySelector<HTMLButtonElement>('[data-notice="view"]')!.onclick=()=>{notice.remove();open();};
    notice.querySelector<HTMLButtonElement>('[data-notice="later"]')!.onclick=()=>notice.remove();
    document.body.append(notice);
   }catch{/* Preference write failures must not produce repeated notifications. */}
   finally{noticePending=false;}
  };setTimeout(()=>void show(),1200);
 }
 function receive(s:UpdateState){
  revision++;current=s;badge();render();
  const notice=document.querySelector<HTMLElement>('.update-notice');
  if(!s.automatic||notice?.dataset.tag!==s.latest?.tag)notice?.remove();
  if(!s.checking){
   if(s.latest&&host?.isConnected&&host.closest('dialog')?.open)void api!.updatesClaimNotice(s.latest.tag).catch(()=>{});
   else maybeNotice();
  }
 }
 async function read(){const before=revision;try{const s=await api!.updatesState();if(before===revision)receive(s);}catch(e){if(before===revision){uiError=(e as Error).message;render();}}}
 window.careerUpdatesUI={
  mount(element){host=element;feedback='';uiError='';render();void read();},
  connect(element,onOpen){trigger=element;open=onOpen;badge();void read();},
  openStandalone(){
   let dialog=document.querySelector<HTMLDialogElement>('#desktop-updates');
   if(!dialog){dialog=document.createElement('dialog');dialog.id='desktop-updates';dialog.className='updates-dialog';dialog.setAttribute('aria-label','关于与更新');dialog.innerHTML='<button type="button" class="updates-close" aria-label="关闭关于与更新">×</button><div class="updates-dialog-content"></div>';document.body.append(dialog);const d=dialog;d.querySelector<HTMLButtonElement>('button')!.onclick=()=>d.close();}
   if(!dialog.open)dialog.showModal();window.careerUpdatesUI!.mount(dialog.querySelector<HTMLElement>('.updates-dialog-content')!);
  }
 };
 const unsubscribe=api.onUpdates(receive);window.addEventListener('pagehide',()=>unsubscribe(),{once:true});
})();
