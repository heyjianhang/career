const {app,BrowserWindow,Menu,Tray,nativeImage,ipcMain,dialog,clipboard,shell,protocol,net}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {prepareRuntime,handoffPrompt}=require('./runtime.cjs');
const {printHtml}=require('./pdf.cjs');
const welcome='career-app://desktop/index.html';
protocol.registerSchemesAsPrivileged([{scheme:'career-app',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
if(process.env.CAREER_DESKTOP_USER_DATA)app.setPath('userData',path.resolve(process.env.CAREER_DESKTOP_USER_DATA));
const smokeIndex=process.argv.indexOf('--career-smoke');
const smokeOutput=smokeIndex>=0?process.argv[smokeIndex+1]:null;
let win,tray,manager,core,quitting=false,working=false,shutdown;
const assets=path.join(__dirname,'assets');
const coreRoot=path.join(__dirname,'runtime/node_modules/@heyjianhang/career');
const load=relative=>import(pathToFileURL(path.join(coreRoot,'dist',relative)));
const external=url=>{try{const u=new URL(url);return ['https:','http:','mailto:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
const trusted=url=>{try{return url===welcome||manager?.origins.has(new URL(url).origin);}catch{return false;}};
const ipcTrusted=event=>event.sender===win?.webContents&&event.senderFrame===win?.webContents.mainFrame&&trusted(event.senderFrame.url);
async function entryForPage(url=win.webContents.getURL()){
 const origin=new URL(url).origin;
 for(const [directory,pending] of manager.sessions)if((await pending).url===origin)return manager.entry(directory);
 throw new Error('请先打开一个工作区。');
}
async function prepare(directory){
 await core.io.noSymlinks(directory);
 await core.setup.installAgent(directory); // Managed files preserve user edits.
 await core.setup.withLock(directory,()=>prepareRuntime(directory,{executable:process.execPath,appRoot:__dirname,coreRoot,noSymlinks:core.io.noSymlinks}));
}
async function openWorkspace(directory){
 const entry=await manager.entry(directory);
 if(!manager.sessions.has(entry.path)){
  const pending=(async()=>{const built=await core.collection.buildCollection(entry.path);return core.server.startPreview(built.directory,entry.path,0,true,{manager});})();
  manager.sessions.set(entry.path,pending);pending.catch(()=>manager.sessions.delete(entry.path));
 }
 const local=await manager.sessions.get(entry.path);await manager.remember(entry.path);
 return {...entry,url:local.url+'/board',prompt:handoffPrompt(entry.path)};
}
async function state(){
 const registry=await manager.readRegistry();
 return {version:app.getVersion(),platform:process.platform,defaultLocation:app.getPath('documents'),recent:await Promise.all(registry.recent.map(async e=>{try{return await manager.entry(e.path);}catch{return {...e,available:false};}}))};
}
function handle(name,fn){ipcMain.handle('career:'+name,async(event,...args)=>{
 if(!ipcTrusted(event))throw new Error('请求不属于 career 主窗口');
 try{return {ok:true,value:await fn(...args)};}catch(e){return {ok:false,error:e.message};}
});}
async function mutate(fn){if(working)throw new Error('工作区正在准备，请稍候');working=true;try{return await fn();}finally{working=false;}}
function showWindow(){if(win&&!win.isDestroyed()){if(win.isMinimized())win.restore();win.show();win.focus();}}
function showWelcome(){showWindow();void win.loadURL(welcome).catch(e=>{if(e.code!=='ERR_ABORTED')console.error(e);});}
function nativeControls(){
 app.setAboutPanelOptions({applicationName:'career',applicationVersion:app.getVersion(),iconPath:path.join(assets,'icon.png'),copyright:'MIT · heyjianhang'});
 if(process.platform==='darwin'){
  app.dock?.setIcon(path.join(assets,'icon.png'));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
   {label:'career',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
   {label:'工作区',submenu:[{label:'创建或打开工作区',accelerator:'CmdOrCtrl+Shift+O',click:showWelcome},{type:'separator'},{role:'close'}]},
   {label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
   {label:'视图',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'},...(!app.isPackaged?[{role:'toggleDevTools'}]:[])]}
  ]));
 }else{
  // No native menu bar (including Alt-to-reveal) in the Windows window.
  Menu.setApplicationMenu(null);win.removeMenu();
  win.webContents.on('before-input-event',(event,input)=>{
   if(input.type!=='keyDown')return;const key=input.key.toLowerCase();
   if(input.control&&input.shift&&key==='o'){event.preventDefault();showWelcome();}
   else if(key==='f11'){event.preventDefault();win.setFullScreen(!win.isFullScreen());}
   else if(input.control&&!input.alt&&['0','+','=','-'].includes(key)){event.preventDefault();const next=key==='0'?0:win.webContents.getZoomLevel()+(key==='-'?-0.5:0.5);win.webContents.setZoomLevel(Math.max(-2,Math.min(3,next)));}
  });
 }
 let trayIcon=path.join(assets,'tray.ico');
 if(process.platform==='darwin'){
  trayIcon=nativeImage.createFromPath(path.join(assets,'trayTemplate.png'));trayIcon.setTemplateImage(true);
  if(trayIcon.isEmpty())throw new Error('菜单栏图标未加载');
 }
 tray=new Tray(trayIcon);tray.setToolTip('career · 个人求职工作台');
 tray.setContextMenu(Menu.buildFromTemplate([
  {label:'显示 career',click:showWindow},
  {label:'隐藏窗口',click:()=>win.hide()},
  {type:'separator'},
  {label:'创建或打开工作区',click:showWelcome},
  {type:'separator'},
  {label:'退出 career',click:()=>app.quit()}
 ]));
 if(process.platform!=='darwin'){tray.on('click',showWindow);tray.on('double-click',showWindow);}
}
function setupIPC(){
 handle('state',state);
 handle('chooseDirectory',async(defaultPath)=>{const result=await dialog.showOpenDialog(win,{title:'选择资料文件夹',defaultPath:typeof defaultPath==='string'?defaultPath:app.getPath('documents'),properties:['openDirectory','createDirectory']});return result.canceled?null:result.filePaths[0];});
 handle('createWorkspace',data=>mutate(async()=>{const entry=await manager.create(data.parent,data.name);return openWorkspace(entry.path);}));
 handle('openWorkspace',directory=>mutate(()=>openWorkspace(directory)));
 handle('handoff',async()=>{const e=await entryForPage();return {...e,prompt:handoffPrompt(e.path)};});
 handle('copyPrompt',async directory=>{const e=await manager.entry(directory);if(!(await manager.readRegistry()).recent.some(r=>r.id===e.id))throw new Error('工作区尚未打开');clipboard.writeText(handoffPrompt(e.path));return true;});
 handle('reveal',async directory=>{const e=await manager.entry(directory);if(!(await manager.readRegistry()).recent.some(r=>r.id===e.id))throw new Error('工作区尚未打开');const error=await shell.openPath(e.path);if(error)throw new Error(error);});
 handle('navigate',async url=>{if(!trusted(url))throw new Error('无效工作区地址');await win.loadURL(url);});
}
async function createWindow(){
 win=new BrowserWindow({title:'career',width:1240,height:850,minWidth:720,minHeight:560,icon:path.join(assets,'icon.png'),backgroundColor:'#f5f6f0',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.webContents.session.setPermissionRequestHandler((_wc,_permission,done)=>done(false));
 win.webContents.session.setPermissionCheckHandler(()=>false);
 win.webContents.on('will-attach-webview',e=>e.preventDefault());
 win.webContents.setWindowOpenHandler(({url})=>{if(external(url)&&!trusted(url))void shell.openExternal(url);return {action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(!trusted(url)){event.preventDefault();if(external(url))void shell.openExternal(url);}});
 win.webContents.on('will-redirect',(event,url)=>{if(!trusted(url))event.preventDefault();});
 win.webContents.on('will-prevent-unload',()=>{dialog.showMessageBoxSync(win,{type:'info',message:'请先保存当前简历的修改',detail:'保存后再关闭窗口或切换工作区。',buttons:['返回编辑']});});
 win.webContents.on('did-navigate',()=>{void entryForPage().then(e=>{win.setTitle(e.name+' · career');}).catch(()=>win.setTitle('career'));});
 win.webContents.session.on('will-download',(_event,item)=>{item.setSaveDialogOptions({defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))});});
 nativeControls();
 await win.loadURL(welcome);if(!smokeOutput)win.show();
}
async function start(){
 core={setup:await load('workspace/setup.js'),local:await load('workspace/local.js'),io:await load('presentation/io.js'),collection:await load('presentation/collection.js'),server:await load('presentation/server.js')};
 manager=new core.local.WorkspaceManager(path.join(app.getPath('userData'),'workspaces.json'));manager.prepare=prepare;
 (await load('presentation/pdf.js')).setPdfRenderer(printHtml);
 protocol.handle('career-app',request=>{
  const url=new URL(request.url);const files={'/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/icon.svg':'icon.svg'};
  const file=url.host==='desktop'?files[url.pathname]:null;
  if(!file)return new Response('Not found',{status:404});
  return net.fetch(pathToFileURL(path.join(__dirname,file)).toString());
 });
 setupIPC();await createWindow();
 if(smokeOutput){
  try{const report=await require('./smoke.cjs').run({app,win,tray,manager,core,coreRoot,openWorkspace,printHtml,state});await fs.writeFile(smokeOutput,JSON.stringify(report,null,2));app.quit();}
  catch(e){await fs.writeFile(smokeOutput,JSON.stringify({ok:false,error:e.stack}));app.exit(1);}
 }
}
if(process.argv.includes('--career-print'))require('./pdf-worker.cjs');
else if(!app.requestSingleInstanceLock())app.quit();
else {
 if(process.platform==='win32')app.setAppUserModelId('top.heyjianhang.career');
 app.on('second-instance',showWindow);app.on('activate',showWindow);
 app.whenReady().then(start).catch(e=>{console.error(e);if(smokeOutput)void fs.writeFile(smokeOutput,JSON.stringify({ok:false,error:e.stack})).finally(()=>app.exit(1));else{dialog.showErrorBox('career 启动失败',e.message);app.quit();}});
 const stop=()=>{shutdown??=(async()=>{try{await manager?.close();}catch(e){console.error(e);}finally{tray?.destroy();quitting=true;app.quit();}})();};
 app.on('window-all-closed',stop);
 // Close the window first so its unsaved-edit guard can cancel. Drain services while
 // Electron's normal event loop is still running, before entering the quit sequence.
 app.on('before-quit',event=>{if(quitting)return;event.preventDefault();if(win&&!win.isDestroyed())win.close();else stop();});
}
