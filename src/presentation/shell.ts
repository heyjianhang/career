if(location.protocol==='file:')document.querySelectorAll<HTMLElement>('[data-local-nav]').forEach(e=>e.hidden=true);
const sidebarButton=document.querySelector<HTMLButtonElement>('#toggle-sidebar')!;
const narrow=window.matchMedia('(max-width: 900px)');
let sidebarChoice:boolean|null=null;
try {const saved=localStorage.getItem('career.sidebar.collapsed');if(saved==='true'||saved==='false')sidebarChoice=saved==='true';}catch{}
function setSidebar(collapsed:boolean) {
  document.body.classList.toggle('sidebar-collapsed',collapsed);
  sidebarButton.setAttribute('aria-expanded',String(!collapsed));
  const label=collapsed?'展开侧边栏':'收起侧边栏';
  sidebarButton.setAttribute('aria-label',label);sidebarButton.title=label;
  document.querySelector<HTMLElement>('#sidebar-backdrop')!.hidden=collapsed||!narrow.matches;
}
function collapseSidebar() {sidebarChoice=true;setSidebar(true);try{localStorage.setItem('career.sidebar.collapsed','true');}catch{}}
sidebarButton.addEventListener('click',()=>{
  sidebarChoice=!document.body.classList.contains('sidebar-collapsed');setSidebar(sidebarChoice);
  try{localStorage.setItem('career.sidebar.collapsed',String(sidebarChoice));}catch{}
});
document.querySelector('#sidebar-backdrop')!.addEventListener('click',collapseSidebar);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&narrow.matches&&!document.querySelector('dialog[open]'))collapseSidebar();});
narrow.addEventListener('change',()=>setSidebar(narrow.matches||(sidebarChoice??document.body.classList.contains('board-page'))));
setSidebar(narrow.matches||(sidebarChoice??document.body.classList.contains('board-page')));
document.querySelector('#copy-start')?.addEventListener('click',async()=>{
  const text=document.querySelector<HTMLElement>('#start-instruction')!;
  let message='已复制，发给 Agent 即可开始';
  try{await navigator.clipboard.writeText(text.textContent!);}catch{
    text.hidden=false;text.focus();const range=document.createRange();range.selectNodeContents(text);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);message='已选中指令，请按 Ctrl / ⌘ + C 复制';
  }
  const box=document.querySelector<HTMLElement>('#toast')!;box.textContent=message;box.classList.add('visible');setTimeout(()=>box.classList.remove('visible'),3200);
});
export {};
