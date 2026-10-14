const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');

// API keys stay outside workspaces and renderer storage. Only ciphertext reaches disk.
exports.createCompanyService=async({app,safeStorage,coreRoot,clientFactory})=>{
 const qcc=await import(pathToFileURL(path.join(coreRoot,'dist/integrations/qcc.js')));
 const file=path.join(app.getPath('userData'),'integrations','qcc.json');
 const error=(code,message)=>{throw new qcc.CompanyError(code,message);};
 const available=()=>safeStorage.isEncryptionAvailable()&&safeStorage.getSelectedStorageBackend?.()!=='basic_text';
 const requireEncryption=()=>{if(!available())error('QCC_STORAGE','系统安全存储不可用，请解锁系统钥匙串后重试。');};
 async function record(){
  try{const stat=await fs.lstat(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>16384)throw new Error();const value=JSON.parse(await fs.readFile(file,'utf8'));if(value.schema!=='career-qcc-credential/v1'||typeof value.ciphertext!=='string')throw new Error();return value;}
  catch(e){if(e.code==='ENOENT')return null;error('QCC_STORAGE','无法读取本机企查查配置，请在设置中重新保存。');}
 }
 async function key(){requireEncryption();const data=await record();if(!data)error('QCC_NOT_CONFIGURED','尚未配置企查查，请到设置 → 外部服务填写 API Key。');try{return qcc.normalizeKey(safeStorage.decryptString(Buffer.from(data.ciphertext,'base64')));}catch{error('QCC_STORAGE','无法解锁企查查凭据，请在本机设置中重新保存。');}}
 const client=value=>clientFactory?clientFactory(value):qcc.createQccClient(value);
 async function status(){const data=await record();return {...qcc.connectionStatus(Boolean(data),data?'system-encrypted':'none'),secure_storage_available:available(),saved_at:data?.saved_at??null};}
 async function save(value){
  const normalized=qcc.normalizeKey(value);requireEncryption();
  const checked=await client(normalized).run({action:'check'}); // Failed replacement preserves the old working key.
  const directory=path.dirname(file);await fs.mkdir(directory,{recursive:true,mode:0o700});
  if((await fs.lstat(directory)).isSymbolicLink())error('QCC_STORAGE','凭据目录不能是符号链接。');
  const temporary=file+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(temporary,JSON.stringify({schema:'career-qcc-credential/v1',ciphertext:safeStorage.encryptString(normalized).toString('base64'),saved_at:new Date().toISOString()}),{mode:0o600,flag:'wx'});await fs.rename(temporary,file);}
  catch{error('QCC_STORAGE','无法保存本机企查查凭据。');}finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
  return {...await status(),check:checked};
 }
 async function remove(){await fs.rm(file,{force:true});return status();}
 async function run(input){const request=qcc.validateRequest(input);if(request.action==='status')return status();return client(await key()).run(request);}
 return {status,save,remove,run};
};
