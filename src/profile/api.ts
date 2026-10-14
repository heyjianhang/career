import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {inventory,materialPath,readMaterial} from './store.js';
import {profileHtml} from './page.js';
const mime:Record<string,string>={'.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};
export async function profileRequest(req:IncomingMessage,res:ServerResponse,url:URL,workspace:string){
 if(url.pathname!=='/profile'&&!url.pathname.startsWith('/api/profile/'))return false;
 const send=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 if(req.headers['sec-fetch-site']==='cross-site'){send(403,{error:'仅接受当前本机页面请求'});return true;}
 try{
  if(req.method!=='GET'){send(405,{error:'资料页目前仅供阅读，请由 Agent 更新原文件'});return true;}
  if(url.pathname==='/profile'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; font-src data:; connect-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(await profileHtml());return true;
  }
  if(url.pathname==='/api/profile/index'){send(200,await inventory(workspace));return true;}
  if(url.pathname==='/api/profile/file'){
   const p=url.searchParams.get('path')??'',{full,info}=await materialPath(workspace,p),ext=path.extname(p).toLowerCase();
   if(!url.searchParams.has('download')&&/\.(md|txt|csv|json|ya?ml)$/.test(ext)){
    send(200,await readMaterial(workspace,p));return true;
   }
   const bytes=await readFile(full);res.writeHead(200,{'Content-Type':mime[ext]??'application/octet-stream','Content-Length':info.size,'Content-Disposition':`${url.searchParams.has('download')||!mime[ext]?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(path.basename(p))}`,'Content-Security-Policy':"default-src 'none'; sandbox; frame-ancestors 'self'",'Cross-Origin-Resource-Policy':'same-origin'});res.end(bytes);return true;
  }
  send(404,{error:'没有这份资料'});
 }catch(e){send(400,{error:(e as Error).message});}return true;
}
