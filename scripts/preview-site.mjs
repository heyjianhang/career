import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSite,output,publicFiles} from './build-site.mjs';
import {localStore,localCredentials} from '../portal/local.mjs';
import {handlePortal} from '../portal/server.mjs';

export async function startPortalPreview({directory = fileURLToPath(new URL('../.cache/portal', import.meta.url)), port = 0, fetcher} = {}) {
  await buildSite();
  const kv = await localStore(path.join(directory, 'data'));
  const env = await localCredentials(directory);
  const baseline = JSON.parse(await readFile(new URL('../site/downloads.json', import.meta.url), 'utf8'));
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8'};
  const server=createServer(async(req,res)=>{
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (req.headers.host !== `127.0.0.1:${server.address().port}`) {res.writeHead(403);res.end();return;}
    try{
      const pathname=new URL(req.url,origin).pathname;
      if (pathname.startsWith('/api/')) {
        const request = new Request(new URL(req.url, origin), {method: req.method, headers: req.headers, ...(!['GET', 'HEAD'].includes(req.method) ? {body: req, duplex: 'half'} : {})});
        const response = await handlePortal(request, {kv,env:{...env,PORTAL_ORIGIN:origin},baseline,local:true,fetcher});
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const name=pathname==='/'?'index.html':['/admin','/admin/'].includes(pathname)?'admin/index.html':decodeURIComponent(pathname.slice(1));
      const found=publicFiles.includes(name); const file=found?name:'404.html';
      const body=await readFile(path.join(output,file));
      res.writeHead(found?200:404,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY', ...(name.startsWith('admin/') ? {'X-Robots-Tag':'noindex, nofollow'} : {})});
      res.end(req.method==='HEAD'?undefined:body);
    }catch{res.writeHead(400);res.end('Bad request');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,url:`http://127.0.0.1:${server.address().port}`,directory,keyFile:path.join(directory,'admin-key.json')};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result = await startPortalPreview();
  console.log(`Local: ${result.url}/\nAdmin: ${result.url}/admin/\n本地管理密钥文件（仅本机）：${result.keyFile}`);
}
