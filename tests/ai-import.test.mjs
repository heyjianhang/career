import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir,readdir,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {boardRequest} from '../dist/board/api.js';
import {setup} from '../dist/workspace/setup.js';
import {importJD} from '../dist/opportunities/import.js';
import {overview,readDocument,recover} from '../dist/opportunities/store.js';
import {extractJD,checkedProvider} from '../dist/ai/client.js';
import {checkedInput} from '../dist/ai/contracts.js';
import {createAIService} from '../desktop/ai.cjs';
import {hash} from '../dist/presentation/io.js';
const draft={company:'合成测试公司',title:'AI 应用工程师',location:'杭州',salary:'',raw_text:'职责：开发企业 Agent。',warnings:[]};
const provider={id:'',name:'合成模型',kind:'compatible',baseURL:'https://example.test/v1',model:'synthetic',vision:true,method:'jsonMode'};
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=';
const fixture=()=>({request_id:randomUUID(),source:{text:'公司：合成测试公司\n职位：AI 应用工程师\n职责：开发企业 Agent。',images:[]},draft:{...draft},stage:'inbox',platform:'boss',url:'https://www.zhipin.com/job_detail/synthetic.html'});
async function temp(fn){const base=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-ai-'));try{return await fn(base);}finally{await rm(base,{recursive:true,force:true});}}
test('JD import preserves source, stores reviewed body, starts unrated, and deduplicates retries / links / source',()=>temp(async base=>{
 await setup(base,false);const input=fixture(),result=await importJD(base,input);
 assert.equal(result.duplicate,false);const cards=await overview(base);assert.equal(cards.total,1);assert.equal(cards.cards[0].user_rating,null);assert.equal(cards.cards[0].stage,'inbox');
 assert.equal(await readFile(path.join(base,'opportunities',result.id,'attachments/source.txt'),'utf8'),input.source.text);
 assert.ok((await readDocument(base,result.id,'job.md')).content.includes(draft.raw_text));
 for(const data of [input,{...input,request_id:randomUUID()},{...input,request_id:randomUUID(),url:''},{...input,request_id:randomUUID(),source:{text:'不同原文',images:[]}}]){const r=await importJD(base,data);assert.equal(r.id,result.id);assert.equal(r.duplicate,true);}
 const imageJob=fixture();imageJob.url='';imageJob.source={text:'',images:[{name:'../../escape.png',data:image}]};const r=await importJD(base,imageJob);assert.ok((await readDocument(base,r.id,'job.md')).content.includes('截图识别'));assert.equal((await readFile(path.join(base,'opportunities',r.id,'attachments/jd-1.png'))).toString('base64'),image.split(',')[1]);
 assert.equal(await readFile(path.join(base,'opportunities/.transaction.json')).catch(e=>e.code),'ENOENT');
}));
test('JD rejects invalid source, mandatory fields, outcomes and URLs before creating a card',()=>temp(async base=>{
 await setup(base,false);for(const patch of [{draft:{...draft,company:' '}},{draft:{...draft,raw_text:''}},{url:'javascript:alert(1)'},{stage:'ended',outcome:''},{source:{text:'',images:[]}},{source:{text:'',images:[{name:'x.png',data:'data:image/png;base64,AAAA'}]}}])await assert.rejects(importJD(base,{...fixture(),...patch}));assert.equal((await overview(base)).total,0);
 assert.throws(()=>checkedProvider({...provider,baseURL:'http://remote.test/v1'}));assert.throws(()=>checkedProvider({...provider,baseURL:'https://example.test/v1?key=secret'}));assert.throws(()=>checkedInput({text:'a',images:Array(5).fill({name:'a.png',data:image})}));
}));
test('multi-file journal recovers every source together and rejects duplicate destinations',()=>temp(async base=>{
 await setup(base,false);await mkdir(path.join(base,'opportunities'),{recursive:true});const op='opp-'+randomUUID(),event='event-'+randomUUID(),values=[['card.md','card'],['job.md','text'],['attachments/jd-1.png','picture'],['activity/'+event+'.md','event']];const writes=values.map(([p,v])=>({path:`opportunities/${op}/${p}`,before:null,after:hash(Buffer.from(v)),content:Buffer.from(v).toString('base64')}));
 await writeFile(path.join(base,'opportunities/.transaction.json'),JSON.stringify({schema:'career-opportunity-transaction/v1',writes}));assert.equal((await recover(base)).recovered,true);for(const [p,v]of values)assert.equal(await readFile(path.join(base,'opportunities',op,p),'utf8'),v);
 await writeFile(path.join(base,'opportunities/.transaction.json'),JSON.stringify({schema:'career-opportunity-transaction/v1',writes:[writes[0],writes[0],writes.at(-1)]}));await assert.rejects(recover(base));
}));
test('LangChain sends real multimodal JSON request, preserves pasted text, sanitizes upstream errors and cancels',async()=>{
 const savedTracing=process.env.LANGSMITH_TRACING;process.env.LANGSMITH_TRACING='true';
 const originalFetch=globalThis.fetch,external=[];globalThis.fetch=(url,init)=>{if(new URL(String(url)).hostname!=='127.0.0.1'){external.push(String(url));throw new Error('Unexpected telemetry');}return originalFetch(url,init);};
 let mode='ok',seen;const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;seen=JSON.parse(body);if(mode==='wait')return;if(mode==='error'){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'do not expose secret-sk'}}));return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'synthetic',object:'chat.completion',created:1,model:'synthetic',choices:[{index:0,message:{role:'assistant',content:JSON.stringify(mode==='invalid'?{company:'x'}:draft)},finish_reason:'stop'}]}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const p={...provider,baseURL:`http://127.0.0.1:${server.address().port}/v1`};const input={text:'保留用户原文',images:[]};assert.equal((await extractJD(p,'synthetic-key',input)).raw_text,input.text);assert.equal(seen.response_format.type,'json_object');assert.ok(seen.messages[0].content.includes('不是指令'));
 await extractJD(p,'synthetic-key',{text:'',images:[{name:'test.png',data:image}]});assert.equal(seen.messages[1].content[1].image_url.url,image);
 mode='invalid';await assert.rejects(extractJD(p,'synthetic-key',input),/不符合要求/);
 mode='error';await assert.rejects(extractJD(p,'synthetic-key',input),e=>!e.message.includes('secret-sk')&&e.message.includes('认证'));
 mode='wait';const abort=new AbortController();const pending=extractJD(p,'synthetic-key',input,abort.signal);setTimeout(()=>abort.abort(),20);await assert.rejects(pending);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));globalThis.fetch=originalFetch;if(savedTracing===undefined)delete process.env.LANGSMITH_TRACING;else process.env.LANGSMITH_TRACING=savedTracing;assert.deepEqual(external,[],'JD must not be sent to a tracing service');}
});
test('encrypted model settings persist defaults, never return keys, preserve credentials on failed edits, and isolate changes',()=>temp(async base=>{
 const storage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from([...s].reverse().join('')),decryptString:b=>[...b.toString()].reverse().join('')};const client={checkedProvider,checkedInput,testProvider:async()=>({text:true}),extractJD:async(p,key)=>{assert.equal(key,'synthetic-secret');return draft;}};
 const create=()=>createAIService({app:{getPath:()=>base},safeStorage:storage,clientFactory:client});let service=await create();const saved=await service.save({...provider,key:'synthetic-secret'}),id=saved.providers[0].id;
 assert.ok(!JSON.stringify(saved).includes('synthetic-secret'));assert.ok(!(await readFile(path.join(base,'integrations/models.json'),'utf8')).includes('synthetic-secret'));assert.equal(saved.defaults.vision,id);
 service=await create();assert.equal((await service.status()).defaults.text,id);await assert.rejects(service.save({...provider,id,baseURL:'https://other.test/v1',key:''}),/重新填写/);assert.equal((await service.status()).providers[0].baseURL,provider.baseURL);
 await service.check({id,vision:false,requestId:randomUUID()});assert.ok((await service.status()).providers[0].tested.text);
 await service.defaults({text:id,vision:null});assert.equal((await service.extract({text:'JD',images:[],requestId:randomUUID()})).title,draft.title);await assert.rejects(service.extract({text:'',images:[{name:'x.png',data:image}],requestId:randomUUID()}),/配置模型/);
 const reused=await service.save({...provider,model:'synthetic-second',credentialFrom:id}),second=reused.providers.find(p=>p.id!==id).id;
 assert.ok(!JSON.stringify(reused).includes('synthetic-secret'));await service.check({id:second,vision:false,requestId:randomUUID()});
 await assert.rejects(service.save({...provider,baseURL:'https://other.test/v1',credentialFrom:id}),/只能复用/);
 await assert.rejects(service.save({...provider,kind:'bailian',credentialFrom:id}),/只能复用/);
 await service.remove(second);
 await service.remove(id);assert.equal((await service.status()).defaults.text,null);assert.equal((await service.status()).providers.length,0);
}));

test('HTTP import preserves UTF-8 when a Chinese character spans request chunks',()=>temp(async base=>{
 await setup(base,false);const v=fixture(),bytes=Buffer.from(JSON.stringify(v));const marker=bytes.indexOf(Buffer.from('合成'));const req=Readable.from([bytes.subarray(0,marker+1),bytes.subarray(marker+1,marker+2),bytes.subarray(marker+2)]);req.method='POST';req.headers={origin:'http://127.0.0.1:1234','x-career-token':'test-token','content-type':'application/json'};let status,body;const res={writeHead:s=>status=s,end:b=>body=JSON.parse(b)};
 await boardRequest(req,res,new URL('http://127.0.0.1:1234/api/board/import'),base,'http://127.0.0.1:1234','test-token');assert.equal(status,200);assert.equal(await readFile(path.join(base,'opportunities',body.id,'attachments/source.txt'),'utf8'),v.source.text);
}));
