// Shared select follows the workbench stage menu: a bordered trigger and quiet selected row.
// The native select remains the form/state contract; the popover provides consistent keyboard UI.
declare global {interface Window {careerSelectUI:{mount:(root:ParentNode)=>void;close:()=>void}}}
export {};
let selectActive:{close:(focus?:boolean)=>void;place:()=>void;node:HTMLElement}|null=null;
document.addEventListener('pointerdown',event=>{if(selectActive&&!selectActive.node.contains(event.target as Node))selectActive.close();},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selectActive){event.preventDefault();event.stopImmediatePropagation();selectActive.close(true);}},true);
window.addEventListener('resize',()=>selectActive?.place());
document.addEventListener('close',()=>{if(selectActive&&!selectActive.node.closest('dialog')?.open)selectActive.close();},true);
document.addEventListener('scroll',()=>selectActive?.place(),true);
window.careerSelectUI={close:()=>selectActive?.close(),mount(root){
 root.querySelectorAll<HTMLSelectElement>('select:not([data-enhanced])').forEach(select=>{
  select.dataset.enhanced='true';select.hidden=true;select.tabIndex=-1;
  const wrapper=document.createElement('div');wrapper.className='career-select';select.after(wrapper);
  const trigger=document.createElement('button');trigger.type='button';trigger.className='career-select-trigger';trigger.id=select.id?select.id+'-trigger':'';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');menu.className='career-select-menu';menu.setAttribute('popover','manual');menu.id='select-menu-'+crypto.randomUUID();menu.setAttribute('role','listbox');trigger.setAttribute('aria-controls',menu.id);wrapper.append(trigger,menu);
  const label=select.getAttribute('aria-label')||select.labels?.[0]?.childNodes[0]?.textContent?.trim()||'请选择';menu.setAttribute('aria-label',label);
  const close=(focus=false)=>{if(menu.matches(':popover-open'))menu.hidePopover();trigger.setAttribute('aria-expanded','false');if(selectActive?.node===wrapper)selectActive=null;if(focus&&trigger.isConnected)trigger.focus();};
  const sync=()=>{trigger.disabled=select.disabled;trigger.classList.toggle('is-empty',!select.value);trigger.replaceChildren();const value=document.createElement('span');value.textContent=select.selectedOptions[0]?.textContent||'请选择';trigger.append(value);trigger.insertAdjacentHTML('beforeend',window.careerModelCatalog.icon('chevron-down'));trigger.setAttribute('aria-label',label+'：'+value.textContent);if(select.disabled)close();};
  const place=()=>{if(!wrapper.isConnected){close();return;}const r=trigger.getBoundingClientRect(),gap=6,below=innerHeight-r.bottom-12,above=r.top-12,up=below<190&&above>below,space=Math.max(70,up?above:below);menu.style.width=Math.min(Math.max(r.width,190),innerWidth-24)+'px';menu.style.maxHeight=Math.min(300,space)+'px';menu.style.left=Math.max(12,Math.min(r.left,innerWidth-menu.offsetWidth-12))+'px';menu.style.top=(up?Math.max(12,r.top-menu.offsetHeight-gap):r.bottom+gap)+'px';};
  function open(edge?:'first'|'last'){
   if(select.disabled)return;selectActive?.close();menu.replaceChildren();
   [...select.options].forEach((option,index)=>{const row=document.createElement('button');row.type='button';row.className='career-select-option';row.setAttribute('role','option');row.setAttribute('aria-selected',String(option.selected));row.tabIndex=-1;row.disabled=option.disabled;row.dataset.index=String(index);const text=document.createElement('span');text.textContent=option.textContent;row.append(text);if(option.dataset.description){const small=document.createElement('small');small.textContent=option.dataset.description;row.append(small);}row.addEventListener('click',event=>{event.preventDefault();if(row.disabled)return;select.selectedIndex=index;sync();close(true);select.dispatchEvent(new Event('change',{bubbles:true}));});menu.append(row);});
   menu.showPopover();trigger.setAttribute('aria-expanded','true');selectActive={close,place,node:wrapper};place();
   const rows=[...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];(edge==='first'?rows[0]:edge==='last'?rows.at(-1):menu.querySelector<HTMLButtonElement>('[aria-selected=true]:not(:disabled)')||rows[0])?.focus({preventScroll:true});
  }
  trigger.addEventListener('click',event=>{event.preventDefault();menu.matches(':popover-open')?close():open();});
  trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();open(event.key==='Home'?'first':event.key==='End'?'last':undefined);}});
  let typed='',typedAt=0;
  menu.addEventListener('keydown',event=>{const rows=[...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],index=rows.indexOf(document.activeElement as HTMLButtonElement);let next:HTMLButtonElement|undefined;if(event.key==='ArrowDown')next=rows[(index+1)%rows.length];else if(event.key==='ArrowUp')next=rows[(index-1+rows.length)%rows.length];else if(event.key==='Home')next=rows[0];else if(event.key==='End')next=rows.at(-1);else if(event.key==='Tab'){close(true);return;}else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&event.key!==' '){typed=Date.now()-typedAt<700?typed+event.key:event.key;typedAt=Date.now();next=rows.find(r=>r.textContent?.toLowerCase().startsWith(typed.toLowerCase()));}if(next){event.preventDefault();next.focus();}});
  select.addEventListener('change',sync);select.addEventListener('career:select-sync',sync);select.addEventListener('invalid',event=>{event.preventDefault();trigger.focus();trigger.setAttribute('aria-invalid','true');});select.addEventListener('change',()=>trigger.removeAttribute('aria-invalid'));
  new MutationObserver(sync).observe(select,{attributes:true,childList:true,subtree:true});sync();
 });
}};
