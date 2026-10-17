if(location.protocol==='file:')document.querySelectorAll<HTMLElement>('[data-local-nav]').forEach(e=>e.hidden=true);
const sidebarButton=document.querySelector<HTMLButtonElement>('#toggle-sidebar')!;
const narrow=window.matchMedia('(max-width: 900px)');
const defaultCollapsed=!('careerDesktop' in window)&&document.body.classList.contains('board-page');
let sidebarChoice:boolean|null=null;
try {const saved=localStorage.getItem('career.sidebar.collapsed');if(saved==='true'||saved==='false')sidebarChoice=saved==='true';}catch{}
function setSidebar(collapsed:boolean) {
  document.body.classList.toggle('sidebar-collapsed',collapsed);
  sidebarButton.setAttribute('aria-expanded',String(!collapsed));
  const label=collapsed?'展开侧边栏':'收起侧边栏';
  sidebarButton.setAttribute('aria-label',label);
  document.querySelector<HTMLElement>('#sidebar-backdrop')!.hidden=collapsed||!narrow.matches;
}
function collapseSidebar() {sidebarChoice=true;setSidebar(true);try{localStorage.setItem('career.sidebar.collapsed','true');}catch{}}
sidebarButton.addEventListener('click',()=>{
  sidebarChoice=!document.body.classList.contains('sidebar-collapsed');setSidebar(sidebarChoice);
  try{localStorage.setItem('career.sidebar.collapsed',String(sidebarChoice));}catch{}
});
document.querySelector('#sidebar-backdrop')!.addEventListener('click',collapseSidebar);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&narrow.matches&&!document.querySelector('dialog[open]'))collapseSidebar();});
narrow.addEventListener('change',()=>setSidebar(narrow.matches||(sidebarChoice??defaultCollapsed)));
setSidebar(narrow.matches||(sidebarChoice??defaultCollapsed));
document.querySelector('#copy-start')?.addEventListener('click',async()=>{
  const text=document.querySelector<HTMLElement>('#start-instruction')!;
  let message='已复制，发给 Agent 即可开始';
  try{await navigator.clipboard.writeText(text.textContent!);}catch{
    text.hidden=false;text.focus();const range=document.createRange();range.selectNodeContents(text);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);message='已选中指令，请按 Ctrl / ⌘ + C 复制';
  }
  const box=document.querySelector<HTMLElement>('#toast')!;box.textContent=message;box.classList.add('visible');setTimeout(()=>box.classList.remove('visible'),3200);
});
export {};

