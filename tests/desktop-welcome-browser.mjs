import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const directory=path.resolve('.cache/desktop-welcome-review');await mkdir(directory,{recursive:true});
const server=createServer(async(req,res)=>{
 const file={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/icon.svg':'icon.svg'}[req.url];
 if(!file){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');
 res.end(await readFile(path.join('desktop',file)));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
try{
 for(const platform of ['darwin','win32']){
  const page=await browser.newPage({viewport:{width:1240,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(platform=>{
   const sep=platform==='win32'?'\\':'/',base=platform==='win32'?'C:\\Users\\示例\\Documents':'/Users/example/Documents';
   window.fixture={selected:null,fail:false,created:[],recent:[]};const f=window.fixture;
   window.careerDesktop={
    state:async()=>({platform,version:'0.3.0-alpha.1',defaultLocation:base,recent:f.recent}),
    chooseDirectory:async()=>f.selected,
    createWorkspace:async data=>{if(f.fail)throw new Error('该文件夹已存在');const e={name:data.name,path:data.parent+sep+data.name,prompt:'示例协作指令',url:'http://127.0.0.1:12345/board',available:true};f.created.push(data);f.recent.unshift(e);return e;},
    openWorkspace:async path=>({path,url:'http://127.0.0.1:12345/board'}),
    navigate:async url=>{f.navigation=url;},copyPrompt:async path=>{f.copied=path;},reveal:async path=>{f.revealed=path;}
   };
  },platform);
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>!document.querySelector('main').hasAttribute('aria-busy'));
  assert.equal(await page.locator('#create').isVisible(),false);assert.equal(await page.locator('#recent-section').isVisible(),false);
  await page.locator('#open').click();assert.equal(await page.evaluate(()=>window.fixture.navigation),undefined);
  await page.locator('#new').click();await page.locator('#name').fill('我的求职资料');
  await page.locator('#create-back').click();assert.equal(await page.locator('#create').isVisible(),false);
  await page.locator('#new').click();assert.equal(await page.locator('#name').inputValue(),'我的求职资料');
  await page.evaluate(()=>window.fixture.fail=true);await page.locator('#create-submit').click();
  await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#create').isVisible(),true);
  assert.equal(await page.locator('#name').inputValue(),'我的求职资料');await page.evaluate(()=>window.fixture.fail=false);
  const fit=async label=>{for(const width of [720,1240]){await page.setViewportSize({width,height:width===720?560:850});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button,input')].filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));await page.screenshot({path:path.join(directory,platform+'-'+label+'-'+width+'.png'),fullPage:true});}};
  await fit('create');await page.locator('#create-submit').click();await page.locator('#ready').waitFor({state:'visible'});
  assert.equal(await page.locator('#create').isVisible(),false);assert.equal(await page.locator('#prompt').isVisible(),false);
  await page.locator('#copy').click();await page.waitForFunction(()=>document.getElementById('copy').textContent==='已复制');
  assert.match(await page.evaluate(()=>window.fixture.copied),/我的求职资料$/);
  await fit('ready');await page.locator('summary').click();assert.equal(await page.locator('#prompt').isVisible(),true);
  await page.locator('#back').click();await page.locator('#recent-section').waitFor({state:'visible'});await fit('recent');
  await page.locator('.recent-item').click();assert.equal(await page.evaluate(()=>window.fixture.navigation),'http://127.0.0.1:12345/board');
  await page.evaluate(()=>{window.fixture.navigation=null;window.fixture.selected=window.fixture.recent[0].path;});
  await page.locator('#open').click();await page.waitForFunction(()=>window.fixture.navigation);
  assert.equal(await page.locator('#ready').isVisible(),false);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Desktop welcome: separate steps, native dialog cancellation, failure recovery, copy, direct existing entry, Mac/Windows paths and 720–1240px passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
