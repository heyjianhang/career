import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import * as store from '../opportunities/store.js';
import {noSymlinks} from '../presentation/io.js';
import {CommandError} from '../agent-api.js';
import {renderMarkdown} from './markdown.js';
import {boardHtml} from './page.js';
import {preferences,savePreferences} from './preferences.js';
import {workspaceCommand} from '../workspace/command.js';

export const primaryDocuments=[{id:'overview',label:'岗位概况',path:'card.md'},{id:'company',label:'公司分析',path:'analysis/company.md'},{id:'match',label:'岗位匹配',path:'analysis/match.md'}];
const mime:Record<string,string>={'.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};
export async function boardRequest(req:IncomingMessage,res:ServerResponse,url:URL,workspace:string,origin:string,token:string):Promise<boolean> {
  const route=url.pathname;
  if(route!=='/board'&&!route.startsWith('/api/board/')&&!route.startsWith('/board-assets/'))return false;
  const send=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  if(req.headers['sec-fetch-site']==='cross-site'){send(403,{error:'仅接受当前本机页面请求'});return true;}
  try {
    if(req.method==='GET'&&route==='/board'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; font-src data:; connect-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(await boardHtml());return true;
    }
    if(req.method==='GET'&&route.startsWith('/board-assets/pdf/')){
      const sub=decodeURIComponent(route.slice('/board-assets/pdf/'.length));
      if(!/^(?:pdf(?:\.worker)?\.mjs|(?:cmaps|standard_fonts|wasm)\/[a-zA-Z\d_.-]+)$/.test(sub))throw new Error('无此资源');
      const file=new URL('./pdf/'+sub,import.meta.url);const bytes=await readFile(file);
      res.writeHead(200,{'Content-Type':sub.endsWith('.mjs')?'text/javascript':sub.endsWith('.wasm')?'application/wasm':'application/octet-stream'});res.end(bytes);return true;
    }
    if(req.method==='GET'&&route==='/api/board/session'){send(200,{token,stages:store.stages,outcomes:store.outcomes,interviewStatuses:store.interviewStatuses,platforms:store.platforms,documents:primaryDocuments});return true;}
    if(req.method==='GET'&&route==='/api/board/preferences'){send(200,await preferences(workspace));return true;}
    if(req.method==='GET'&&route==='/api/board/overview'){send(200,await store.overview(workspace));return true;}
    const id=url.searchParams.get('id')??'';
    if(req.method==='GET'&&route==='/api/board/detail'){send(200,await store.show(workspace,id));return true;}
    if(req.method==='GET'&&route==='/api/board/context'){
      const context=await store.context(workspace,id);
      send(200,{...context,prompt:`请在工作区 ${JSON.stringify(workspace)} 继续跟进岗位 ${id}。进入该目录，先读取 AGENTS.md，再执行 ${await workspaceCommand(workspace)} opportunity context --id ${id} --json，按返回的资料与已有决定继续。更新相关 Markdown 和下一步，保留尚未核实的问题。`});return true;
    }
    if(req.method==='GET'&&route==='/api/board/interview-context'){
      send(200,await store.interviewContext(workspace,id,url.searchParams.get('round')??''));return true;
    }
    if(req.method==='GET'&&route==='/api/board/file'){
      const p=url.searchParams.get('path')??'',detail=await store.show(workspace,id),relative=`opportunities/${id}/${p}`;
      // Only expose visible regular files in this card's inventory, never workspace paths.
      if(!p||p.split('/').some(x=>!x||x.startsWith('.'))||p.includes('\\')||!detail.files.some(f=>f.path===relative))throw new Error('岗位中没有这份文件');
      const full=path.join(workspace,relative);await noSymlinks(full);const info=await stat(full);
      if(!info.isFile()||info.size>24*1024*1024)throw new Error('文件超过预览限制（24 MiB）');
      const ext=path.extname(p).toLowerCase(),download=url.searchParams.has('download');
      if(ext==='.md'&&!download){const document=await store.readDocument(workspace,id,p);send(200,{...document,...renderMarkdown(document.content,id,p),source:document.content});return true;}
      const bytes=await readFile(full),type=mime[ext]??'application/octet-stream';
      res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Content-Disposition':`${download||!mime[ext]?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(path.basename(p))}`,'Content-Security-Policy':"default-src 'none'; sandbox; frame-ancestors 'self'",'Cross-Origin-Resource-Policy':'same-origin'});res.end(bytes);return true;
    }
    if(req.method==='POST'&&['/api/board/rate','/api/board/stage','/api/board/archive','/api/board/interview','/api/board/preferences'].includes(route)){
      if(req.headers.origin!==origin||req.headers['x-career-token']!==token||!req.headers['content-type']?.startsWith('application/json')){send(403,{error:'请求不属于当前预览会话'});return true;}
      let text='';for await(const chunk of req){text+=String(chunk);if(Buffer.byteLength(text)>8192)throw new Error('请求过大');}
      const data=JSON.parse(text);
      if(route.endsWith('/preferences')){send(200,await savePreferences(workspace,data.drawer_width));return true;}
      if(route.endsWith('/interview')){
        send(200,await store.saveInterview(workspace,id,{title:data.title,scheduled_at:data.scheduled_at,status:data.status,...(data.round?{id:data.round}:{})},data.sha256,'user'));return true;
      }
      if(typeof data.sha256!=='string'||!/^[a-f0-9]{64}$/.test(data.sha256))throw new Error('请重新读取岗位后操作');
      const result=route.endsWith('/rate')?await store.rate(workspace,id,String(data.stars),data.sha256):await store.update(workspace,id,route.endsWith('/archive')?{archived:data.archived}:{stage:data.stage,...(data.stage==='ended'?{outcome:data.outcome}:{})},data.sha256,'user');
      send(200,result);return true;
    }
    send(404,{error:'无此资源'});
  }catch(e){const error=e as Error;send(e instanceof CommandError&&['RECORD_CONFLICT','WORKSPACE_BUSY'].includes(e.code)?409:400,{error:error.message,code:e instanceof CommandError?e.code:'BOARD_ERROR'});}
  return true;
}
