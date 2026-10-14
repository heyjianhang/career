const {spawn}=require('node:child_process');
exports.companyRequest=request=>new Promise((resolve,reject)=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.QCC_API_KEY;
 const child=spawn(process.execPath,[__dirname,'--career-company'],{env,stdio:['pipe','pipe','ignore'],windowsHide:true});
 let text='',settled=false;
 const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timeout);error?reject(error):resolve(value);};
 const timeout=setTimeout(()=>{child.kill();finish(Object.assign(new Error('企查查桌面服务超时；未自动重试。'),{code:'QCC_TIMEOUT'}));},45000);
 child.stdout.on('data',chunk=>{text+=chunk;if(Buffer.byteLength(text)>3*1024*1024){child.kill();finish(Object.assign(new Error('企查查响应过大。'),{code:'QCC_RESPONSE_TOO_LARGE'}));}});
 child.on('error',()=>finish(Object.assign(new Error('无法启动企查查桌面服务，请在 career 中重新打开工作区。'),{code:'QCC_DESKTOP'})));
 child.stdin.on('error',()=>{});
 child.on('exit',code=>{
  try{const result=JSON.parse(text);if(result.ok&&code===0)finish(null,result.value);else finish(Object.assign(new Error(result.error?.message??'企查查桌面服务返回失败。'),{code:result.error?.code??'QCC_DESKTOP'}));}
  catch{finish(Object.assign(new Error('企查查桌面服务未返回有效结果。'),{code:'QCC_DESKTOP'}));}
 });
 child.stdin.end(JSON.stringify(request));
});
