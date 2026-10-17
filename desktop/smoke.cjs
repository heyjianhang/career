// Explicit synthetic smoke mode; no existing user workspaces are opened.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
exports.run=async({app,win,tray,manager,core,coreRoot,openWorkspace,printHtml,state})=>{
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
 for(const icon of ['icon.png','icon.ico','icon.icns','tray.ico','trayTemplate.png','trayTemplate@2x.png'])await fs.access(path.join(__dirname,'assets',icon));
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
 for(const skill of ['career-setup','career-git','career-intake','career-employment','career-project','resume-master','resume-tailor','career-board'])await fs.access(path.join(first.path,'.agents/skills',skill,'SKILL.md'));
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
 const h=await win.webContents.executeJavaScript('window.careerDesktop.handoff()');assert.equal(h.path,first.path);
 await fs.writeFile(path.join(app.getPath('userData'),'workbench.png'),(await win.webContents.capturePage()).toPNG());
 const pdf=await printHtml('<!doctype html><meta charset="utf-8"><style>@page{size:A4;margin:20mm}</style><h1>career 简历导出验证</h1><a href="https://example.com/project">项目链接</a>');
 assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1000);await fs.writeFile(path.join(app.getPath('userData'),'print.pdf'),pdf);
 // Export through the bundled CLI too, with no external Chromium installation.
 const snapshot=await core.collection.buildCollection(first.path);const manifest=JSON.parse(await fs.readFile(path.join(snapshot.directory,'collection.json'),'utf8'));
 const exported=cli(['resume','export','--build',path.join(snapshot.directory,'resumes',manifest.entries[0].id),'--format','pdf','--out',path.join(base,'cli.pdf'),'--json']);assert.equal(exported.status,0,exported.stderr);
 assert.equal((await fs.readFile(path.join(base,'cli.pdf'))).subarray(0,5).toString(),'%PDF-');
 await win.loadURL('career-app://desktop/index.html');await win.webContents.executeJavaScript('document.fonts.ready');
 await waitFor(`!document.querySelector('main').hasAttribute('aria-busy')`);
 assert.equal(await js(`document.querySelectorAll('.recent-item').length`),2);
 assert.equal(await js(`document.getElementById('create').hidden`),true);
 await fs.writeFile(path.join(app.getPath('userData'),'welcome.png'),(await win.webContents.capturePage()).toPNG());
 assert.equal((await state()).recent.length,2);
 return {ok:true,workspace:first.path,secondWorkspace:second.path,version:app.getVersion(),electron:process.versions.electron,node:process.versions.node,pdfBytes:pdf.length,checks:['update settings on welcome and workbench, preference persistence, badge and inert release notes over native IPC','repository restore entry and Git environment bridge','QCC settings IPC, OS-encrypted local key, bundled helper status and missing-key error without Node', 'bundled CLI without system Node/npm','workspace isolation and override rejection','eight Skills and empty initial resume/job libraries without demonstration files','sandboxed renderer and scoped IPC','separate welcome/create/handoff and actual form submission','default expanded sidebar and saved choice','native tray and packaged icons','bundled Chromium PDF + CLI PDF','recent workspaces']};
};
