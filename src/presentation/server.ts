import {resumeRoutes} from '../resumes/api.js';
import {boardRequest} from '../board/api.js';
import {createServer,type IncomingMessage} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {loadBuild} from './build.js';
import {loadCollection} from './collection.js';
import {pdfBuffer} from './pdf.js';
import {readPreference,readDefaultTheme,savePreference,hash,noSymlinks} from './io.js';
import type {Theme} from './types.js';

export async function startPreview(directory:string,workspace:string,port=0,live=false) {
  let isCollection=false;try{await lstat(path.join(directory,'collection.json'));isCollection=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const collection=isCollection?await loadCollection(directory):undefined;
  const single=collection?undefined:await loadBuild(directory);
  const entries=collection?.entries??[{id:single!.checked.input.id,title:single!.checked.input.title,href:'index.html',generated_at:single!.checked.input.generated_at}];
  const firstId=entries[0]?.id;
  const directories=new Map(entries.map(e=>[e.id,collection?path.join(directory,'resumes',e.id):directory]));
  const allowedThemes=new Map<string,string[]>();
  for(const [id,dir] of directories){const {manifest}=await loadBuild(dir);allowedThemes.set(id,(manifest.templates??[{id:'classic'},{id:'compact'}]).map(t=>t.id));}
  const token=randomBytes(32).toString('hex');let origin='';let busy=false;
  const handleResumes=resumeRoutes(workspace,token,isCollection,live);
  async function body(req:IncomingMessage,allowClear=false) {
    let text='';for await(const chunk of req){text+=String(chunk);if(text.length>2048)throw new Error('请求过大');}
    const data=JSON.parse(text) as {theme?:Theme|null;resumeId?:string};const id=data.resumeId??(collection?undefined:firstId);
    if(!id||!directories.has(id))throw new Error('未知简历');
    if(!(allowClear&&data.theme===null)&&!allowedThemes.get(id)!.includes(data.theme as Theme))throw new Error('未知样式');return {theme:data.theme as Theme|null,id};
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const send=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    if(req.headers.host!==new URL(origin).host) {send(403,{error:'仅接受本机预览地址'});return;}
    try {
      const url=new URL(req.url??'/',origin),pathname=url.pathname;
      if(await boardRequest(req,res,url,workspace,origin,token))return;
      if(await handleResumes(req,res,url,origin))return;
      if(req.method==='GET') {
        let file:string|undefined;
        if(pathname==='/'||pathname==='/index.html') {
          if(collection){file=path.join(directory,'index.html');await noSymlinks(file);if(hash(await readFile(file))!==collection.index_sha256)throw new Error('集合首页已改变');}
          else{await loadBuild(directory);file=path.join(directory,'index.html');}
        } else if(collection) {
          const entry=entries.find(e=>pathname==='/'+e.href);
          if(entry){const dir=directories.get(entry.id)!;await loadBuild(dir);file=path.join(dir,'index.html');}
        }
        if(file){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'self'; frame-src 'self' about:; base-uri 'none'; frame-ancestors 'none'"});res.end(await readFile(file));return;}
        if(pathname==='/api/session') {
          const id=url.searchParams.get('resume')??firstId;if(!id||!directories.has(id))throw new Error('未知简历');
          send(200,{token,defaultTheme:await readPreference(workspace),savedDefaultTheme:await readDefaultTheme(workspace),resumeId:id});return;
        }
        if(pathname==='/api/resumes'){send(200,{schema:'career-library/v1',entries});return;}
      }
      if(req.method!=='POST'||!['/api/pdf','/api/preference'].includes(pathname)) {send(404,{error:'无此资源'});return;}
      if(req.headers.origin!==origin||req.headers['x-career-token']!==token||!req.headers['content-type']?.startsWith('application/json')) {send(403,{error:'请求不属于当前预览会话'});return;}
      const {theme,id}=await body(req,pathname==='/api/preference');
      if(pathname==='/api/preference') {await savePreference(workspace,theme);send(200,{theme});return;}
      if(theme===null)throw new Error('请选择导出样式');
      if(busy){send(409,{error:'PDF 正在生成，请稍后重试'});return;}busy=true;
      try {const buffer=await pdfBuffer(directories.get(id)!,theme);res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="resume-${id}-${theme}.pdf"`});res.end(buffer);}
      finally{busy=false;}
    } catch(error) {send(400,{error:(error as Error).message});}
  });
  server.requestTimeout=30_000;server.headersTimeout=10_000;
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve());});
  const address=server.address();if(!address||typeof address==='string')throw new Error('启动失败');
  origin='http://127.0.0.1:'+address.port;
  return {url:origin,server,close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
