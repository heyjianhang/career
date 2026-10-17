import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import * as store from './store.js';
import {libraryHtml} from './page.js';
import {hash,noSymlinks,check,readPreference,readDefaultTheme,savePreference,themes} from '../presentation/io.js';
import {listPresentations,presentationDirectory} from '../presentation/collection.js';
import {html,escape} from '../presentation/render.js';
import {build} from '../presentation/build.js';
import {pdfBuffer} from '../presentation/pdf.js';
import {templateMetadata} from '../presentation/templates/registry.js';
import {CommandError} from '../agent-api.js';

const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'self'; frame-src 'self' about:; base-uri 'none'; frame-ancestors 'none'";
export function resumeRoutes(workspace:string,token:string,isCollection:boolean,live:boolean){
 let exporting=false;const builds=new Map<string,string>();
 return async(req:IncomingMessage,res:ServerResponse,url:URL,origin:string)=>{
  const route=url.pathname,detail=route.match(/^\/resumes\/([a-z][a-z0-9-]{0,79})\/(index\.html|edit)$/);
  const library=route.startsWith('/api/library/'),legacyApi=['/api/session','/api/resumes','/api/pdf','/api/preference'].includes(route);
  if(!live&&!library)return false;
  if(!library&&!detail&&!legacyApi&&!(isCollection&&['/','/index.html'].includes(route)))return false;
  const send=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  const page=(text:string)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':csp});res.end(text);};
  try{
   if(req.headers['sec-fetch-site']==='cross-site'){send(403,{error:'仅接受当前本机页面请求'});return true;}
   const id=url.searchParams.get('id')??'';
   if(req.method==='GET'){
    if(isCollection&&['/','/index.html'].includes(route)){page(await libraryHtml());return true;}
    if(detail){const r=await store.readResume(workspace,detail[1]!);if(detail[2]==='edit'){page(await libraryHtml(r.id));return true;}
     const checked=await check(r.file,workspace);let rendered=await html(checked,await readPreference(workspace,r.id),false);
     const styles=await readFile(new URL('./styles.css',import.meta.url),'utf8');
     const extra=`<style>${styles}</style><script type="module">
if(location.protocol==='http:'){
 document.body.classList.add('resume-live');document.body.dataset.packageSha=${JSON.stringify(r.sha256)};const heading=document.querySelector('.workspace-header');heading.querySelector('h1').textContent=${JSON.stringify(r.title).replace(/</g,'\\u003c')};heading.insertAdjacentHTML('afterbegin','<a class="resume-back" href="/" aria-label="返回简历列表">←</a>');
 heading.insertAdjacentHTML('beforeend',${JSON.stringify(`<div class="live-resume-actions"><a class="button" href="/resumes/${r.id}/edit" id="edit-resume" ${r.editable?'':'hidden'}>编辑内容</a><button class="button" id="copy-resume">${r.editable?'另存一份':'转为可编辑副本'}</button></div>`)});
 document.querySelectorAll('.sidebar a[href="#resume"]').forEach(a=>a.href='/');
 document.querySelector('#copy-resume').onclick=async()=>{const title=prompt('新简历名称',${JSON.stringify(r.title+' · 副本').replace(/</g,'\\u003c')});if(!title)return;try{const s=await(await fetch('/api/library/session')).json();const response=await fetch('/api/library/create',{method:'POST',headers:{'Content-Type':'application/json','X-Career-Token':s.token},body:JSON.stringify({from:${JSON.stringify(r.id)},title})});const v=await response.json();if(!response.ok)throw Error(v.error);location.href='/resumes/'+v.id+'/edit';}catch(e){alert(e.message);}};
 let checking=false;setInterval(async()=>{if(document.hidden||document.querySelector('dialog[open]')||checking)return;checking=true;try{const s=await fetch('/api/library/stamp?id=${r.id}');if(s.ok&&(await s.json()).sha256!==${JSON.stringify(r.sha256)})location.reload();}finally{checking=false;}},5000);
}else{document.querySelectorAll('.live-resume-actions,.resume-back').forEach(e=>e.remove());}
</script>`;
     rendered=rendered.slice(0,rendered.lastIndexOf('</body>'))+extra+'</body></html>';page(rendered);return true;
    }
    if(route==='/api/library/session'){send(200,{token,themes:templateMetadata,defaultTheme:await readPreference(workspace),prompt:`请在工作区 ${JSON.stringify(workspace)} 读取 AGENTS.md，按已有进度引导我盘点材料、研究适合的岗位要求、深入整理经历，再生成第一份可编辑简历。边聊边保存，每次问一处关键问题；已有研究先复用，未核实的经历不编造。`});return true;}
    if(route==='/api/library/thumbnail'){
     const r=await store.readResume(workspace,id),checked=await check(r.file,workspace);
     const rendered=await html(checked,await readPreference(workspace,r.id),true);
     res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':csp.replace("frame-ancestors 'none'","frame-ancestors 'self'")});res.end(rendered);return true;
    }
    if(route==='/api/library/list'){send(200,await store.library(workspace));return true;}
    if(route==='/api/library/read'){send(200,await store.readResume(workspace,id));return true;}
    if(route==='/api/library/stamp'){const r=await store.readResume(workspace,id);send(200,{sha256:r.sha256});return true;}
    if(route==='/api/library/relations'){send(200,await store.resumeRelations(workspace,id));return true;}
    if(route==='/api/library/submission'){const saved=await store.submissionHtml(workspace,url.searchParams.get('opportunity')??'',id);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="submitted-resume.html"','Content-Security-Policy':"default-src 'none'; sandbox"});res.end(saved);return true;}
    if(route==='/api/session'){const resumeId=url.searchParams.get('resume');if(resumeId&&(await listPresentations(workspace)).entries.some(e=>e.id===resumeId)){send(200,{token,defaultTheme:await readPreference(workspace),savedDefaultTheme:await readDefaultTheme(workspace),resumeId,canSaveResumeTheme:true});return true;}return false;}
    if(route==='/api/resumes'&&isCollection){send(200,{schema:'career-library/v1',entries:(await listPresentations(workspace)).entries.map(e=>({id:e.id,title:e.title,generated_at:e.generated_at,href:`/resumes/${e.id}/index.html`}))});return true;}
   }
   if(req.method==='POST'&&(library||(legacyApi&&isCollection))){
    if(req.headers.origin!==origin||req.headers['x-career-token']!==token||!req.headers['content-type']?.startsWith('application/json')){send(403,{error:'请求不属于当前预览会话'});return true;}
    let bytes=0,text='';for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>16*1024*1024)throw new Error('请求超过 16 MiB');text+=chunk;}const data=JSON.parse(text);
    if(route==='/api/library/create'){send(200,await store.createResume(workspace,data.title,data.from));return true;}
    if(route==='/api/library/save'){if(typeof data.sha256!=='string')throw new Error('保存前请读取内容包摘要');send(200,await store.savePackage(workspace,data.package,data.sha256));return true;}
    if(route==='/api/library/theme'){
     const r=await store.readResume(workspace,data.resumeId);
     if(!themes.includes(data.theme))throw new Error('未知样式');
     await savePreference(workspace,data.theme,r.id);send(200,{theme:data.theme});return true;
    }
    if(route==='/api/library/assign'){send(200,await store.selectResume(workspace,data.opportunity_id,data.resume_id,data.sha256,'user'));return true;}
    if(route==='/api/library/submit'){send(200,await store.submitResume(workspace,data.opportunity_id,data,data.sha256,'user'));return true;}
    if(route==='/api/library/photo'){
     const r=await store.readResume(workspace,data.id);if(!r.editable)throw new Error('请先转为可编辑副本');if(typeof data.bytes!=='string')throw new Error('照片内容无效');const photo=Buffer.from(data.bytes,'base64');if(photo.length>5*1024*1024)throw new Error('照片不能超过 5 MiB');
     const png=photo.length>=33&&photo.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&photo.subarray(12,16).toString()==='IHDR';const jpeg=photo.length>=4&&photo[0]===255&&photo[1]===216&&photo[2]===255&&photo.at(-2)===255&&photo.at(-1)===217;if(!png&&!jpeg)throw new Error('照片仅支持 PNG/JPEG');
     const file=path.join(await presentationDirectory(workspace),r.id,'assets','photo-'+randomUUID()+(png?'.png':'.jpg'));await noSymlinks(file);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,photo,{flag:'wx'});send(200,{photo:{path:path.relative(workspace,file).split(path.sep).join('/'),sha256:hash(photo),alt:'简历照片'}});return true;
    }
    if(route==='/api/preference'){await store.readResume(workspace,data.resumeId);await savePreference(workspace,data.theme);send(200,{theme:data.theme});return true;}
    if(route==='/api/pdf'){
     if(!themes.includes(data.theme))throw new Error('未知样式');if(exporting){send(409,{error:'PDF 正在生成，请稍后重试'});return true;}exporting=true;
     try{const r=await store.readResume(workspace,data.resumeId);if(data.sha256&&r.sha256!==data.sha256)throw new CommandError('PACKAGE_CONFLICT','简历已更新，请刷新页面后再导出');const key=r.id+':'+r.sha256;let dir=builds.get(key);if(!dir){dir=(await build(r.file,workspace,undefined,data.theme)).directory;builds.set(key,dir);}const bytes=await pdfBuffer(dir,data.theme);res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="resume-${r.id}.pdf"`});res.end(bytes);return true;}finally{exporting=false;}
    }
   }
   if(library){send(404,{error:'无此资源'});return true;}return false;
  }catch(e){if(res.headersSent){res.end();return true;}send(e instanceof CommandError&&['PACKAGE_CONFLICT','PACKAGE_BUSY','RECORD_CONFLICT','WORKSPACE_BUSY'].includes(e.code)?409:400,{error:(e as Error).message,code:e instanceof CommandError?e.code:'RESUME_ERROR'});return true;}
 };
}
