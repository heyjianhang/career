const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
exports.run=async({app,win,workspace})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 const wait=async source=>{const until=Date.now()+20000;while(Date.now()<until){if(await js(`Boolean(${source})`))return;await new Promise(r=>setTimeout(r,50));}throw new Error('AI UI timeout: '+source);};
 let requests=0;
 const server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);assert.equal(req.headers.authorization,'Bearer synthetic-desktop-model-key');assert.equal(body.response_format.type,'json_object');requests++;const source=body.messages[1].content[0].text;const draft={company:source.includes('连接测试公司')?'连接测试公司':'远山科技（合成）',title:source.includes('连接测试工程师')?'连接测试工程师':'AI 应用工程师',location:'杭州',salary:'20–30K',raw_text:source,warnings:[]};res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'synthetic',object:'chat.completion',created:1,model:'synthetic',choices:[{index:0,message:{role:'assistant',content:JSON.stringify(draft)},finish_reason:'stop'}]}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  await js(`document.dispatchEvent(new CustomEvent('career:open-models'))`);await wait(`document.querySelector('[data-service="bailian"]')`);await js(`document.querySelector('#model-add').click();document.querySelector('[data-configure="compatible"]').click()`);await wait(`document.querySelector('#model-form')`);
  await js(`(()=>{const f=document.querySelector('#model-form');f.elements.kind.value='compatible';f.elements.name.value='桌面合成验证';f.elements.baseURL.value='http://127.0.0.1:${server.address().port}/v1';f.elements.key.value='synthetic-desktop-model-key';f.elements.model.value='synthetic';f.requestSubmit();})()`);
  await wait(`document.querySelector('[data-test-model]')`);const state=await js('window.careerDesktop.aiStatus()');assert.equal(state.providers.length,1);assert.ok(!JSON.stringify(state).includes('synthetic-desktop-model-key'));
  const saved=await fs.readFile(path.join(app.getPath('userData'),'integrations/models.json'),'utf8');assert.ok(!saved.includes('synthetic-desktop-model-key'));assert.ok(!saved.includes('127.0.0.1'));
  await js(`document.querySelector('[data-test-model]').click()`);await wait(`document.querySelector('.model-tested')?.textContent.includes('文字已验证')`);
  await fs.writeFile(path.join(app.getPath('userData'),'ai-models.png'),(await win.webContents.capturePage()).toPNG());
  await js(`document.querySelector('#settings-close').click();document.querySelector('#add-opportunity').click()`);await wait(`document.querySelector('#jd-text')`);
  await js(`document.querySelector('#jd-text').value='远山科技（合成）\\nAI 应用工程师\\n杭州 · 20–30K\\n职责：开发企业 Agent。';document.querySelector('#jd-text').dispatchEvent(new Event('input'));`);
  await wait(`document.querySelector('.jd-model-line')?.textContent.includes('桌面合成验证')`);
  await js(`document.querySelector('#jd-recognize').click()`);await wait(`document.querySelector('#jd-company')`);assert.equal(await js(`document.querySelector('#jd-company').value`),'远山科技（合成）');
  await fs.writeFile(path.join(app.getPath('userData'),'ai-review.png'),(await win.webContents.capturePage()).toPNG());
  await js(`document.querySelector('#jd-create').click()`);await wait(`document.querySelector('#opportunity-drawer').open`);
  const cards=await js(`fetch('/api/board/overview').then(r=>r.json())`);const card=cards.cards.find(c=>c.company==='远山科技（合成）');assert.ok(card);assert.ok((await fs.readFile(path.join(workspace,'opportunities',card.id,'job.md'),'utf8')).includes('开发企业 Agent'));
  await js(`document.querySelector('#close-drawer').click()`);assert.equal(requests,2);
  // Keep an encrypted synthetic connection for the separate cold-start check.
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
};