// Settings remains in the current page, so opening it never discards an editor draft.
const settingsButton=document.querySelector<HTMLButtonElement>('#open-settings');
const desktop=(window as unknown as {careerDesktop?:{companyStatus:()=>Promise<any>;companySave:(key:string)=>Promise<any>;companyCheck:()=>Promise<any>;companyRemove:()=>Promise<any>;chooseDirectory:(path:string)=>Promise<string|null>;createWorkspace:(data:{name:string;parent:string;repository?:string})=>Promise<any>;handoff:()=>Promise<any>;copyPrompt:(path:string)=>Promise<void>;reveal:(path:string)=>Promise<void>}}).careerDesktop;
const settingsEscape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let settingsToken='',settingsData:any,settingsBusy=false,settingsRequest=0;
let creation={name:'我的求职',parent:'',repository:'',restore:false};
const settingsDialog=document.createElement('dialog');settingsDialog.className='settings-modal';settingsDialog.id='workspace-settings';settingsDialog.setAttribute('aria-labelledby','settings-title');
if(settingsButton)document.body.append(settingsDialog);
async function settingsApi(route:string,data?:unknown){const response=await fetch('/api/workspaces/'+route,{cache:'no-store',...(data!==undefined?{method:'POST',headers:{'Content-Type':'application/json','X-Career-Token':settingsToken},body:JSON.stringify(data)}:{})});const value=await response.json();if(!response.ok)throw new Error(value.error??'操作失败');return value;}
const settingsFind=<T extends HTMLElement=HTMLElement>(id:string)=>settingsDialog.querySelector<T>('#'+id)!;
function settingsError(message:string){const error=settingsFind('settings-error');error.textContent=message;error.hidden=!message;}
function settingsLayout(content:string,section='workspace'){
 window.careerSelectUI?.close();settingsDialog.dataset.settingsSection=section;
 settingsDialog.innerHTML=`<header class="settings-header"><h2 id="settings-title">设置</h2><button id="settings-close" class="settings-close" aria-label="关闭设置">×</button></header><div class="settings-layout"><nav class="settings-nav" aria-label="设置分类"><button data-section="workspace" aria-current="${section==='workspace'?'page':'false'}">工作区</button><button data-section="sync" aria-current="${section==='sync'?'page':'false'}">云同步</button><button data-section="appearance" aria-current="${section==='appearance'?'page':'false'}">外观</button><button data-section="models" aria-current="${section==='models'?'page':'false'}">模型与服务</button><button data-section="integrations" aria-current="${section==='integrations'?'page':'false'}">外部服务</button>${window.careerUpdatesUI?`<button data-section="updates" aria-current="${section==='updates'?'page':'false'}">关于与更新</button>`:''}</nav><div class="settings-body"><p id="settings-error" class="settings-error" role="alert" hidden></p>${content}</div></div>`;
 settingsFind('settings-close').onclick=()=>{if(!settingsBusy)settingsDialog.close();};
 settingsDialog.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(b=>{b.disabled=!settingsData;b.onclick=()=>{if(!settingsBusy){settingsRequest++;b.dataset.section==='models'?renderModelSettings():b.dataset.section==='updates'?renderUpdateSettings():b.dataset.section==='workspace'?renderWorkspaceSettings():b.dataset.section==='integrations'?void renderIntegrations():b.dataset.section==='sync'?void renderSync():renderAppearance();}};});
}
function settingsGuard(){const detail={reason:''};const event=new CustomEvent('career:before-workspace-switch',{cancelable:true,detail});document.dispatchEvent(event);if(event.defaultPrevented){settingsError(detail.reason||'请先保存当前页面的修改，再切换工作区。');return false;}return true;}
async function settingsAction(action:()=>Promise<void>){if(settingsBusy)return;settingsBusy=true;settingsError('');settingsDialog.setAttribute('aria-busy','true');const enabled=[...settingsDialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];enabled.forEach(b=>b.disabled=true);try{await action();}catch(e){settingsError((e as Error).message);}finally{settingsBusy=false;settingsDialog.removeAttribute('aria-busy');enabled.forEach(b=>b.disabled=false);}}
function navigateWorkspace(url:string){location.assign(url);}
function renderWorkspaceSettings(){
 if(!settingsData){settingsLayout('<p class="settings-muted">正在读取工作区…</p>');return;}
 const current=settingsData.current,recent=settingsData.recent.filter((e:any)=>e.id!==current.id);
 settingsLayout(`<div class="settings-section-heading"><h3>工作区</h3></div><section class="current-workspace"><div class="workspace-name-line"><strong>${settingsEscape(current.name)}</strong><span class="current-label">当前使用</span><button id="rename-workspace" class="text-button">改名</button></div><p class="workspace-path">${settingsEscape(current.path)}</p><div class="workspace-path-actions"><button id="reveal-workspace" class="text-button">打开文件夹 ↗</button><button id="copy-workspace" class="text-button">复制路径</button></div></section><div class="workspace-create-actions"><button id="create-workspace" class="button primary">＋ 创建工作区</button><button id="open-workspace" class="button">打开已有工作区</button><button id="restore-workspace" class="button">从仓库恢复</button></div><h4 class="recent-heading">最近使用</h4><div class="recent-workspaces">${recent.length?recent.map((e:any)=>`<button class="workspace-row" data-workspace="${settingsEscape(e.id)}"><span><strong>${settingsEscape(e.name)}</strong><small>${settingsEscape(e.path)}</small></span><span class="workspace-row-action">${e.available?'切换 →':'重新定位'}</span></button>`).join(''):'<p class="settings-muted">打开或创建的工作区会显示在这里。</p>'}</div>`);
 settingsFind('create-workspace').onclick=()=>{creation={name:'我的求职',parent:settingsData.default_location,repository:'',restore:false};renderCreateWorkspace();};
 settingsFind('restore-workspace').onclick=()=>{creation={name:'我的求职',parent:settingsData.default_location,repository:'',restore:true};renderCreateWorkspace();};
 settingsFind('open-workspace').onclick=()=>void renderFolderPicker(settingsData.default_location,'open');
 settingsFind('rename-workspace').onclick=renderRenameWorkspace;
 settingsFind('reveal-workspace').onclick=()=>void settingsAction(async()=>{await settingsApi('reveal',{});});
 settingsFind('copy-workspace').onclick=async()=>{try{await navigator.clipboard.writeText(current.path);settingsFind('copy-workspace').textContent='已复制';}catch{settingsError('请选中上面的路径，按 Ctrl / ⌘ + C 复制。');}};
 if(desktop){const connect=document.createElement('button');connect.className='text-button';connect.textContent='连接 Agent';connect.onclick=()=>void settingsAction(async()=>renderAgentHandoff(await desktop.handoff()));settingsDialog.querySelector('.workspace-path-actions')!.append(connect);}
 settingsDialog.querySelectorAll<HTMLButtonElement>('[data-workspace]').forEach(button=>button.onclick=()=>{const entry=recent.find((e:any)=>e.id===button.dataset.workspace);if(!entry.available){void renderFolderPicker(settingsData.default_location,'open',entry.id);return;}if(settingsGuard())void settingsAction(async()=>navigateWorkspace((await settingsApi('open',{path:entry.path})).url));});
}
function renderCreateWorkspace(){
 settingsLayout(`<button class="settings-back" id="settings-back">← 工作区</button><h3>${creation.restore?'从仓库恢复':'创建工作区'}</h3>${creation.restore?'<p class="settings-muted">填写自己的 GitHub 私人仓库。空仓库会创建新工作区；已有资料会恢复到新文件夹。</p><div id="restore-environment"></div>':''}<form id="create-workspace-form">${creation.restore?`<label class="settings-field">仓库地址<input id="restore-repository" required placeholder="https://github.com/你/私人仓库" value="${settingsEscape(creation.repository)}"></label>`:''}<label class="settings-field">名称<input id="workspace-name" maxlength="60" required value="${settingsEscape(creation.name)}" autocomplete="off"></label><label class="settings-field">保存位置<div class="workspace-location"><input id="workspace-parent" value="${settingsEscape(creation.parent)}" readonly><button id="choose-parent" class="button" type="button">选择</button></div></label><p class="settings-muted">将在所选位置创建一个独立文件夹。</p><p id="workspace-new-path" class="workspace-path"></p><div class="settings-form-actions"><button id="create-cancel" class="button" type="button">取消</button><button class="button primary" type="submit">创建并打开</button></div></form>`);
 const name=settingsFind<HTMLInputElement>('workspace-name');const update=()=>{creation.name=name.value;settingsFind('workspace-new-path').textContent=creation.parent.replace(/[\\/]$/,'')+(creation.parent.includes('\\')?'\\':'/')+creation.name;};name.oninput=update;update();
 settingsFind('settings-back').onclick=renderWorkspaceSettings;settingsFind('create-cancel').onclick=renderWorkspaceSettings;
 settingsFind('choose-parent').onclick=()=>void renderFolderPicker(creation.parent,'parent');
 settingsFind<HTMLFormElement>('create-workspace-form').onsubmit=e=>{e.preventDefault();if(settingsGuard())void settingsAction(async()=>{const data={name:name.value,parent:creation.parent,...(creation.restore?{repository:creation.repository}:{})};if(desktop)renderAgentHandoff(await desktop.createWorkspace(data));else navigateWorkspace((await settingsApi('create',data)).url);});};
 if(creation.restore){settingsFind<HTMLInputElement>('restore-repository').oninput=e=>{creation.repository=(e.target as HTMLInputElement).value;};void renderSyncEnvironment('restore-environment');}
 name.focus();name.select();
}
function renderRenameWorkspace(){
 settingsLayout(`<button class="settings-back" id="settings-back">← 工作区</button><h3>修改名称</h3><form id="rename-workspace-form"><label class="settings-field">工作区名称<input id="workspace-name" maxlength="60" required value="${settingsEscape(settingsData.current.name)}"></label><p class="settings-muted">资料文件夹的位置保持不变。</p><div class="settings-form-actions"><button class="button primary" type="submit">保存名称</button></div></form>`);
 settingsFind('settings-back').onclick=renderWorkspaceSettings;
 settingsFind<HTMLFormElement>('rename-workspace-form').onsubmit=e=>{e.preventDefault();void settingsAction(async()=>{settingsData=await settingsApi('rename',{name:settingsFind<HTMLInputElement>('workspace-name').value,previous:settingsData.current.name});renderWorkspaceSettings();});};settingsFind('workspace-name').focus();
}
async function renderFolderPicker(directory:string,purpose:'parent'|'open',replaceId?:string){
 if(desktop){await settingsAction(async()=>{const selected=await desktop.chooseDirectory(directory);if(!selected)return;if(purpose==='parent'){creation.parent=selected;renderCreateWorkspace();}else if(settingsGuard())navigateWorkspace((await settingsApi('open',{path:selected,replaceId})).url);});return;}
 const request=++settingsRequest;
 settingsLayout(`<button class="settings-back" id="settings-back">← ${purpose==='parent'?'创建工作区':'工作区'}</button><h3>${purpose==='parent'?'选择保存位置':'打开工作区'}</h3><form id="folder-path-form" class="folder-path-form"><input id="folder-path" aria-label="文件夹路径" value="${settingsEscape(directory)}" placeholder="输入完整路径"><button class="button" type="submit">前往</button></form><div class="folder-list" id="folder-list"><p class="settings-muted">正在读取文件夹…</p></div><div class="settings-form-actions"><button id="folder-parent" class="button">上一级</button><button id="folder-select" class="button primary" disabled>${purpose==='parent'?'选择此位置':'打开此工作区'}</button></div>`);
 settingsFind('settings-back').onclick=()=>{settingsRequest++;purpose==='parent'?renderCreateWorkspace():renderWorkspaceSettings();};
 settingsFind<HTMLFormElement>('folder-path-form').onsubmit=e=>{e.preventDefault();void renderFolderPicker(settingsFind<HTMLInputElement>('folder-path').value,purpose,replaceId);};
 settingsFind('folder-parent').onclick=()=>{};
 try{const value=await settingsApi('browse',{path:directory});if(request!==settingsRequest||!settingsDialog.open)return;
  const pathInput=settingsFind<HTMLInputElement>('folder-path');if(pathInput.value===directory)pathInput.value=value.path;
  settingsFind('folder-list').innerHTML=value.directories.map((d:any)=>`<button class="folder-row" data-directory="${settingsEscape(d.path)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 7h7l2 2h9v11H3zM3 7V4h7l2 3h9v2"/></svg><span>${settingsEscape(d.name)}</span><span>›</span></button>`).join('')||'<p class="settings-muted">此文件夹下没有可浏览的子文件夹。</p>';
  settingsDialog.querySelectorAll<HTMLButtonElement>('[data-directory]').forEach(b=>b.onclick=()=>void renderFolderPicker(b.dataset.directory!,purpose,replaceId));
  settingsFind<HTMLButtonElement>('folder-parent').disabled=value.parent===value.path;settingsFind('folder-parent').onclick=()=>void renderFolderPicker(value.parent,purpose,replaceId);
  settingsFind<HTMLButtonElement>('folder-select').disabled=false;settingsFind('folder-select').onclick=()=>{if(purpose==='parent'){creation.parent=value.path;renderCreateWorkspace();}else if(settingsGuard())void settingsAction(async()=>navigateWorkspace((await settingsApi('open',{path:value.path,replaceId})).url));};
 }catch(e){if(request===settingsRequest){settingsFind('folder-list').textContent='';settingsError((e as Error).message);}}
}
async function renderIntegrations(){
 const request=++settingsRequest;
 if(!desktop){settingsLayout(`<h3>企查查</h3><p class="settings-muted">查询企业主体、工商信息与公司背景。</p><p class="settings-muted">在 career 桌面版中可保存 API Key。使用 npm CLI 时，通过运行环境提供 QCC_API_KEY，再运行 company status 查看状态。</p><p class="settings-muted"><a href="https://agent.qcc.com/profile/api-key" target="_blank" rel="noopener noreferrer">获取 API Key ↗</a></p>`,'integrations');return;}
 settingsLayout('<h3>企查查</h3><p class="settings-muted">正在读取连接状态…</p>','integrations');
 try{const value=await desktop.companyStatus();if(request===settingsRequest&&settingsDialog.open)renderCompany(value);}catch(e){if(request===settingsRequest&&settingsDialog.open)settingsError((e as Error).message);}
}
function renderCompany(value:any,message=''){
 settingsLayout(`<div class="company-heading"><h3>企查查</h3><span class="current-label">${value.configured?'已配置':'未连接'}</span></div><p class="settings-muted">让 Agent 查询企业主体、工商信息与公司背景。</p><form id="company-form"><label class="settings-field">API Key<input id="company-key" type="password" maxlength="4096" autocomplete="off" spellcheck="false" required placeholder="${value.configured?'填写新 Key 以更换连接':'粘贴 API Key，可包含 Bearer 前缀'}"></label><p class="settings-muted company-help"><a href="https://agent.qcc.com/profile/api-key" target="_blank" rel="noopener noreferrer">获取 API Key ↗</a><span>本机加密保存，各工作区共用。</span></p><div class="settings-form-actions company-actions">${value.configured?'<button id="company-remove" class="button" type="button">移除连接</button><button id="company-check" class="button" type="button">测试连接</button>':''}<button class="button primary" type="submit" ${value.secure_storage_available?'':'disabled'}>保存并测试</button></div></form><p class="company-feedback settings-muted" id="company-feedback" role="status">${settingsEscape(message||(!value.secure_storage_available?'系统安全存储不可用，请解锁钥匙串后重试。':''))}</p><p class="settings-muted company-note">测试连接只检查工具目录。企业查询按需执行，可能消耗企查查积分。</p>`,'integrations');
 const checkedMessage=(check:any)=>check.missing_tools?.length?'连接成功，部分查询暂不可用。Agent 可根据返回的工具列表选择。':'连接成功，可以让 Agent 查询公司信息。';
 settingsFind<HTMLFormElement>('company-form').onsubmit=e=>{e.preventDefault();const input=settingsFind<HTMLInputElement>('company-key'),key=input.value;input.value='';input.readOnly=true;void settingsAction(async()=>{const saved=await desktop!.companySave(key);renderCompany(saved,checkedMessage(saved.check));}).finally(()=>input.readOnly=false);};
 settingsDialog.querySelector<HTMLButtonElement>('#company-check')?.addEventListener('click',()=>void settingsAction(async()=>{settingsFind('company-feedback').textContent='正在测试连接…';try{const checked=await desktop!.companyCheck();settingsFind('company-feedback').textContent=checkedMessage(checked);}catch(e){settingsFind('company-feedback').textContent='';throw e;}}));
 settingsDialog.querySelector<HTMLButtonElement>('#company-remove')?.addEventListener('click',()=>void settingsAction(async()=>renderCompany(await desktop!.companyRemove(),'已移除本机连接。')));
}
function renderAppearance(){settingsLayout(`<h3>外观</h3><label class="settings-preference"><span><strong>收起侧边栏</strong><small>收起后，点击顶部 Logo 即可展开。</small></span><input id="settings-sidebar" type="checkbox" ${document.body.classList.contains('sidebar-collapsed')?'checked':''}></label>`,'appearance');settingsFind<HTMLInputElement>('settings-sidebar').onchange=e=>{sidebarChoice=(e.target as HTMLInputElement).checked;setSidebar(sidebarChoice);try{localStorage.setItem('career.sidebar.collapsed',String(sidebarChoice));}catch{}};}
function renderModelSettings(){settingsLayout('<div id="model-settings"></div>','models');window.careerAIUI.mount(settingsFind('model-settings'));}
function renderUpdateSettings(){settingsLayout('<div id="updates-content"></div>','updates');window.careerUpdatesUI?.mount(settingsFind('updates-content'));}
async function openSettings(section='workspace'){
 const request=++settingsRequest;settingsData=undefined;section==='updates'?renderUpdateSettings():renderWorkspaceSettings();if(!settingsDialog.open)settingsDialog.showModal();
 try{const data=await settingsApi('session');if(request!==settingsRequest||!settingsDialog.open)return;settingsToken=data.token;const remembered=await settingsApi('remember',{});if(request!==settingsRequest||!settingsDialog.open)return;settingsData=remembered;section==='models'?renderModelSettings():section==='updates'?renderUpdateSettings():section==='sync'?void renderSync():renderWorkspaceSettings();}catch(e){if(request===settingsRequest&&settingsDialog.open)settingsError((e as Error).message);}
}
settingsButton?.addEventListener('click',()=>void openSettings(settingsButton.dataset.updateAvailable==='true'?'updates':'workspace'));
if(settingsButton)window.careerUpdatesUI?.connect(settingsButton,()=>void openSettings('updates'));
settingsDialog.addEventListener('cancel',e=>{if(settingsBusy)e.preventDefault();});
settingsDialog.addEventListener('close',()=>{
 // A queued close event may arrive after a new openSettings call has started.
 if(settingsDialog.open)return;
 settingsRequest++;settingsButton?.focus();
});
function renderAgentHandoff(entry:any){
 settingsLayout(`<h3>与 Agent 一起开始</h3><p class="settings-muted">在 Agent 软件中打开这个文件夹，新建对话并发送下面的指令。</p><p class="workspace-path">${settingsEscape(entry.path)}</p><textarea class="desktop-handoff-prompt" id="desktop-prompt" aria-label="给 Agent 的指令" readonly>${settingsEscape(entry.prompt)}</textarea><div class="settings-form-actions"><button id="desktop-copy" class="button primary">复制给 Agent</button><button id="desktop-reveal" class="button">打开文件夹</button><button id="desktop-enter" class="button">${entry.url?'进入工作区':'完成'}</button></div>`);
 settingsFind('desktop-copy').onclick=()=>void settingsAction(async()=>{await desktop!.copyPrompt(entry.path);settingsFind('desktop-copy').textContent='已复制';});
 settingsFind('desktop-reveal').onclick=()=>void settingsAction(()=>desktop!.reveal(entry.path));
 settingsFind('desktop-enter').onclick=()=>{if(entry.url&&settingsGuard())navigateWorkspace(entry.url);else if(!entry.url)settingsDialog.close();};
}

