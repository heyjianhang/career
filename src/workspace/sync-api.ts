import type {IncomingMessage,ServerResponse} from 'node:http';
import {syncEnvironment,startLogin,loginStatus} from './sync-environment.js';
import {syncOverview,syncPreferences,runSync} from './sync.js';
import {initHistory,connect} from './git.js';
import {SetupError} from './process.js';
export function syncRoutes(workspace:string,token:string){
 return async(req:IncomingMessage,res:ServerResponse,url:URL,origin:string)=>{
  if(!url.pathname.startsWith('/api/sync/'))return false;
  const send=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-career-token']!==token||req.headers['sec-fetch-site']==='cross-site'||!req.headers['content-type']?.startsWith('application/json')){send(403,{error:'请求不属于当前工作台'});return true;}
  try{
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192)throw new Error('请求过大');}const data=JSON.parse(body);
   let result:unknown;
   switch(url.pathname){
    case '/api/sync/status':result=await syncOverview(workspace);break;
    case '/api/sync/environment':result=await syncEnvironment();break;
    case '/api/sync/login':result=await startLogin();break;
    case '/api/sync/login-status':result=loginStatus();break;
    case '/api/sync/preferences':result=await syncPreferences(workspace,data);break;
    case '/api/sync/connect':{
     const init=await initHistory(workspace,data.name,data.email);if(!init.identity_ready)throw new SetupError('GIT_IDENTITY_REQUIRED','请填写版本署名和邮箱，仅保存在这个工作区。');
     result=await connect(workspace,data.repository);break;
    }
    case '/api/sync/identity':result=await initHistory(workspace,data.name,data.email);break;
    case '/api/sync/update':result=await runSync(workspace,'update');break;
    case '/api/sync/run':result=await runSync(workspace);break;
    default:send(404,{error:'无此同步操作'});return true;
   }
   send(200,result);
  }catch(e){const error=e as SetupError;send(error.code==='SYNC_CONFLICT'?409:400,{error:error.message,code:error.code,details:error.details});}return true;
 };
}
