// File transport avoids Windows GUI stdin/stdout. Credentials never cross this boundary.
const fs=require('node:fs/promises');
const REQUEST_LIMIT=4096,RESPONSE_LIMIT=3*1024*1024;
const failure=(code,message)=>Object.assign(new Error(message),{code});
async function readJson(file,limit){
 const stat=await fs.lstat(file);
 if(!stat.isFile()||stat.isSymbolicLink())throw failure('QCC_DESKTOP','企查查桌面服务返回了无效文件。');
 if(stat.size>limit)throw failure('QCC_RESPONSE_TOO_LARGE','企查查响应过大。');
 const bytes=await fs.readFile(file);
 if(bytes.length>limit)throw failure('QCC_RESPONSE_TOO_LARGE','企查查响应过大。');
 return JSON.parse(bytes.toString('utf8'));
}
async function writeJson(file,value,limit){
 const bytes=Buffer.from(JSON.stringify(value));
 if(bytes.length>limit)throw failure('QCC_RESPONSE_TOO_LARGE','企查查响应过大。');
 await fs.writeFile(file,bytes,{flag:'wx',mode:0o600});
}
module.exports={readJson,writeJson,REQUEST_LIMIT,RESPONSE_LIMIT,failure};
