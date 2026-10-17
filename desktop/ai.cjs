const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');
exports.createAIService=async({app,safeStorage,coreRoot,clientFactory})=>{
 const client=clientFactory||await import(pathToFileURL(path.join(coreRoot,'dist/ai/client.js')));
 const file=path.join(app.getPath('userData'),'integrations','models.json');
 const available=()=>safeStorage.isEncryptionAvailable()&&safeStorage.getSelectedStorageBackend?.()!=='basic_text';
 const secure=()=>{if(!available())throw new Error('系统安全存储不可用，请解锁钥匙串后重试。');};
 let mutating=false;const requests=new Map();
 async function read(){
  try{const stat=await fs.lstat(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>128000)throw new Error();secure();const record=JSON.parse(await fs.readFile(file,'utf8'));if(record.schema!=='career-models/v1')throw new Error();const data=JSON.parse(safeStorage.decryptString(Buffer.from(record.ciphertext,'base64')));if(!Array.isArray(data.providers)||!data.defaults)throw new Error();return data;}
  catch(e){if(e.code==='ENOENT')return {providers:[],defaults:{text:null,vision:null}};throw new Error('无法解锁本机模型设置，请检查系统安全存储。');}
 }
 const publicState=data=>({providers:data.providers.map(({key,...p})=>p),defaults:data.defaults,secure_storage_available:available()});
 async function status(){return publicState(await read());}
 async function write(data){
  secure();const directory=path.dirname(file);await fs.mkdir(directory,{recursive:true,mode:0o700});if((await fs.lstat(directory)).isSymbolicLink())throw new Error('凭据目录不能是符号链接。');
  const temporary=file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temporary,JSON.stringify({schema:'career-models/v1',ciphertext:safeStorage.encryptString(JSON.stringify(data)).toString('base64')}),{flag:'wx',mode:0o600});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}return publicState(data);
 }
 async function mutation(fn){if(mutating)throw new Error('正在保存模型设置，请稍候。');mutating=true;try{return await fn();}finally{mutating=false;}}
 const find=(data,id)=>{const p=data.providers.find(p=>p.id===id);if(!p)throw new Error('请先在设置 → 模型与服务中配置模型。');return p;};
 async function save(input){return mutation(async()=>{
  const p=client.checkedProvider(input),data=await read(),old=p.id?find(data,p.id):undefined;
  const key=typeof input.key==='string'?input.key.trim():'';
  if(key.length>4096||/[\r\n\x00]/.test(key))throw new Error('API Key 格式无效。');
  const reuse=!old&&!key&&input.credentialFrom?find(data,input.credentialFrom):null;
  if(reuse&&(reuse.kind!==p.kind||reuse.baseURL!==p.baseURL))throw new Error('只能复用同一服务类型和地址的 API Key；请重新填写。');
  if(!key&&!old&&!reuse)throw new Error('请输入 API Key；无需鉴权的本机接口可填写 local。');
  if(old&&!key&&old.baseURL!==p.baseURL)throw new Error('更改服务地址时请重新填写 API Key，避免把旧密钥发送到新地址。');
  if(!old&&data.providers.length>=12)throw new Error('最多保存 12 个模型连接。');
  p.id||= 'model-'+randomUUID();
  const record={...p,key:key||old?.key||reuse.key,tested:{}};
  data.providers=old?data.providers.map(x=>x.id===p.id?record:x):[...data.providers,record];
  data.defaults.text||=p.id;if(p.vision)data.defaults.vision||=p.id;else if(data.defaults.vision===p.id)data.defaults.vision=null;
  return write(data);
 });}
 async function defaults(input){return mutation(async()=>{const data=await read();for(const use of ['text','vision']){const id=input?.[use];if(id!==null&&typeof id!=='string')throw new Error('默认模型设置无效。');if(id){const p=find(data,id);if(use==='vision'&&!p.vision)throw new Error('图片识别需要支持图片的模型。');}data.defaults[use]=id;}return write(data);});}
 async function remove(id){return mutation(async()=>{const data=await read();find(data,id);data.providers=data.providers.filter(p=>p.id!==id);for(const use of ['text','vision'])if(data.defaults[use]===id)data.defaults[use]=null;return write(data);});}
 async function task(id,run){if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new Error('请求标识无效。');if(requests.size>=2||requests.has(id))throw new Error('已有模型请求正在处理，请先等待或取消。');const controller=new AbortController();requests.set(id,controller);const timer=setTimeout(()=>controller.abort(),65000);try{return await run(controller.signal);}finally{clearTimeout(timer);requests.delete(id);}}
 async function check(input){return task(input.requestId,async signal=>{const data=await read(),p=find(data,input.id),vision=input.vision===true;const result=await client.testProvider(p,p.key,vision,signal);await mutation(async()=>{const latest=await read(),current=latest.providers.find(x=>x.id===p.id);if(current&&JSON.stringify({...current,tested:{}})===JSON.stringify({...p,tested:{}})){current.tested[vision?'vision':'text']=new Date().toISOString();await write(latest);}});return result;});}
 async function extract(input){const v=client.checkedInput(input);const data=await read(),p=find(data,data.defaults[v.images.length?'vision':'text']);return task(input.requestId,signal=>client.extractJD(p,p.key,v,signal));}
 function cancel(id){requests.get(id)?.abort();return true;}
 function close(){for(const request of requests.values())request.abort();}
 return {status,save,defaults,remove,check,extract,cancel,close};
};
