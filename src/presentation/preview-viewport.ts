/** Shared by the document, template gallery and live editor; embedded in offline HTML. */
export function previewViewport() {
  const paperWidth=210*96/25.4;
  const origin=(frame:HTMLIFrameElement,viewport:HTMLElement)=>frame.getBoundingClientRect().top-viewport.getBoundingClientRect().top-viewport.clientTop+viewport.scrollTop;
  const scale=(frame:HTMLIFrameElement)=>frame.getBoundingClientRect().width/paperWidth;
  const top=(frame:HTMLIFrameElement,viewport:HTMLElement,element:HTMLElement)=>origin(frame,viewport)+element.getBoundingClientRect().top*scale(frame);
  function resize(host:HTMLElement,frame:HTMLIFrameElement,viewport:HTMLElement,zoom:string,height:number) {
    const container=host.id==='gallery-resume'?host.parentElement!:viewport,css=getComputedStyle(container);
    const available=container.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0);
    if(available<=0)return;
    const next=zoom==='fit'?Math.min(1,available/paperWidth):Number(zoom);
    if(!Number.isFinite(next)||next<=0)return;
    const previous=Number(host.dataset.previewScale),changed=Math.abs(previous-next)>.0001;
    const resized=Math.abs(Number(host.dataset.previewAvailable)-available)>.5;
    const offset=origin(frame,viewport),reading=previous?(viewport.scrollTop-offset)/previous:0;
    host.style.width=paperWidth*next+'px';host.style.height=Math.ceil(height*next)+'px';
    frame.style.height=height+'px';frame.style.transform='scale('+next+')';
    host.dataset.previewScale=String(next);host.dataset.previewAvailable=String(available);
    if(previous&&changed&&reading>0)viewport.scrollTop=origin(frame,viewport)+reading*next;
    // Auto margins center pages that fit; positive overflow keeps both edges reachable.
    if(!previous||changed||resized)viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);
  }
  function current(frame:HTMLIFrameElement,viewport:HTMLElement) {
    const pages=Array.from(frame.contentDocument?.querySelectorAll<HTMLElement>('.pagedjs_page')??[]);
    if(pages.length&&viewport.scrollHeight>viewport.clientHeight&&viewport.scrollTop+viewport.clientHeight>=viewport.scrollHeight-2)return pages.length;
    const threshold=viewport.scrollTop+Math.min(80,viewport.clientHeight*.2);
    return Math.max(1,pages.filter(page=>top(frame,viewport,page)<=threshold).length);
  }
  function controls(page:number,count:number,label:HTMLElement,previous:HTMLButtonElement,next:HTMLButtonElement) {
    label.textContent=page+' / '+count;previous.disabled=page<=1;next.disabled=page>=count;
  }
  return {resize,top,current,controls};
}
