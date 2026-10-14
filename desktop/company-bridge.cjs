const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {readJson,writeJson,REQUEST_LIMIT,RESPONSE_LIMIT,failure}=require('./company-transport.cjs');

// Options are for isolated protocol tests, never accepted from CLI requests.
function createCompanyBridge({executable=process.execPath,args=[__dirname,'--career-company'],tempRoot=os.tmpdir(),timeoutMs=45000,environment=process.env}={}){
 return async request=>{
  const directory=await fs.mkdtemp(path.join(tempRoot,'career-company-'));
  try{
   await writeJson(path.join(directory,'request.json'),request,REQUEST_LIMIT);
   const env={...environment};delete env.ELECTRON_RUN_AS_NODE;delete env.QCC_API_KEY;
   const code=await new Promise((resolve,reject)=>{
    const child=spawn(executable,[...args,directory],{env,stdio:'ignore',windowsHide:true});
    let expired=false;
    const timer=setTimeout(()=>{expired=true;child.kill();},timeoutMs);
    child.once('error',()=>{clearTimeout(timer);reject(failure('QCC_DESKTOP','无法启动企查查桌面服务，请在 career 中重新打开工作区。'));});
    // Wait for process/handle closure before reading and cleaning up its files.
    child.once('close',code=>{clearTimeout(timer);expired?reject(failure('QCC_TIMEOUT','企查查桌面服务超时；未自动重试。')):resolve(code);});
   });
   let result;
   try{result=await readJson(path.join(directory,'response.json'),RESPONSE_LIMIT);}
   catch(e){if(e.code==='QCC_RESPONSE_TOO_LARGE')throw e;throw failure('QCC_DESKTOP','企查查桌面服务未返回有效结果。');}
   if(result?.ok===true&&code===0)return result.value;
   if(result?.ok===false&&typeof result.error?.message==='string'&&/^(QCC_[A-Z_]+|INVALID_ARGUMENT)$/.test(result.error?.code))throw failure(result.error.code,result.error.message);
   throw failure('QCC_DESKTOP','企查查桌面服务返回失败。');
  }finally{await fs.rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
 };
}
exports.createCompanyBridge=createCompanyBridge;
exports.companyRequest=createCompanyBridge();
