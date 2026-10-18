const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');
exports.createAIService=async({app,safeStorage,coreRoot,clientFactory})=>{
 const client=clientFactory||await import(pathToFileURL(path.join(coreRoot,'dist/ai/client.js')));
 const file=path.join(app.getPath('userData'),'integrations','models.json');
 const available=()=>safeStorage.isEncryptionAvailable()&&safeStorage.getSelectedStorageBackend?.()!=='basic_text';
 const secure=()=>{if(!available())throw new Error('系统安全存储不可用，请解锁钥匙串后重试。');};
 const uses=['text','vision','speech'];
 const supports=(p,use)=>use==='speech'?p.modality==='speech':p.modality!=='speech'&&(use==='text'||p.vision);
 let mutating=false;const requests=new Map();
 // Migration groups only identical credentials. Different legacy keys/regions remain separate.
 function migrate(data){
  const services=[],models=[];
  for(const p of data.providers){
   let s=services.find(s=>s.kind===p.kind&&s.baseURL===p.baseURL&&s.key===p.key);
   if(!s){s={id:p.id.replace(/^model-/, 'service-'),name:p.name,kind:p.kind,baseURL:p.baseURL,key:p.key,speechURL:'',enabled:true};services.push(s);}
   models.push({id:p.id,serviceId:s.id,model:p.model,vision:p.vision,method:p.method,modality:'language',tested:p.tested||{}});
  }
  return {services,models,defaults:{...data.defaults,speech:null}};
 }
 async function read(){
  try{const stat=await fs.lstat(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>256000)throw new Error();secure();const record=JSON.parse(await fs.readFile(file,'utf8'));if(!['career-models/v1','career-models/v2'].includes(record.schema))throw new Error();const data=JSON.parse(safeStorage.decryptString(Buffer.from(record.ciphertext,'base64')));if(!data.defaults)throw new Error();if(record.schema==='career-models/v1'){if(!Array.isArray(data.providers))throw new Error();return migrate(data);}if(!Array.isArray(data.services)||!Array.isArray(data.models))throw new Error();return data;}
  catch(e){if(e.code==='ENOENT')return {services:[],models:[],defaults:{text:null,vision:null,speech:null}};throw new Error('无法解锁本机模型设置，请检查系统安全存储。');}
 }
 const serviceFor=(data,id)=>{const s=data.services.find(s=>s.id===id);if(!s)throw new Error('请先保存服务连接。');return s;};
 const credentialReady=(s,p)=>!!(s.kind==='volcengine'&&p.modality==='speech'?s.speechKey:s.key);
 const expand=(data,p)=>{const service=serviceFor(data,p.serviceId),{key,speechKey,...s}=service;return {...s,...p,name:s.name,credentialReady:credentialReady(service,p)};};
 const publicState=data=>({services:data.services.map(({key,speechKey,...s})=>({...s,hasKey:!!key,hasSpeechKey:!!speechKey})),providers:data.models.map(p=>expand(data,p)),defaults:data.defaults,secure_storage_available:available()});
 async function status(){return publicState(await read());}
 async function write(data){
  secure();const directory=path.dirname(file);await fs.mkdir(directory,{recursive:true,mode:0o700});if((await fs.lstat(directory)).isSymbolicLink())throw new Error('凭据目录不能是符号链接。');
  const temporary=file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temporary,JSON.stringify({schema:'career-models/v2',ciphertext:safeStorage.encryptString(JSON.stringify(data)).toString('base64')}),{flag:'wx',mode:0o600});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}return publicState(data);
 }
 async function mutation(fn){if(mutating)throw new Error('正在保存模型设置，请稍候。');mutating=true;try{return await fn();}finally{mutating=false;}}
 const find=(data,id)=>{const p=data.models.find(p=>p.id===id);if(!p)throw new Error('请先在设置 → 模型与服务中配置模型。');return p;};
 function checkedKey(input){const key=typeof input==='string'?input.trim():'';if(key.length>4096||/[\r\n\x00]/.test(key))throw new Error('API Key 格式无效。');return key;}
 function storeModel(data,input,s){
  const p=client.checkedProvider({...input,name:s.name,kind:s.kind,baseURL:s.baseURL}),old=p.id?find(data,p.id):null;
  if(old&&old.serviceId!==s.id)throw new Error('不能把模型移到另一服务。');
  if(!old&&data.models.length>=48)throw new Error('最多保存 48 个模型。');
  if(data.models.some(m=>m.id!==p.id&&m.serviceId===s.id&&m.model===p.model))throw new Error('这个模型已添加。');
  const record={id:p.id||'model-'+randomUUID(),serviceId:s.id,model:p.model,vision:p.vision,method:p.method,modality:p.modality||'language',tested:{}};
  data.models=old?data.models.map(m=>m.id===old.id?record:m):[...data.models,record];
  for(const use of uses){if(data.defaults[use]===record.id&&!supports(record,use))data.defaults[use]=null;if(s.enabled&&credentialReady(s,record)&&!data.defaults[use]&&supports(record,use))data.defaults[use]=record.id;}
  return record;
 }
 async function serviceSave(input){return mutation(async()=>{
  // Use the same validation module in production and injected test clients.
  const contracts=client.checkedService?client:await import(pathToFileURL(path.resolve(__dirname,'../dist/ai/contracts.js')));
  const value=contracts.checkedService(input),data=await read();
  const old=value.id?serviceFor(data,value.id):null,key=checkedKey(input.key),speechKey=checkedKey(input.speechKey);
  if(old&&old.kind!==value.kind)throw new Error('服务类型不能更改。');
  if(speechKey&&value.kind!=='volcengine')throw new Error('独立语音 Key 仅用于火山语音。');
  if(!(key||old?.key)&&!(value.kind==='volcengine'&&(speechKey||old?.speechKey)))throw new Error(value.kind==='volcengine'?'请至少填写方舟 API Key 或语音 API Key。':'请输入 API Key；无需鉴权的本机接口可填写 local。');
  if(old?.key&&!key&&(old.baseURL!==value.baseURL||(value.kind!=='volcengine'&&old.speechURL!==value.speechURL)))throw new Error('更改服务地址时请重新填写 API Key，避免把旧密钥发送到新地址。');
  if(old?.speechKey&&!speechKey&&old.speechURL!==value.speechURL)throw new Error('更改语音地址时请重新填写语音 API Key。');
  if(!old&&data.services.length>=12)throw new Error('最多保存 12 个服务。');
  const s={...value,id:old?.id||'service-'+randomUUID(),key:key||old?.key||'',...(value.kind==='volcengine'?{speechKey:speechKey||old?.speechKey||''}:{})};
  data.services=old?data.services.map(v=>v.id===s.id?s:v):[...data.services,s];
  if(!old||key||old.baseURL!==s.baseURL||old.speechURL!==s.speechURL)for(const p of data.models)if(p.serviceId===s.id)p.tested={};
  if(!old&&input.models){if(!Array.isArray(input.models)||input.models.length>16)throw new Error('初始模型列表无效。');for(const model of input.models)storeModel(data,{...model,id:''},s);}
  return write(data);
 });}
 async function serviceRemove(id){return mutation(async()=>{const data=await read();serviceFor(data,id);const removed=new Set(data.models.filter(p=>p.serviceId===id).map(p=>p.id));data.models=data.models.filter(p=>!removed.has(p.id));data.services=data.services.filter(s=>s.id!==id);for(const use of uses)if(removed.has(data.defaults[use]))data.defaults[use]=null;return write(data);});}
 async function save(input){return mutation(async()=>{
  const data=await read();let s;
  if(input.serviceId){s=serviceFor(data,input.serviceId);}
  else{
   // Compatibility for existing integrations: convert their model connection into a service.
   const p=client.checkedProvider(input),old=p.id?find(data,p.id):null,key=checkedKey(input.key);
   const reuse=!old&&!key&&input.credentialFrom?serviceFor(data,find(data,input.credentialFrom).serviceId):null;
   if(reuse&&(reuse.kind!==p.kind||reuse.baseURL!==p.baseURL))throw new Error('只能复用同一服务类型和地址的 API Key；请重新填写。');
   if(old){s=serviceFor(data,old.serviceId);if(!key&&s.baseURL!==p.baseURL)throw new Error('更改服务地址时请重新填写 API Key。');}
   else s=reuse||data.services.find(v=>v.kind===p.kind&&v.baseURL===p.baseURL&&v.key===key);
   if(!s&&!key)throw new Error('请输入 API Key；无需鉴权的本机接口可填写 local。');
   if(!s){if(data.services.length>=12)throw new Error('最多保存 12 个服务。');s={id:'service-'+randomUUID(),name:p.name,kind:p.kind,baseURL:p.baseURL,speechURL:'',enabled:true,key};data.services.push(s);}
   else if(old){Object.assign(s,{name:p.name,baseURL:p.baseURL,key:key||s.key});for(const m of data.models)if(m.serviceId===s.id)m.tested={};}
  }
  storeModel(data,input,s);return write(data);
 });}
 async function defaults(input){return mutation(async()=>{const data=await read();for(const use of uses){if(!(use in (input||{})))continue;const id=input[use];if(id!==null&&typeof id!=='string')throw new Error('默认模型设置无效。');if(id){const p=find(data,id);if(!serviceFor(data,p.serviceId).enabled)throw new Error('请先启用这个服务。');if(!supports(p,use))throw new Error('请选择支持此用途的模型。');if(!credentialReady(serviceFor(data,p.serviceId),p))throw new Error(p.modality==='speech'?'请先填写语音 API Key。':'请先填写文本与视觉 API Key。');}data.defaults[use]=id;}return write(data);});}
 async function remove(id){return mutation(async()=>{const data=await read();find(data,id);data.models=data.models.filter(p=>p.id!==id);for(const use of uses)if(data.defaults[use]===id)data.defaults[use]=null;return write(data);});}
 async function task(id,run){if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new Error('请求标识无效。');if(requests.size>=2||requests.has(id))throw new Error('已有模型请求正在处理，请先等待或取消。');const controller=new AbortController();requests.set(id,controller);const timer=setTimeout(()=>controller.abort(),65000);try{return await run(controller.signal);}finally{clearTimeout(timer);requests.delete(id);}}
 function ready(data,id){const p=expand(data,find(data,id)),s=serviceFor(data,p.serviceId);if(!s.enabled)throw new Error('此服务已停用，请在模型设置中启用。');if(!credentialReady(s,p))throw new Error(p.modality==='speech'?'请先填写语音 API Key。':'请先填写文本与视觉 API Key。');if(p.modality==='speech')throw new Error('语音配置已保存；面试辅助接入后可测试实时转写。');return {...p,key:s.key};}
 async function check(input){return task(input.requestId,async signal=>{const data=await read(),p=ready(data,input.id),vision=input.vision===true;const result=await client.testProvider(p,p.key,vision,signal);await mutation(async()=>{const latest=await read(),m=latest.models.find(x=>x.id===p.id);if(m){const current={...expand(latest,m),key:serviceFor(latest,m.serviceId).key};if(JSON.stringify({...current,tested:{}})===JSON.stringify({...p,tested:{}})){m.tested[vision?'vision':'text']=new Date().toISOString();await write(latest);}}});return result;});}
 async function extract(input){const v=client.checkedInput(input),data=await read(),p=ready(data,data.defaults[v.images.length?'vision':'text']);return task(input.requestId,signal=>client.extractJD(p,p.key,v,signal));}
 function cancel(id){requests.get(id)?.abort();return true;}
 function close(){for(const request of requests.values())request.abort();}
 return {status,save,serviceSave,serviceRemove,defaults,remove,check,extract,cancel,close};
};
