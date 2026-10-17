import './updates.js';
const api=window.careerDesktop,$=id=>document.getElementById(id);
let state,current,busy=false,restoring=false;
const error=message=>{$('error').textContent=message;$('error').hidden=!message;};
function screen(id){for(const name of ['start','create','ready'])$(name).hidden=name!==id;error('');$('status').textContent='';$(id+'-title').focus();}
async function action(fn){
 if(busy)return;busy=true;error('');document.querySelector('main').setAttribute('aria-busy','true');
 const controls=[...document.querySelectorAll('button:not(:disabled),input:not(:disabled)')];controls.forEach(b=>b.disabled=true);
 try{await fn();}catch(e){error(e.message);}finally{busy=false;controls.forEach(b=>b.disabled=false);document.querySelector('main').removeAttribute('aria-busy');}
}
function destination(){const parent=$('parent').value.replace(/[\\/]$/,'');$('destination').textContent=parent&&$('name').value?'将创建：'+parent+(state?.platform==='win32'?'\\':'/')+$('name').value:'请选择保存位置并填写名称。';}
function ready(entry){current=entry;screen('ready');$('workspace-title').textContent=entry.name;$('workspace-path').textContent=entry.path;$('prompt').value=entry.prompt;$('copy').textContent='复制给 Agent';document.querySelector('.prompt-details').open=false;}
async function refresh(){
 state=await api.state();$('sync-hint').textContent=state.sync_environment?.git?'':'尚未检测到 Git；本机使用不受影响，启用云同步时可安装。';$('version').textContent='v'+state.version;if(!$('parent').value)$('parent').value=state.defaultLocation;destination();
 $('recent').replaceChildren();$('recent-section').hidden=!state.recent.length;
 for(const entry of state.recent){
  const button=document.createElement('button');button.className='recent-item'+(entry.available?'':' unavailable');
  const info=document.createElement('span');info.className='recent-info';
  const title=document.createElement('strong');title.textContent=entry.name+(entry.available?'':' · 重新定位');
  const detail=document.createElement('small');detail.textContent=entry.path;info.append(title,detail);
  const arrow=document.createElement('span');arrow.className='recent-arrow';arrow.textContent='→';arrow.setAttribute('aria-hidden','true');button.append(info,arrow);
  button.onclick=()=>void action(async()=>{const directory=entry.available?entry.path:await api.chooseDirectory(state.defaultLocation);if(directory){const opened=await api.openWorkspace(directory);await api.navigate(opened.url);}});
  $('recent').append(button);
 }
}
function createMode(restore){restoring=restore;screen('create');$('create-title').textContent=restore?'从 Git 仓库恢复':'新建工作区';$('repository-field').hidden=!restore;$('repository').required=restore;$('restore-environment').hidden=!restore;$('create-submit').textContent=restore?'恢复并继续 →':'创建并继续 →';if(restore)void checkSyncEnvironment();$('name').focus();}
$('new').onclick=()=>createMode(false);$('restore').onclick=()=>createMode(true);
$('create-back').onclick=()=>screen('start');
$('name').oninput=destination;$('parent').oninput=destination;
$('choose').onclick=()=>void action(async()=>{const selected=await api.chooseDirectory($('parent').value);if(selected){$('parent').value=selected;destination();}});
$('create-form').onsubmit=e=>{e.preventDefault();void action(async()=>{const submit=$('create-submit');submit.textContent=restoring?'正在恢复…':'正在创建…';try{ready(await api.createWorkspace({name:$('name').value,parent:$('parent').value,...(restoring?{repository:$('repository').value}:{})}));}finally{submit.textContent=restoring?'恢复并继续 →':'创建并继续 →';}});};
$('open').onclick=()=>void action(async()=>{const selected=await api.chooseDirectory(state.defaultLocation);if(selected){const opened=await api.openWorkspace(selected);await api.navigate(opened.url);}});
$('copy').onclick=()=>void action(async()=>{await api.copyPrompt(current.path);$('copy').textContent='已复制';$('status').textContent='在 Agent 软件的新对话中粘贴即可。';});
$('reveal').onclick=()=>void action(()=>api.reveal(current.path));$('enter').onclick=()=>void action(()=>api.navigate(current.url));
$('back').onclick=()=>void action(async()=>{await refresh();screen('start');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')&&!busy&&!$('create').hidden)screen('start');});
void action(refresh);

async function checkSyncEnvironment(){
 const box=$('restore-environment');box.textContent='正在检查同步环境…';
 try{const value=await api.syncEnvironment();box.replaceChildren();
  const text=document.createElement('p');text.className='path';text.textContent=value.message;box.append(text);
  for(const [missing,label,url] of [[!value.git,'安装 Git',value.git_url],[!value.gh,'安装 GitHub CLI',value.gh_url]])if(missing){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent=label+' ↗';box.append(a);}
  const retry=document.createElement('button');retry.className='text';retry.textContent='重新检测';retry.onclick=()=>void checkSyncEnvironment();box.append(retry);
  if(value.git&&value.gh&&!value.authenticated){const login=document.createElement('button');login.textContent='登录 GitHub';box.append(login);login.onclick=()=>void action(async()=>{await api.syncLogin();const status=document.createElement('p');status.className='path';box.append(status);
   const poll=async()=>{if(!restoring||$('create').hidden||!box.contains(status))return;try{const result=await api.syncLoginStatus();if(result.status==='success'){await checkSyncEnvironment();return;}status.textContent=result.status==='error'?result.message:result.code?'验证码：'+result.code+'，请在 GitHub 官方页面完成验证。':'正在等待 GitHub 验证…';if(result.status==='pending')setTimeout(()=>void poll(),2000);}catch(e){status.textContent=e.message;}};
   const link=document.createElement('a');link.href='https://github.com/login/device';link.target='_blank';link.rel='noopener';link.textContent='前往 GitHub 验证 ↗';box.append(link);void poll();
  });}
 }catch(e){box.textContent=e.message;}
}

const openUpdates=()=>window.careerUpdatesUI?.openStandalone();
$('open-updates').onclick=openUpdates;
window.careerUpdatesUI?.connect($('open-updates'),openUpdates);
