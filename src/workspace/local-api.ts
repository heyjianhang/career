import type {IncomingMessage,ServerResponse} from 'node:http';
import {WorkspaceManager,revealFolder} from './local.js';
export function workspaceRoutes(workspace:string,manager:WorkspaceManager,token:string,open:(directory:string)=>Promise<string>){
 let busy=false;
 return async(req:IncomingMessage,res:ServerResponse,url:URL,origin:string)=>{
  if(!url.pathname.startsWith('/api/workspaces/'))return false;
  const send=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  if(req.headers['sec-fetch-site']==='cross-site'){send(403,{error:'仅接受当前工作台请求'});return true;}
  try{
   if(req.method==='GET'&&url.pathname==='/api/workspaces/session'){send(200,{token,...await manager.list(workspace)});return true;}
   if(req.method!=='POST'){send(405,{error:'不支持的操作'});return true;}
   if(req.headers.origin!==origin||req.headers['x-career-token']!==token||!req.headers['content-type']?.startsWith('application/json')){send(403,{error:'请求不属于当前工作台'});return true;}
   let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)throw new Error('请求过大');}const data=JSON.parse(text);
   if(url.pathname.endsWith('/browse')){send(200,await manager.browse(data.path));return true;}
   if(busy){send(409,{error:'正在处理工作区，请稍候'});return true;}busy=true;
   try{
    switch(url.pathname){
     case '/api/workspaces/remember':await manager.remember(workspace);send(200,await manager.list(workspace));break;
     case '/api/workspaces/create':{const entry=await manager.create(data.parent,data.name);send(200,{...entry,url:await open(entry.path)});break;}
     case '/api/workspaces/open':{
      if(data.replaceId&&!(await manager.readRegistry()).recent.some(e=>e.id===data.replaceId))throw new Error('找不到原工作区记录');
      const entry=await manager.entry(data.path),target=await open(entry.path);await manager.remember(entry.path,data.replaceId);send(200,{...entry,url:target});break;
     }
     case '/api/workspaces/rename':await manager.renameWorkspace(workspace,data.name,data.previous);send(200,await manager.list(workspace));break;
     case '/api/workspaces/reveal':await revealFolder(workspace);send(200,{ok:true});break;
     default:send(404,{error:'无此操作'});
    }
   }finally{busy=false;}
  }catch(e){send(400,{error:(e as Error).message});}return true;
 };
}
