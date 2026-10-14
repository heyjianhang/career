// Private headless helper: Electron's safeStorage is unavailable in RUN_AS_NODE mode.
// The CLI exchanges requests/results over pipes; it never receives the API key.
const {app,safeStorage}=require('electron');
const path=require('node:path');
app.on('window-all-closed',()=>{});
const deadline=setTimeout(()=>app.exit(1),40000);
app.whenReady().then(async()=>{
 try{
  let text='';for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text)>4096)throw new Error('请求过大');}
  const service=await require('./company.cjs').createCompanyService({app,safeStorage,coreRoot:path.join(__dirname,'runtime/node_modules/@heyjianhang/career')});
  const value=await service.run(JSON.parse(text));
  process.stdout.write(JSON.stringify({ok:true,value}),()=>{clearTimeout(deadline);app.exit(0);});
 }catch(e){process.stdout.write(JSON.stringify({ok:false,error:{code:e.code?.startsWith('QCC_')||e.code==='INVALID_ARGUMENT'?e.code:'QCC_DESKTOP',message:e.code?.startsWith('QCC_')||e.code==='INVALID_ARGUMENT'?e.message:'企查查桌面服务不可用，请重新打开 career 后重试。'}}),()=>{clearTimeout(deadline);app.exit(1);});}
});
