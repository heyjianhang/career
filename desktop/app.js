const api=window.careerDesktop,$=id=>document.getElementById(id);
let state,current,busy=false;
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
 state=await api.state();$('version').textContent='v'+state.version;if(!$('parent').value)$('parent').value=state.defaultLocation;destination();
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
$('new').onclick=()=>{screen('create');$('name').focus();};
$('create-back').onclick=()=>screen('start');
$('name').oninput=destination;$('parent').oninput=destination;
$('choose').onclick=()=>void action(async()=>{const selected=await api.chooseDirectory($('parent').value);if(selected){$('parent').value=selected;destination();}});
$('create-form').onsubmit=e=>{e.preventDefault();void action(async()=>{const submit=$('create-submit');submit.textContent='正在创建…';try{ready(await api.createWorkspace({name:$('name').value,parent:$('parent').value}));}finally{submit.textContent='创建并继续 →';}});};
$('open').onclick=()=>void action(async()=>{const selected=await api.chooseDirectory(state.defaultLocation);if(selected){const opened=await api.openWorkspace(selected);await api.navigate(opened.url);}});
$('copy').onclick=()=>void action(async()=>{await api.copyPrompt(current.path);$('copy').textContent='已复制';$('status').textContent='在 Agent 软件的新对话中粘贴即可。';});
$('reveal').onclick=()=>void action(()=>api.reveal(current.path));$('enter').onclick=()=>void action(()=>api.navigate(current.url));
$('back').onclick=()=>void action(async()=>{await refresh();screen('start');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!busy&&!$('create').hidden)screen('start');});
void action(refresh);
