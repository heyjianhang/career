import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildSite,output,publicFiles} from './build-site.mjs';

await buildSite();
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8'};
const server=createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const name=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1));
    const found=publicFiles.includes(name);
    const file=found?name:'404.html';
    const body=await readFile(path.join(output,file));
    res.writeHead(found?200:404,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(400);res.end('Bad request');}
});
server.listen(0,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port}/`));
