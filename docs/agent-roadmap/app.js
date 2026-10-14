(() => {
  const data=JSON.parse(document.querySelector('#roadmap-data').textContent);
  const $=s=>document.querySelector(s);
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fileIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/></svg>';
  let route,step,readerStack=[],raw=false,opener=null;
  const reader=$('#reader');
  function render(){
    const params=new URLSearchParams(location.hash.slice(1));
    route=data.routes.find(r=>r.id===params.get('route'))||data.routes[0];
    step=data.steps.find(s=>s.id===params.get('step')&&route.steps.includes(s.id))||data.steps.find(s=>s.id===route.steps[0]);
    $('#routes').innerHTML=data.routes.map(r=>`<button data-route="${r.id}" aria-pressed="${r.id===route.id}">${escape(r.name)}</button>`).join('');
    $('#route-description').textContent=route.description;
    $('#steps').innerHTML=route.steps.map((id,i)=>{const s=data.steps.find(s=>s.id===id);return `<button class="step-button" data-step="${id}" ${id===step.id?'aria-current="step"':''}><span class="number">${String(i+1).padStart(2,'0')}</span><span><strong>${escape(s.name)}</strong><small>${escape(s.skill)}</small></span></button>`}).join('');
    const i=route.steps.indexOf(step.id);
    $('#stage').innerHTML=`<header class="stage-top"><div class="stage-kicker"><span>STEP ${String(i+1).padStart(2,'0')} / ${route.steps.length}</span><span class="tag">${escape(step.tag)}</span></div><h2>${escape(step.name)}</h2><p>${escape(step.summary)}</p></header><div class="stage-body"><div class="incoming"><h3>收到的信息</h3><p>${escape(step.input)}</p></div><div class="read-list">${step.reads.map(d=>`<button class="doc-link" data-open-doc="${escape(d.path)}">${fileIcon}${escape(d.label)}<span aria-hidden="true">↗</span></button>`).join('')}</div><h3>Agent 如何引导</h3><ol class="guide">${step.guide.map(t=>`<li>${escape(t)}</li>`).join('')}</ol><div class="example"><small>可以这样接话 · 示例</small>${escape(step.example)}</div><h3>保存到哪里</h3><ul class="save-list">${step.save.map(t=>`<li>${escape(t)}</li>`).join('')}</ul><div class="conditions"><div class="condition"><h3>何时可以继续</h3><p>${escape(step.gate)}</p></div><div class="condition wait"><h3>这里别跳过</h3><p>${escape(step.stay)}</p></div></div>${step.commands?`<details class="commands"><summary>相关 CLI 入口</summary><p>按工作区 AGENTS 选择桌面或 npm 前缀；此处仅展示，不执行。</p>${step.commands.map(t=>`<code>${escape(t)}</code>`).join('')}</details>`:''}</div><footer class="stage-bottom"><p>${escape(step.next)}</p><div class="stage-controls"><button data-step="${route.steps[i-1]||''}" ${i===0?'disabled':''}>← 上一步</button><button data-step="${route.steps[i+1]||''}" ${i===route.steps.length-1?'disabled':''}>下一步 →</button></div></footer>`;
  }
  function navigate(routeId,stepId){location.hash=new URLSearchParams({route:routeId,step:stepId}).toString()}
  function openDoc(path,anchor=''){
    const doc=data.docs[path];if(!doc)return;
    if(!reader.open){opener=document.activeElement;readerStack=[];reader.showModal();document.body.style.overflow='hidden'}
    readerStack.push({path,anchor});raw=false;renderDoc();
  }
  function renderDoc(){
    const {path,anchor}=readerStack.at(-1),doc=data.docs[path];
    $('#reader-title').textContent=doc.title;$('#reader-path').textContent=doc.source;
    $('#reader-back').disabled=readerStack.length<2;
    $('#reader-source').href='../../'+doc.source;
    $('#reader-preview').setAttribute('aria-pressed',String(!raw));$('#reader-raw').setAttribute('aria-pressed',String(raw));
    $('#reader-content').innerHTML=raw?`<pre class="raw">${escape(doc.raw)}</pre>`:doc.html;
    $('#reader-content').scrollTop=0;
    if(anchor&&!raw){const el=Array.from($('#reader-content').querySelectorAll('[id]')).find(e=>e.id===anchor);el?.scrollIntoView({block:'start'})}
  }
  document.addEventListener('click',e=>{
    const phase=e.target.closest('[data-phase]');if(phase){navigate('first',phase.dataset.phase);$('#route-title').scrollIntoView({block:'start'});return}
    const routeButton=e.target.closest('[data-route]');if(routeButton){const r=data.routes.find(r=>r.id===routeButton.dataset.route);navigate(r.id,r.steps[0]);return}
    const stepButton=e.target.closest('[data-step]');if(stepButton&&!stepButton.disabled){navigate(route.id,stepButton.dataset.step);return}
    const link=e.target.closest('[data-open-doc]');if(link){e.preventDefault();openDoc(link.dataset.openDoc,link.dataset.anchor||'')}
  });
  $('#reader-close').addEventListener('click',()=>reader.close());
  $('#reader-back').addEventListener('click',()=>{if(readerStack.length>1){readerStack.pop();raw=false;renderDoc()}});
  $('#reader-preview').addEventListener('click',()=>{raw=false;renderDoc()});
  $('#reader-raw').addEventListener('click',()=>{raw=true;renderDoc()});
  reader.addEventListener('cancel',e=>{if(readerStack.length>1){e.preventDefault();readerStack.pop();raw=false;renderDoc()}});
  reader.addEventListener('click',e=>{if(e.target===reader&&e.clientX<reader.getBoundingClientRect().left)reader.close()});
  reader.addEventListener('close',()=>{document.body.style.overflow='';opener?.focus();readerStack=[]});
  function showCurrentStep(){const active=$('.step-button[aria-current]'),rail=$('#steps');if(innerWidth<=700&&active)rail.scrollLeft=active.offsetLeft-rail.offsetLeft-8;}
  window.addEventListener('hashchange',()=>{render();showCurrentStep()});
  window.addEventListener('resize',showCurrentStep);
  $('#build-date').textContent=data.builtAt;$('#doc-count').textContent=Object.keys(data.docs).length;
  render();showCurrentStep();
})();
