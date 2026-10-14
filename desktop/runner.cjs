// Headless CLI entry, run by the Electron executable in Node mode. No system Node/npm required.
const path=require('node:path');
const fs=require('node:fs/promises');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {boundArguments}=require('./runtime.cjs');
(async()=>{
 const {workspace,args}=boundArguments(process.argv.slice(2));
 const config=JSON.parse(await fs.readFile(path.join(workspace,'career.json'),'utf8'));
 if(config.schema!=='career-workspace/v1')throw new Error('工作区无效，请在 career 中重新打开。');
 process.chdir(workspace);
 const coreRoot=path.join(__dirname,'runtime/node_modules/@heyjianhang/career');
 const company=await import(pathToFileURL(path.join(coreRoot,'dist/integrations/qcc.js')));
 company.setCompanyHandler(async request=>{try{return await require('./company-bridge.cjs').companyRequest(request);}catch(e){throw new company.CompanyError(e.code??'QCC_DESKTOP',e.message);}});
 const pdf=await import(pathToFileURL(path.join(coreRoot,'dist/presentation/pdf.js')));
 pdf.setPdfRenderer(async html=>{
   const temp=await fs.mkdtemp(path.join(os.tmpdir(),'career-pdf-'));
   try{
     const input=path.join(temp,'print.html'),output=path.join(temp,'resume.pdf');await fs.writeFile(input,html,{mode:0o600});
     const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
     await new Promise((resolve,reject)=>{
       const child=spawn(process.execPath,[__dirname,'--career-print',input,output],{env,stdio:['ignore','ignore','pipe'],windowsHide:true});
       let error='';child.stderr.on('data',b=>{error=(error+b).slice(-4000);});
       const timeout=setTimeout(()=>{child.kill();reject(new Error('PDF 导出超时'));},90000);
       child.on('error',e=>{clearTimeout(timeout);reject(e);});child.on('exit',code=>{clearTimeout(timeout);code===0?resolve():reject(new Error(error||'PDF 导出失败'));});
     });
     return await fs.readFile(output);
   }finally{await fs.rm(temp,{recursive:true,force:true});}
 });
 process.argv=[process.execPath,path.join(coreRoot,'dist/cli.js'),...args];
 await import(pathToFileURL(process.argv[1]));
})().catch(e=>{console.error(JSON.stringify({schema_version:'career-cli/v1',status:'error',errors:[{code:'DESKTOP_CLI',message:e.message}]}));process.exitCode=1;});
