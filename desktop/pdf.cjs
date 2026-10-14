const {BrowserWindow,session}=require('electron');
const {randomUUID}=require('node:crypto');
async function printHtml(html) {
 const ses=session.fromPartition('career-print-'+randomUUID());
 ses.setPermissionRequestHandler((_wc,_permission,done)=>done(false));
 const documentURL='career-app://print/index.html';
 ses.protocol.handle('career-app',request=>request.url===documentURL?new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}}):new Response('Not found',{status:404}));
 ses.webRequest.onBeforeRequest((details,done)=>done({cancel:details.url!==documentURL&&!details.url.startsWith('data:')&&!details.url.startsWith('about:')}));
 const win=new BrowserWindow({show:false,width:1280,height:900,webPreferences:{session:ses,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 try{
   await win.loadURL(documentURL);
   await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const end=Date.now()+60000;const poll=()=>{const d=document.documentElement.dataset;if(!d.pagination||['ready','error'].includes(d.pagination)){if(d.paginationError)return reject(new Error(d.paginationError));return Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.decode())]).then(()=>resolve(true),reject);}if(Date.now()>end)return reject(new Error('分页超时'));setTimeout(poll,50);};poll();})`);
   return await win.webContents.printToPDF({pageSize:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
 }finally{win.destroy();await ses.clearStorageData();}
}
module.exports={printHtml};
