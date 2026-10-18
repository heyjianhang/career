// Explicit synthetic smoke mode; no existing user workspaces are opened.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
// Runs in a second application process using the first smoke run's isolated
// userData. createWindow must already have restored the saved workspace.
exports.runStartup=async({win,manager})=>{
 const registry=await manager.readRegistry();
 assert.equal(registry.recent.length,2);
 const expected=registry.recent.find(entry=>entry.id===registry.last_workspace);
 assert.ok(expected);
 assert.equal(new URL(win.webContents.getURL()).pathname,'/board');
 const opened=await win.webContents.executeJavaScript('window.careerDesktop.handoff()');
 assert.equal(opened.path,expected.path);
 assert.equal((await win.webContents.executeJavaScript('window.careerDesktop.updatesState()')).automatic,false);
 const modelState=await win.webContents.executeJavaScript('window.careerDesktop.aiStatus()');assert.equal(modelState.providers[0].name,'桌面合成验证');assert.equal(modelState.defaults.text,modelState.providers[0].id);const voiceService=modelState.services.find(s=>s.kind==='volcengine');assert.equal(voiceService.hasSpeechKey,true);assert.equal(voiceService.hasKey,false);assert.equal(modelState.providers.find(p=>p.id===modelState.defaults.speech).model,'volc.seedasr.sauc.duration');await win.webContents.executeJavaScript('window.careerDesktop.aiRemove('+JSON.stringify(modelState.providers[0].id)+')');
 return {ok:true,workspace:opened.path,checks:['cold start restores the last workspace from persisted multi-workspace history','automatic update preference survives application restart']};
};
exports.run=async({app,win,tray,manager,core,coreRoot,openWorkspace,openInitialPage,showWelcome,printHtml,state})=>{
 const base=path.join(app.getPath('userData'),'synthetic');await fs.mkdir(base,{recursive:true});
 const js=source=>win.webContents.executeJavaScript(source);
 const waitFor=async source=>{const end=Date.now()+20000;while(Date.now()<end){if(await js(source))return;await new Promise(r=>setTimeout(r,50));}throw new Error('UI timeout: '+source);};
 const capture=async name=>fs.writeFile(path.join(app.getPath('userData'),name+'.png'),(await win.webContents.capturePage()).toPNG());
 await waitFor(`!document.querySelector('main').hasAttribute('aria-busy')`);
 // Update settings are available before opening a workspace; smoke stays offline.
 const updateState=await js('window.careerDesktop.updatesState()');
 assert.equal(updateState.currentVersion,app.getVersion());assert.equal(updateState.latest,null);
 await js(`document.getElementById('open-updates').click()`);
 await waitFor(`document.querySelector('[data-update-action="automatic"]')`);
 assert.equal(await js(`document.querySelector('#desktop-updates').open`),true);
 await js(`document.querySelector('[data-update-action="automatic"]').click()`);
 await waitFor(`!document.querySelector('[data-update-action="automatic"]').disabled`);
 assert.equal((await js('window.careerDesktop.updatesState()')).automatic,false);
 await capture('updates-welcome');
 await js(`document.querySelector('.updates-close').click()`);
 assert.equal(await js(`document.getElementById('create').hidden&&document.getElementById('ready').hidden&&document.getElementById('recent-section').hidden`),true);
 assert.equal(tray.isDestroyed(),false);
 if(process.platform==='win32'){assert.equal(require('electron').Menu.getApplicationMenu(),null);assert.equal(win.isMenuBarVisible(),false);}
 for(const icon of ['icon.png','icon-win.png','icon.ico','icon.icns','tray.ico','trayTemplate.png','trayTemplate@2x.png'])await fs.access(path.join(__dirname,'assets',icon));
 assert.equal(await js(`typeof window.careerDesktop.syncEnvironment`),'function');
 assert.equal(await js(`typeof window.careerDesktop.syncLogin`),'function');
 await js(`document.getElementById('restore').click()`);
 assert.equal(await js(`!document.getElementById('repository-field').hidden&&document.getElementById('repository').required`),true);
 await capture('restore');await js(`document.getElementById('create-back').click()`);
 await capture('welcome-empty');
 await js(`document.getElementById('new').click();document.getElementById('name').value='面试准备 A';document.getElementById('parent').value=${JSON.stringify(base)};document.getElementById('parent').dispatchEvent(new Event('input'));`);
 assert.equal(await js(`document.getElementById('start').hidden&&!document.getElementById('create').hidden`),true);
 await capture('create');
 await js(`document.getElementById('create-form').requestSubmit()`);
 await waitFor(`!document.getElementById('ready').hidden&&!document.querySelector('main').hasAttribute('aria-busy')`);
 assert.equal(await js(`document.querySelector('.prompt-details').open`),false);
 await capture('handoff');
 const first=await manager.entry(path.join(base,'面试准备 A')),second=await manager.create(base,'另一份 B');
 const a=await openWorkspace(first.path),b=await openWorkspace(second.path);assert.notEqual(a.url,b.url);
 for(const file of ['AGENTS.md','.agents/skills/career-setup/SKILL.md','.agents/skills/career-board/SKILL.md','.local/career','.local/career.cmd'])await fs.access(path.join(first.path,file));
 for(const skill of ['career-setup','career-git','career-intake','career-employment','career-project','resume-master','resume-tailor','career-board','career-company','career-match','career-outreach','boss-zhipin-scraper','jd-research'])await fs.access(path.join(first.path,'.agents/skills',skill,'SKILL.md'));
 for(const name of ['pre-resume.md','tracking.md'])await fs.access(path.join(first.path,'.agents/skills/jd-research/references',name));
 assert.equal(await fs.readFile(path.join(first.path,'.gitattributes'),'utf8'),await fs.readFile(path.join(coreRoot,'resources/workspace/gitattributes.template'),'utf8'));
 const cli=args=>{const result=spawnSync(process.execPath,[path.join(__dirname,'runner.cjs'),'--workspace',first.path,...args],{encoding:'utf8',env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PATH:process.platform==='win32'?path.join(process.env.SystemRoot,'System32'):'/usr/bin:/bin'},cwd:second.path,timeout:60000});if(result.error)throw result.error;return result;};
 const doctor=cli(['doctor','--json']);assert.equal(doctor.status,0,doctor.stderr);assert.equal(JSON.parse(doctor.stdout).data.workspace,first.path);
 const wrong=cli(['resume','create','--title','不能写入 B','--workspace',second.path,'--json']);assert.notEqual(wrong.status,0);
 for(const workspace of [first.path,second.path]){
  assert.equal(await fs.stat(path.join(workspace,'examples')).catch(()=>null),null);
  for(const folder of ['resume/presentations','resume/versions','opportunities'])assert.deepEqual(await fs.readdir(path.join(workspace,folder)).catch(e=>{if(e.code==='ENOENT')return [];throw e;}),[]);
 }
 for(const session of [a,b]){
  assert.equal((await(await fetch(new URL('/api/library/list',session.url))).json()).entries.length,0);
  assert.equal((await(await fetch(new URL('/api/board/overview',session.url))).json()).total,0);
 }
 const create=cli(['resume','create','--title','本机验证简历','--json']);assert.equal(create.status,0,create.stderr);
 const resumes=await import(pathToFileURL(path.join(coreRoot,'dist/resumes/store.js')));
 assert.equal((await resumes.library(second.path)).entries.length,0);
 const response=await fetch(new URL('/api/library/list',a.url));assert.equal(response.status,200);assert.equal((await response.json()).entries.length,1);
 // Inspect the real rendered entry and workbench; no network or system runtime is required.
 await win.loadURL(a.url);await win.webContents.executeJavaScript('document.fonts.ready');
 const stateInWindow=await win.webContents.executeJavaScript(`({node:typeof require,bridge:typeof window.careerDesktop?.handoff,title:document.querySelector('h1')?.textContent})`);
 assert.equal(stateInWindow.node,'undefined');assert.equal(stateInWindow.bridge,'function');assert.equal(stateInWindow.title,'求职看板');
 // Only write through the scoped bridge; no renderer clipboard read permission.
 const copyValue='合成复制字段\n第二行 · AI';
 await js(`window.careerDesktop.copyText(${JSON.stringify(copyValue)})`);
 assert.equal(await require('electron').clipboard.readText(),copyValue);
 await assert.rejects(js(`window.careerDesktop.copyText({invalid:true})`),/复制内容无效/);
 assert.equal(await require('electron').clipboard.readText(),copyValue);
 assert.equal(await win.webContents.executeJavaScript(`document.getElementById('toggle-sidebar').getAttribute('aria-expanded')`),'true');
 await js(`document.getElementById('toggle-sidebar').click()`);await win.loadURL(win.webContents.getURL());
 await waitFor(`document.getElementById('toggle-sidebar')?.getAttribute('aria-expanded')==='false'`);
 await js(`document.getElementById('toggle-sidebar').click()`);
 await js(`document.getElementById('open-settings').click()`);
 await waitFor(`document.querySelector('[data-section="updates"]')&&!document.querySelector('[data-section="workspace"]').disabled`);
 await js(`document.querySelector('[data-section="updates"]').click()`);
 await waitFor(`document.querySelector('#updates-content .updates-version')`);
 assert.equal(await js(`document.querySelector('#updates-content .updates-version').textContent`),'v'+app.getVersion());
 // Exercise the real renderer notification transport with an inert release fixture.
 // No remote lookup, claimed update, or installer is created by this display check.
 win.webContents.send('career:updates',{...await js('window.careerDesktop.updatesState()'),latest:{version:'0.4.0',tag:'desktop-v0.4.0',name:'synthetic',notes:'新增更新入口\n<img src=x onerror="window.updateInjected=true">',size:150000000}});
 await waitFor(`document.getElementById('open-settings').classList.contains('has-update')&&document.querySelector('[data-update-action="download"]')`);
 assert.equal(await js(`!!window.updateInjected||!!document.querySelector('.updates-notes img')`),false);
 await capture('updates-available');
 // A rate-limited API can still expose a dated public manifest. The check button
 // cools down without disabling an already verified download.
 const retryAt=Date.now()+120000;
 const limited={...await js('window.careerDesktop.updatesState()'),error:'GitHub 公开版本接口暂时限流，将按服务端要求等待后再检查。',retryAt,nextCheckAt:retryAt,publicVersion:'0.3.0-alpha.1',publicChecked:Date.now()};
 win.webContents.send('career:updates',limited);
 await waitFor(`document.querySelector('.updates-public')&&document.querySelector('[data-update-action="check"]').disabled`);
 assert.match(await js(`document.querySelector('.updates-status-line strong').textContent`),/已核对官网/);
 assert.match(await js(`document.querySelector('.updates-public').textContent`),/官网公开版 v0.3.0-alpha.1/);
 assert.doesNotMatch(await js(`document.querySelector('.updates-status-line strong').textContent`),/最新版|暂无可用更新/);
 await capture('updates-rate-limit');
 win.webContents.send('career:updates',{...limited,latest:{version:'0.4.0',tag:'desktop-v0.4.0',name:'synthetic',notes:'合成官网版本',size:null}});
 await waitFor(`document.querySelector('[data-update-action="download"]')`);
 assert.equal(await js(`document.querySelector('[data-update-action="download"]').disabled`),false);
 assert.doesNotMatch(await js(`document.querySelector('.updates-download').textContent`),/0 MB|NaN/);
 win.webContents.send('career:updates',{...limited,nextCheckAt:Date.now()+100});
 await waitFor(`!document.querySelector('[data-update-action="check"]').disabled`);
 win.webContents.send('career:updates',await js('window.careerDesktop.updatesState()'));
 await waitFor(`!document.getElementById('open-settings').classList.contains('has-update')`);
 await js(`document.getElementById('settings-close').click()`);
 // QCC: real packaged IPC and OS encryption with a synthetic key. No account/network calls.
 await js(`document.getElementById('open-settings').click()`);
 await waitFor(`document.querySelector('[data-section="integrations"]')&&!document.querySelector('[data-section="integrations"]').disabled`);
 await js(`document.querySelector('[data-section="integrations"]').click()`);
 await waitFor(`document.getElementById('company-key')`);
 assert.equal(await js(`document.getElementById('company-key').type`),'password');
 assert.equal((await js(`window.careerDesktop.companyStatus()`)).configured,false);
 await capture('qcc-settings');
 const {safeStorage}=require('electron');assert.equal(safeStorage.isEncryptionAvailable(),true);
 const qccFile=path.join(app.getPath('userData'),'integrations/qcc.json');await fs.mkdir(path.dirname(qccFile),{recursive:true});
 const syntheticKey='desktop-smoke-key-not-real';
 await fs.writeFile(qccFile,JSON.stringify({schema:'career-qcc-credential/v1',ciphertext:safeStorage.encryptString(syntheticKey).toString('base64'),saved_at:new Date().toISOString()}),{mode:0o600});
 assert.ok(!(await fs.readFile(qccFile,'utf8')).includes(syntheticKey));
 assert.equal((await js(`window.careerDesktop.companyStatus()`)).configured,true);
 const companyStatus=cli(['company','status','--json']);assert.equal(companyStatus.status,0,companyStatus.stderr);assert.equal(JSON.parse(companyStatus.stdout).data.configured,true);assert.ok(!companyStatus.stdout.includes(syntheticKey));
 // Exercise decryption through the same desktop service with a stub transport only.
 const companyService=await require('./company.cjs').createCompanyService({app,safeStorage,coreRoot,clientFactory:key=>({run:async request=>{assert.equal(key,syntheticKey);assert.equal(request.action,'check');return {connected:true};}})});
 assert.equal((await companyService.run({action:'check'})).connected,true);
 await js(`document.querySelector('[data-section="integrations"]').click()`);await waitFor(`document.getElementById('company-remove')`);
 await capture('qcc-connected');await js(`document.getElementById('company-remove').click()`);await waitFor(`document.getElementById('company-feedback')?.textContent==='已移除本机连接。'`);
 assert.equal((await js(`window.careerDesktop.companyStatus()`)).configured,false);
 const companyMissing=cli(['company','inspect','--company','合成企业','--json']);assert.equal(companyMissing.status,1);assert.equal(JSON.parse(companyMissing.stderr).errors[0].code,'QCC_NOT_CONFIGURED');
 await js(`document.getElementById('settings-close').click()`);
 await require('./ai-smoke.cjs').run({app,win,workspace:first.path});
 await require('./board-smoke.cjs').run({win,workspace:first.path,url:a.url,coreRoot,capture});
 const h=await win.webContents.executeJavaScript('window.careerDesktop.handoff()');assert.equal(h.path,first.path);
 await fs.writeFile(path.join(app.getPath('userData'),'workbench.png'),(await win.webContents.capturePage()).toPNG());
 const pdf=await printHtml('<!doctype html><meta charset="utf-8"><style>@page{size:A4;margin:20mm}</style><h1>career 简历导出验证</h1><a href="https://example.com/project">项目链接</a>');
 assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1000);await fs.writeFile(path.join(app.getPath('userData'),'print.pdf'),pdf);
 // Export through the bundled CLI too, with no external Chromium installation.
 const existing=(await resumes.library(first.path)).entries[0];
 const draft=await resumes.readResume(first.path,existing.id);
 const {blankExperience}=await import(pathToFileURL(path.join(coreRoot,'dist/resumes/model.js')));
 draft.package.synthetic=true;draft.package.content.profile.name='林序';draft.package.content.profile.headline='AI 应用工程师';
 draft.package.content.sections=[{id:'projects',title:'项目经历',items:[{...blankExperience('project','knowledge'),title:'知识助手',description:'完成合成项目验证。'}]},{id:'skills',title:'核心技能',items:[]},{id:'awards',title:'荣誉与绩效',items:[blankExperience('other','empty-award')]}];
 draft.package.content.common.sections=[{id:'certificates',title:'资格证书',fields:[{label:'证书名称',value:''}]}];
 await resumes.savePackage(first.path,draft.package,draft.sha256);
 const snapshot=await core.collection.buildCollection(first.path);const manifest=JSON.parse(await fs.readFile(path.join(snapshot.directory,'collection.json'),'utf8'));
 const renderedDirectory=path.join(snapshot.directory,'resumes',manifest.entries[0].id);
 for(const name of (await fs.readdir(renderedDirectory)).filter(n=>n.startsWith('.print-'))){
  const markup=await fs.readFile(path.join(renderedDirectory,name),'utf8');
  assert.ok(markup.includes('知识助手'));for(const empty of ['核心技能','荣誉与绩效','资格证书'])assert.ok(!markup.includes(empty),name+': '+empty);
 }
 assert.equal((await resumes.readResume(first.path,existing.id)).package.content.sections.length,3);
 await win.loadURL(new URL('/resumes/'+existing.id+'/index.html',a.url).href);
 await waitFor(`document.getElementById('resume-preview')?.dataset.pagination==='ready'`);
 await capture('resume-empty-sections');
 const exported=cli(['resume','export','--build',path.join(snapshot.directory,'resumes',manifest.entries[0].id),'--format','pdf','--out',path.join(base,'cli.pdf'),'--json']);assert.equal(exported.status,0,exported.stderr);
 assert.equal((await fs.readFile(path.join(base,'cli.pdf'))).subarray(0,5).toString(),'%PDF-');
 await win.loadURL('career-app://desktop/index.html');await win.webContents.executeJavaScript('document.fonts.ready');
 await waitFor(`!document.querySelector('main').hasAttribute('aria-busy')`);
 assert.equal(await js(`document.querySelectorAll('.recent-item').length`),2);
 assert.equal(await js(`document.getElementById('create').hidden`),true);
 await fs.writeFile(path.join(app.getPath('userData'),'welcome.png'),(await win.webContents.capturePage()).toPNG());
 assert.equal((await state()).recent.length,2);
 // Exercise the same startup path with persisted choices and no running sessions.
 // Opening the chooser explicitly must never trigger startup restoration again.
 for(const entry of [second,first]){
  await manager.remember(entry.path);
  await manager.close();
  await openInitialPage();
  assert.equal(new URL(win.webContents.getURL()).pathname,'/board');
  assert.equal((await js('window.careerDesktop.handoff()')).path,entry.path);
  await showWelcome();
  await waitFor(`!document.querySelector('main').hasAttribute('aria-busy')`);
  assert.equal(win.webContents.getURL(),'career-app://desktop/index.html');
  assert.equal(await js(`document.querySelectorAll('.recent-item').length`),2);
 }
 // A moved last workspace falls back to the chooser, without opening a different
 // available workspace or deleting the saved entry.
 await manager.close();
 const moved=first.path+'-moved';await fs.rename(first.path,moved);
 try{
  await openInitialPage();
  await waitFor(`!document.querySelector('main').hasAttribute('aria-busy')`);
  assert.equal(win.webContents.getURL(),'career-app://desktop/index.html');
  assert.equal(await js(`document.querySelectorAll('.recent-item.unavailable').length`),1);
  const registry=await manager.readRegistry();
  assert.equal(registry.last_workspace,first.id);assert.equal(registry.recent.length,2);
 }finally{await fs.rename(moved,first.path);}
 await capture('startup-missing-workspace');
 return {ok:true,workspace:first.path,secondWorkspace:second.path,version:app.getVersion(),electron:process.versions.electron,node:process.versions.node,pdfBytes:pdf.length,checks:['AI encrypted settings and persisted defaults, packaged LangChain invocation through native IPC, reviewed JD import with original text', 'update settings, persisted preferences, badge, inert notes, rate-limit cooldown and dated public-manifest fallback over native IPC','repository restore entry and Git environment bridge','QCC settings IPC, OS-encrypted local key, bundled helper status and missing-key error without Node', 'bundled CLI without system Node/npm','workspace isolation and override rejection','match summary and independent outreach tab with packaged contracts, clipboard and stale input detection','thirteen Skills, preserved line-ending rules and empty initial resume/job libraries without demonstration files','sandboxed renderer and scoped IPC','separate welcome/create/handoff and actual form submission','default expanded sidebar and saved choice','native tray and packaged icons','bundled Chromium PDF + CLI PDF with empty optional sections hidden and source draft preserved','recent workspaces','startup restores the last workspace among multiple libraries; explicit chooser remains available; missing last workspace preserves records and falls back']};
};