async function syncApi(route:string,data:unknown={}){
 const response=await fetch('/api/sync/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Career-Token':settingsToken},body:JSON.stringify(data)});
 const result=await response.json();if(!response.ok)throw new Error(result.error??'同步失败');return result;
}
function syncInstallLinks(env:any){return `${!env.git?`<a href="${settingsEscape(env.git_url)}" target="_blank" rel="noopener">安装 Git ↗</a>`:''} ${!env.gh?'<a href="https://cli.github.com/" target="_blank" rel="noopener">安装 GitHub CLI ↗</a>':''}`;}
async function renderSyncEnvironment(target='sync-environment'){
 const box=settingsDialog.querySelector<HTMLElement>('#'+target);if(!box)return;
 box.innerHTML='<p class="settings-muted">正在检查同步环境…</p>';
 try{
  const env=await syncApi('environment');if(!box.isConnected)return;
  box.innerHTML=`<p class="settings-muted">${settingsEscape(env.message)}</p><div class="sync-environment-actions">${syncInstallLinks(env)}${env.git&&env.gh&&!env.authenticated?'<button class="button" data-login>登录 GitHub</button>':''}<button class="text-button" data-check>重新检测</button></div><div class="settings-muted" data-login-status role="status"></div>`;
  box.querySelector<HTMLButtonElement>('[data-check]')!.onclick=()=>void renderSyncEnvironment(target);
  box.querySelector<HTMLButtonElement>('[data-login]')?.addEventListener('click',()=>void settingsAction(async()=>{
   await syncApi('login');const status=box.querySelector<HTMLElement>('[data-login-status]')!;
   const poll=async()=>{if(!box.isConnected||!settingsDialog.open)return;try{const login=await syncApi('login-status');
    if(login.status==='success'){await renderSyncEnvironment(target);return;}
    status.innerHTML=login.status==='error'?settingsEscape(login.message):login.code?`验证码 <strong>${settingsEscape(login.code)}</strong> · <a href="https://github.com/login/device" target="_blank" rel="noopener">前往 GitHub 验证 ↗</a>`:'正在等待 GitHub 验证…';
    if(login.status==='pending')setTimeout(()=>void poll(),2000);
   }catch(e){status.textContent=(e as Error).message;}};void poll();
  }));
 }catch(e){if(box.isConnected)box.textContent=(e as Error).message;}
}
async function renderSync(message=''){
 const request=++settingsRequest;settingsLayout('<p class="settings-muted">正在读取同步状态…</p>','sync');
 try{const value=await syncApi('status');if(request!==settingsRequest||!settingsDialog.open)return;
 const last=value.last_result,when=value.last_sync?new Date(value.last_sync).toLocaleString('zh-CN'):'尚未同步';
 settingsLayout(`<h3>云同步</h3><div class="sync-summary"><strong>${value.repository?'已连接私人仓库':'仅保存在本机'}</strong>${value.repository?`<p class="workspace-path">${settingsEscape(value.repository)}</p><p class="settings-muted">上次同步：${settingsEscape(when)}</p>`:''}</div><p class="settings-muted" role="status">${settingsEscape(message||(last?last.message:''))}</p>${last&&!last.ok?'<p class="settings-muted">本地资料已保留。处理提示后，可再次点击同步。</p>':''}<div id="sync-environment"></div>${value.repository?`<div class="sync-primary-actions"><button id="sync-update" class="button">↓ 更新</button><button id="sync-run" class="button primary">↑↓ 同步</button></div><p class="settings-muted">更新获取远端资料；同步会保存本地版本并上传。</p><label class="settings-preference"><span><strong>自动同步</strong><small>仅这台电脑。在工作台运行时定期同步，打开时先更新。</small></span><input id="sync-automatic" type="checkbox" ${value.preferences.automatic?'checked':''}></label><label class="settings-field sync-interval">同步间隔<select id="sync-interval">${[...new Set([1,5,10,15,30,60,value.preferences.interval_minutes])].sort((a,b)=>a-b).map(n=>`<option value="${n}" ${n===value.preferences.interval_minutes?'selected':''}>${n} 分钟</option>`).join('')}</select></label>${value.paused?'<p class="settings-error">自动同步已暂停；解决资料冲突后手动同步成功即可恢复。</p>':''}<details class="sync-identity"><summary>版本署名</summary><form id="sync-identity-form"><label class="settings-field">姓名<input name="name" autocomplete="name" required></label><label class="settings-field">邮箱<input name="email" type="email" autocomplete="email" required></label><button class="button" type="submit">保存署名</button></form></details>`:`<form id="sync-connect-form"><label class="settings-field">GitHub 私人仓库地址<input name="repository" required placeholder="https://github.com/你/私人仓库"></label><p class="settings-muted">首次连接使用空的私人仓库。已有资料请选择“从仓库恢复”。<a href="https://github.com/new" target="_blank" rel="noopener">创建私人仓库 ↗</a></p><details class="sync-identity"><summary>版本署名（首次使用 Git 时填写）</summary><label class="settings-field">姓名<input name="name" autocomplete="name"></label><label class="settings-field">邮箱<input name="email" type="email" autocomplete="email"></label></details><div class="settings-form-actions"><button class="button primary" type="submit">连接仓库</button></div></form>`}`,'sync');
 void renderSyncEnvironment();
 const bind=(id:string,operation:string)=>settingsDialog.querySelector<HTMLButtonElement>('#'+id)?.addEventListener('click',()=>{if(!settingsGuard())return;void settingsAction(async()=>{try{await syncApi(operation);await renderSync(operation==='run'?'已同步到私人仓库':'已获取远端资料');showSyncRefresh();}catch(e){await renderSync();throw e;}});});bind('sync-update','update');bind('sync-run','run');
 const automatic=settingsDialog.querySelector<HTMLInputElement>('#sync-automatic');if(automatic)automatic.onchange=()=>void settingsAction(async()=>{try{await syncApi('preferences',{automatic:automatic.checked});}catch(e){automatic.checked=!automatic.checked;throw e;}});
 const interval=settingsDialog.querySelector<HTMLSelectElement>('#sync-interval');if(interval)interval.onchange=()=>void settingsAction(async()=>{await syncApi('preferences',{interval_minutes:Number(interval.value)});});
 for(const id of ['sync-connect-form','sync-identity-form']){const form=settingsDialog.querySelector<HTMLFormElement>('#'+id);if(form)form.onsubmit=e=>{e.preventDefault();void settingsAction(async()=>{const data=Object.fromEntries(new FormData(form));for(const key of Object.keys(data))if(!data[key])delete data[key];await syncApi(id==='sync-connect-form'?'connect':'identity',data);await renderSync('已保存，可以开始同步。');});};}
 }catch(e){if(request===settingsRequest)settingsError((e as Error).message);}
}
function showSyncRefresh(){
 if(document.getElementById('sync-refresh'))return;
 const notice=document.createElement('button');notice.id='sync-refresh';notice.className='sync-refresh';notice.textContent='资料已更新 · 重新载入';notice.onclick=()=>{const event=new CustomEvent('career:before-workspace-switch',{cancelable:true,detail:{reason:''}});document.dispatchEvent(event);if(!event.defaultPrevented)location.reload();};document.body.append(notice);
}
if(settingsButton&&location.protocol!=='file:'){
 const button=document.createElement('button');button.className='sidebar-settings sidebar-cloud';button.setAttribute('aria-label','云同步');button.setAttribute('data-sidebar-tooltip','');
 button.innerHTML='<svg class="shell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 17H6a4 4 0 0 1-.8-7.9 7 7 0 0 1 13.6 0A4 4 0 0 1 18 17h-1M12 10v11m-4-7 4-4 4 4"/></svg><span class="nav-label">云同步</span><span class="shell-tooltip">云同步</span>';
 settingsButton.before(button);button.onclick=()=>void openSettings('sync');
 let previousUpdate:string|undefined;
 const poll=async()=>{try{if(!settingsToken)settingsToken=(await settingsApi('session')).token;const state=await syncApi('status');button.title=state.last_result?.message??(state.repository?'云同步':'仅保存在本机');button.classList.toggle('sync-attention',state.last_result?.ok===false);if(previousUpdate&&state.last_update!==previousUpdate&&state.last_result?.updated)showSyncRefresh();previousUpdate=state.last_update??'initial';}catch{}};
 void poll();setInterval(()=>void poll(),15000);
}

document.addEventListener('career:open-models',()=>void openSettings('models'));
