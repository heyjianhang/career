// Private headless helper: Electron's safeStorage is unavailable in RUN_AS_NODE mode.
// Only requests/results cross the temporary-file boundary; the API key stays here.
const {app,safeStorage}=require('electron');
const path=require('node:path');
const {readJson,writeJson,REQUEST_LIMIT,RESPONSE_LIMIT}=require('./company-transport.cjs');
app.on('window-all-closed',()=>{});
const deadline=setTimeout(()=>app.exit(1),40000);
app.whenReady().then(async()=>{
 const directory=process.argv[process.argv.indexOf('--career-company')+1];
 if(!directory||!path.isAbsolute(directory)){clearTimeout(deadline);app.exit(1);return;}
 let result,exitCode=0;
 try{
  const request=await readJson(path.join(directory,'request.json'),REQUEST_LIMIT);
  const service=await require('./company.cjs').createCompanyService({app,safeStorage,coreRoot:path.join(__dirname,'runtime/node_modules/@heyjianhang/career')});
  const value=await service.run(request);result={ok:true,value};
  // Bound serialized responses before writing. Return the same coded error on overflow.
  if(Buffer.byteLength(JSON.stringify(result))>RESPONSE_LIMIT)throw Object.assign(new Error('企查查响应过大。'),{code:'QCC_RESPONSE_TOO_LARGE'});
 }catch(e){
  exitCode=1;const known=/^(QCC_[A-Z_]+|INVALID_ARGUMENT)$/.test(e.code);
  result={ok:false,error:{code:known?e.code:'QCC_DESKTOP',message:known?e.message:'企查查桌面服务不可用，请重新打开 career 后重试。'}};
 }
 try{await writeJson(path.join(directory,'response.json'),result,RESPONSE_LIMIT);}catch{exitCode=1;}
 clearTimeout(deadline);app.exit(exitCode);
});
