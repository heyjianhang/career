import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readdir,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCompanyBridge}=require('../desktop/company-bridge.cjs');
async function fixture(t){
 const dir=await mkdtemp(path.join(os.tmpdir(),'career-company-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const worker=path.join(dir,'worker.cjs');
 await writeFile(worker,`const fs=require('node:fs'),path=require('node:path');
const dir=process.argv[2],request=JSON.parse(fs.readFileSync(path.join(dir,'request.json'),'utf8'));
if(request.mode==='timeout'){setTimeout(()=>{},10000);}
else if(request.mode==='missing'){process.exit(0);}
else if(request.mode==='malformed'){fs.writeFileSync(path.join(dir,'response.json'),'not JSON');}
else if(request.mode==='oversize'){fs.writeFileSync(path.join(dir,'response.json'),'x'.repeat(3*1024*1024+1));}
else {
 const result=request.mode==='error'?{ok:false,error:{code:'QCC_NOT_CONFIGURED',message:'请先配置'}}:{ok:true,value:{query:request.query,nodeMode:process.env.ELECTRON_RUN_AS_NODE??null,key:process.env.QCC_API_KEY??null,mode:fs.statSync(dir).mode&0o777,inputMode:fs.statSync(path.join(dir,'request.json')).mode&0o777}};
 fs.writeFileSync(path.join(dir,'response.json'),JSON.stringify(result));
 console.log('unrelated GUI diagnostics');
 process.exitCode=request.mode==='error'||request.mode==='badExit'?1:0;
}
`);
 const bridge=options=>createCompanyBridge({executable:process.execPath,args:[worker],tempRoot:dir,environment:{...process.env,ELECTRON_RUN_AS_NODE:'1',QCC_API_KEY:'synthetic-do-not-forward'},...options});
 const clean=async()=>assert.deepEqual(await readdir(dir),['worker.cjs']);
 return {dir,bridge,clean};
}
test('company helper transfers Unicode without standard streams or forwarding credentials',async t=>{
 const f=await fixture(t),run=f.bridge();
 const values=await Promise.all(['公司甲','公司乙'].map(query=>run({query})));
 assert.deepEqual(values.map(v=>v.query),['公司甲','公司乙']);
 for(const v of values){assert.equal(v.nodeMode,null);assert.equal(v.key,null);if(process.platform!=='win32'){assert.equal(v.mode,0o700);assert.equal(v.inputMode,0o600);}}
 await f.clean();
});
test('company helper retains coded errors and rejects missing, malformed and failed responses',async t=>{
 const f=await fixture(t),run=f.bridge();
 await assert.rejects(run({mode:'error'}),{code:'QCC_NOT_CONFIGURED',message:'请先配置'});
 for(const mode of ['missing','malformed','badExit'])await assert.rejects(run({mode}),{code:'QCC_DESKTOP'});
 await f.clean();
});
test('company helper bounds request/response files and cleans up every failure',async t=>{
 const f=await fixture(t),run=f.bridge();
 await assert.rejects(run({query:'x'.repeat(4096)}),{code:'QCC_RESPONSE_TOO_LARGE'});
 await assert.rejects(run({mode:'oversize'}),{code:'QCC_RESPONSE_TOO_LARGE'});
 await f.clean();
});
test('company helper timeout and missing executable leave no exchange files',async t=>{
 const f=await fixture(t);
 await assert.rejects(f.bridge({timeoutMs:150})({mode:'timeout'}),{code:'QCC_TIMEOUT'});
 await assert.rejects(f.bridge({executable:path.join(f.dir,'no-such-program')})({}),{code:'QCC_DESKTOP'});
 await f.clean();
});
