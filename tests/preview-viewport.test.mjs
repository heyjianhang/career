import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {previewViewport} from '../dist/presentation/preview-viewport.js';
function scene(width=800){
 const paper=210*96/25.4,view={clientWidth:width,clientHeight:600,clientTop:0,scrollTop:0,scrollLeft:0,get scrollWidth(){return Math.max(width,parseFloat(host.style.width||'0')+40)},getBoundingClientRect(){return {top:100}}};
 const host={id:'resume-preview',parentElement:view,style:{},dataset:{}};
 const frame={style:{},getBoundingClientRect(){return {width:parseFloat(host.style.width||String(paper)),top:116-view.scrollTop}},contentDocument:{querySelectorAll(){return pages}}};
 const pages=[0,1147,2294].map(top=>({getBoundingClientRect:()=>({top})}));
 const api=vm.runInNewContext('('+previewViewport.toString()+')()',{getComputedStyle:()=>({paddingLeft:'20px',paddingRight:'20px'})});
 return {api,view,host,frame,pages,paper};
}
test('fit width excludes padding; scaled canvas stays at paper width on large screens',()=>{
 for(const width of [420,800,1600]){const {api,view,host,frame,paper}=scene(width);api.resize(host,frame,view,'fit',3400);assert.equal(parseFloat(host.style.width),Math.min(width-40,paper));assert.equal(view.scrollLeft,0);}
});
test('zoom preserves vertical reading position and centers safe horizontal overflow',()=>{
 const {api,view,host,frame}=scene(800);api.resize(host,frame,view,'1',3400);view.scrollTop=1163;api.resize(host,frame,view,'1.25',3400);
 assert.ok(Math.abs(view.scrollTop-(16+1147*1.25))<.001);assert.equal(view.scrollLeft,(view.scrollWidth-view.clientWidth)/2);assert.equal(api.current(frame,view),2);
 api.resize(host,frame,view,'1',3400);assert.ok(Math.abs(view.scrollTop-1163)<.001);
});
test('page navigation includes the iframe origin and zoom, with disabled edge controls',()=>{
 const {api,view,host,frame,pages}=scene();api.resize(host,frame,view,'1.25',3400);
 assert.ok(Math.abs(api.top(frame,view,pages[1])-(16+1147*1.25))<.001);
 const label={},prev={},next={};api.controls(1,3,label,prev,next);assert.equal(prev.disabled,true);assert.equal(next.disabled,false);
 api.controls(3,3,label,prev,next);assert.equal(prev.disabled,false);assert.equal(next.disabled,true);assert.equal(label.textContent,'3 / 3');
});

test('manual zoom recenters when the viewport changes without changing scale',()=>{
 const {api,view,host,frame}=scene(800);api.resize(host,frame,view,'1.25',3400);
 view.clientWidth=600;api.resize(host,frame,view,'1.25',3400);assert.equal(view.scrollLeft,(view.scrollWidth-view.clientWidth)/2);
});

test('a last page shorter than the viewport still reports the final page at scroll end',()=>{
 const {api,view,frame}=scene();view.scrollHeight=1200;view.scrollTop=600;assert.equal(api.current(frame,view),3);
});
