import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {createQccClient,runCompany,normalizeKey,endpoint,sections} from '../dist/integrations/qcc.js';
import desktop from '../desktop/company.cjs';

const secret='synthetic-qcc-key-not-a-real-credential';
const tools=['get_company_by_query',...Object.values(sections).map(s=>s.tool)].map(name=>({name}));
const response=(request,result)=>new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result}),{headers:{'Content-Type':'application/json'}});
test('company commands expose useful help, local status, and nonzero missing credentials without a workspace',()=>{
 const env={...process.env};delete env.QCC_API_KEY;
 const cli=args=>spawnSync(process.execPath,['dist/cli.js','company',...args,'--json'],{env,encoding:'utf8'});
 const help=cli(['--help']);assert.equal(help.status,0);assert.equal(JSON.parse(help.stdout).data.commands.length,5);
 const status=cli(['status']);assert.equal(status.status,0);assert.equal(JSON.parse(status.stdout).data.configured,false);
 const list=cli(['tools']);assert.equal(list.status,0);assert.ok(JSON.parse(list.stdout).data.sections.registration);
 const missing=cli(['inspect','--company','合成企业']);assert.equal(missing.status,1);assert.equal(JSON.parse(missing.stderr).errors[0].code,'QCC_NOT_CONFIGURED');
 const invalid=cli(['inspect','--company','合成企业','--section','unknown']);assert.equal(JSON.parse(invalid.stderr).errors[0].code,'INVALID_ARGUMENT');
});
test('QCC sends only requested company data to the fixed official endpoint, carries provenance, and never persists',async()=>{
 const calls=[];
 const client=createQccClient('Bearer '+secret,{fetcher:async(url,options)=>{
  assert.equal(url,endpoint);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+secret);
  const body=JSON.parse(options.body);calls.push(body);
  return response(body,body.method==='tools/list'?{tools}:{content:[{type:'text',text:JSON.stringify({企业名称:'合成企业',echo:secret})}]});
 }});
 await client.run({action:'status'});assert.equal(calls.length,0);
 const check=await client.run({action:'check'});assert.equal(check.connected,true);assert.deepEqual(check.missing_tools,[]);assert.equal(calls[0].method,'tools/list');
 const search=await client.run({action:'search',query:' 合成 '});assert.equal(calls[1].params.name,'get_company_by_query');assert.match(search.next_action,/多候选/);
 const query=await client.run({action:'inspect',query:'合成企业',section:'profile'});assert.equal(calls[2].params.name,'get_company_profile');assert.deepEqual(calls[2].params.arguments,{searchKey:'合成企业'});
 assert.equal(query.source_url,endpoint);assert.ok(Date.parse(query.fetched_at));assert.equal(query.result.企业名称,'合成企业');assert.ok(!JSON.stringify(query).includes(secret));
 await assert.rejects(client.run({action:'inspect',query:'x',section:'__proto__'}),{code:'INVALID_ARGUMENT'});
 await assert.rejects(client.run({action:'search',query:'x\nsecret'}),{code:'INVALID_ARGUMENT'});assert.equal(calls.length,3);
});
test('streaming response stops at matching reply, tolerates progress and chunked unicode',async()=>{
 let cancelled=false;
 const client=createQccClient(secret,{fetcher:async(_url,options)=>{
  const id=JSON.parse(options.body).id;
  const bytes=new TextEncoder().encode(': heartbeat\r\n\r\ndata: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/progress'})+'\n\ndata: '+JSON.stringify({jsonrpc:'2.0',id,result:{content:[{type:'text',text:'{"企业名称":"合成企业"}'}]}})+'\r\n\r\n');
  return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));},cancel(){cancelled=true;}}),{headers:{'Content-Type':'text/event-stream'}});
 }});
 assert.equal((await client.run({action:'inspect',query:'合成企业'})).result.企业名称,'合成企业');assert.equal(cancelled,true);
});
test('upstream errors are bounded, classified and sanitized, with exactly one attempt',async()=>{
 for(const [http,code] of [[401,'QCC_AUTH'],[402,'QCC_QUOTA'],[403,'QCC_PERMISSION'],[429,'QCC_RATE_LIMIT'],[503,'QCC_UPSTREAM']]){
  let calls=0;const c=createQccClient(secret,{fetcher:async()=>{calls++;return new Response(secret,{status:http});}});
  await assert.rejects(c.run({action:'check'}),e=>e.code===code&&!e.message.includes(secret));assert.equal(calls,1);
 }
 for(const [result,code] of [[{isError:true,content:[{type:'text',text:'积分不足 '+secret}]},'QCC_QUOTA'],[{content:[{type:'text',text:JSON.stringify({success:false,message:'认证失败 '+secret})}]},'QCC_AUTH'],[{content:[{type:'text',text:JSON.stringify({code:403,message:secret})}]},'QCC_PERMISSION'],[{},'QCC_RESPONSE']]){
  const c=createQccClient(secret,{fetcher:async(_url,options)=>response(JSON.parse(options.body),result)});
  await assert.rejects(c.run({action:'inspect',query:'合成企业'}),e=>e.code===code&&!e.message.includes(secret));
 }
 const auth=createQccClient(secret,{fetcher:async(_url,options)=>new Response(JSON.stringify({jsonrpc:'2.0',id:JSON.parse(options.body).id,error:{code:200001,message:'身份凭证无效 '+secret}}))});await assert.rejects(auth.run({action:'check'}),{code:'QCC_AUTH'});
 const malformed=createQccClient(secret,{fetcher:async()=>new Response('<html>'+secret+'</html>')});await assert.rejects(malformed.run({action:'check'}),{code:'QCC_RESPONSE'});
 const timeout=createQccClient(secret,{fetcher:async()=>{throw new DOMException(secret,'TimeoutError');}});await assert.rejects(timeout.run({action:'check'}),{code:'QCC_TIMEOUT'});
 const network=createQccClient(secret,{fetcher:async()=>{throw new Error(secret);}});await assert.rejects(network.run({action:'check'}),{code:'QCC_NETWORK'});
 const large=createQccClient(secret,{fetcher:async()=>new Response('x'.repeat(2*1024*1024+1))});await assert.rejects(large.run({action:'check'}),{code:'QCC_RESPONSE_TOO_LARGE'});
 const wrong=createQccClient(secret,{fetcher:async()=>response({id:'wrong'},{tools})});await assert.rejects(wrong.run({action:'check'}),{code:'QCC_RESPONSE'});
 assert.throws(()=>normalizeKey('key\nvalue'),{code:'QCC_KEY_INVALID'});assert.throws(()=>normalizeKey(''),{code:'QCC_KEY_INVALID'});
});
test('desktop credentials are encrypted outside workspaces, replacement is checked, remove is idempotent',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'career-company-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const encryptionKey=randomBytes(32);
 const safeStorage={isEncryptionAvailable:()=>true,encryptString:text=>{const iv=randomBytes(16),cipher=createCipheriv('aes-256-cbc',encryptionKey,iv);return Buffer.concat([iv,cipher.update(text),cipher.final()]);},decryptString:bytes=>{const decipher=createDecipheriv('aes-256-cbc',encryptionKey,bytes.subarray(0,16));return Buffer.concat([decipher.update(bytes.subarray(16)),decipher.final()]).toString();}};
 let fail=false;const calls=[];
 const options={app:{getPath:()=>directory},safeStorage,coreRoot:path.resolve('.'),clientFactory:key=>({run:async r=>{calls.push({key,request:r});if(fail)throw new Error('synthetic rejected key');return {connected:true};}})};
 const service=await desktop.createCompanyService(options);assert.equal((await service.status()).configured,false);assert.equal(calls.length,0);
 const saved=await service.save('Bearer '+secret);assert.equal(saved.configured,true);assert.ok(!JSON.stringify(saved).includes(secret));
 const file=path.join(directory,'integrations/qcc.json'),before=await readFile(file,'utf8');assert.ok(!before.includes(secret));if(process.platform!=='win32')assert.equal((await stat(file)).mode&0o777,0o600);
 await service.run({action:'inspect',query:'合成企业'});assert.equal(calls.at(-1).key,secret);
 const reopened=await desktop.createCompanyService(options);assert.equal((await reopened.status()).configured,true);
 fail=true;await assert.rejects(service.save('another-synthetic-key'));assert.equal(await readFile(file,'utf8'),before);
 safeStorage.isEncryptionAvailable=()=>false;await assert.rejects(service.save(secret),{code:'QCC_STORAGE'});assert.equal(await readFile(file,'utf8'),before);
 assert.equal((await service.remove()).configured,false);assert.equal((await service.remove()).configured,false);
 safeStorage.isEncryptionAvailable=()=>true;safeStorage.getSelectedStorageBackend=()=>'basic_text';await assert.rejects(service.save(secret),{code:'QCC_STORAGE'});
});
