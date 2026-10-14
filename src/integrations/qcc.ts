import {randomUUID} from 'node:crypto';

// Fixed official endpoint: credentials must never follow a redirect or a workspace URL.
export const endpoint='https://agent.qcc.com/mcp/company/stream';
export const sections={
  registration:{tool:'get_company_registration_info',title:'工商信息'},
  profile:{tool:'get_company_profile',title:'企业简介'},
  shareholders:{tool:'get_shareholder_info',title:'直接股东'},
  personnel:{tool:'get_key_personnel',title:'主要人员'},
  changes:{tool:'get_change_records',title:'工商变更'},
  'annual-reports':{tool:'get_annual_reports',title:'企业年报'},
  controller:{tool:'get_actual_controller',title:'实际控制人'}
} as const;
export type CompanyRequest={action:'status'|'check'|'search'|'inspect';query?:string;section?:string};
export class CompanyError extends Error {
  constructor(public code:string,message:string){super(message);}
}
const fail=(code:string,message:string):never=>{throw new CompanyError(code,message);};
export function normalizeKey(value:unknown):string {
  const key=typeof value==='string'?value.trim().replace(/^Bearer\s+/i,''):'';
  if(!key||key.length>4096||!/^[\x21-\x7e]+$/.test(key))return fail('QCC_KEY_INVALID','请填写有效的企查查 API Key，可包含 Bearer 前缀。');
  return key;
}
export function validateRequest(request:CompanyRequest):CompanyRequest {
  if(!request||!['status','check','search','inspect'].includes(request.action))return fail('INVALID_ARGUMENT','未知企业查询操作');
  if(request.action==='search'||request.action==='inspect'){
    if(typeof request.query!=='string'||!request.query.trim()||request.query.length>200||/[\x00-\x1f]/.test(request.query))return fail('INVALID_ARGUMENT','请提供 1–200 字的公司名称或统一社会信用代码。');
    if(request.action==='inspect'&&request.section!==undefined&&!Object.hasOwn(sections,request.section))return fail('INVALID_ARGUMENT','未知查询类别，使用 company tools 查看支持的类别。');
    return {...request,query:request.query.trim()};
  }
  return {action:request.action};
}
export function capabilities(){return {provider:'qcc',endpoint,search:{tool:'get_company_by_query',title:'企业主体搜索'},sections,queries_may_use_credits:true};}
export function connectionStatus(configured:boolean,source:string){return {provider:'qcc',configured,credential_source:source,verified:false,next_action:configured?'按需 company check 检查连接，或 company search / inspect 查询企业。':'桌面版：设置 → 外部服务 → 企查查；npm 版：在运行进程的环境中设置 QCC_API_KEY。不要把密钥写入工作区或聊天。'};}

// Errors from the upstream service are classified, never copied (they may echo a key).
function upstreamError(value:unknown,httpStatus?:number):never {
  const text=JSON.stringify(value??'');
  const code=value&&typeof value==='object'?(value as {code?:unknown}).code:undefined;
  httpStatus??=typeof code==='number'?code:undefined;
  if(httpStatus===401||code===200001||/unauthori[sz]ed|invalid.{0,12}(key|token)|API.?Key.{0,12}(无效|失效)|认证失败|未授权|身份凭证/i.test(text))return fail('QCC_AUTH','企查查认证失败，请在设置中更新 API Key。');
  if(httpStatus===402||/积分|额度|余额|insufficient|quota|credits/i.test(text))return fail('QCC_QUOTA','企查查额度不足，请在官方账号页面检查权益；未自动重试。');
  if(httpStatus===429||/rate.?limit|频率|频繁/i.test(text))return fail('QCC_RATE_LIMIT','企查查请求过于频繁，请稍后再试；未自动重试。');
  if(httpStatus===403||/forbidden|permission|权限|企业认证/i.test(text))return fail('QCC_PERMISSION','企查查拒绝此查询，请检查 API Key 权限和账号权益。');
  return fail('QCC_UPSTREAM','企查查未成功返回结果，请稍后检查官方服务；未自动重试。');
}
function rpcResult(envelope:any,id:string):unknown {
  if(!envelope||envelope.jsonrpc!=='2.0'||envelope.id!==id)return fail('QCC_RESPONSE','企查查响应与请求不匹配。');
  if(envelope.error)upstreamError(envelope.error);
  if(!Object.hasOwn(envelope,'result'))return fail('QCC_RESPONSE','企查查响应缺少结果。');
  if(envelope.result?.isError)upstreamError(envelope.result);
  return envelope.result;
}
function parseJson(text:string):any {try{return JSON.parse(text);}catch{return fail('QCC_RESPONSE','企查查返回了无法识别的响应。');}}
async function readRpc(response:Response,id:string):Promise<unknown> {
  if(!response.body)return fail('QCC_RESPONSE','企查查返回了空响应。');
  const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,buffer='';
  const sse=response.headers.get('content-type')?.includes('text/event-stream');
  try{
    while(true){
      const {done,value}=await reader.read();
      if(value){bytes+=value.length;if(bytes>2*1024*1024)return fail('QCC_RESPONSE_TOO_LARGE','企查查结果超过 2 MB，请缩小查询范围。');}
      buffer+=decoder.decode(value,{stream:!done});
      if(sse){
        let end:RegExpExecArray|null;
        while((end=/\r?\n\r?\n/.exec(buffer))||done&&buffer){
          const event=end?buffer.slice(0,end.index):buffer;buffer=end?buffer.slice(end.index+end[0].length):'';
          const data=event.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');
          if(!data||data==='[DONE]')continue;
          const envelope=parseJson(data);
          if(envelope.id===id)return rpcResult(envelope,id); // Don't wait for an SSE connection to close.
        }
      }
      if(done)break;
    }
    if(sse)return fail('QCC_RESPONSE','企查查未返回本次查询的结果。');
    return rpcResult(parseJson(buffer),id);
  }finally{void reader.cancel().catch(()=>{});}
}
function extractData(result:any):unknown {
  let data:unknown;
  if(result?.structuredContent!==undefined)data=result.structuredContent;
  else if(Array.isArray(result?.content)){
    const texts=result.content.filter((c:any)=>c.type==='text'&&typeof c.text==='string').map((c:any)=>{try{return JSON.parse(c.text);}catch{return c.text;}});
    if(!texts.length)return fail('QCC_RESPONSE','企查查没有返回可读取的企业信息。');
    data=texts.length===1?texts[0]:texts;
  }else return fail('QCC_RESPONSE','企查查返回了无法识别的工具结果。');
  for(const item of Array.isArray(data)?data:[data]){
    if(item&&typeof item==='object'){
      const value=item as Record<string,unknown>;
      if(value.success===false||value.error||value.isError===true||value.status==='error'||value.status==='failed'||(value.code!==undefined&&![0,200,'0','200','0000','10000'].includes(value.code as never)))upstreamError(value);
    }
  }
  return data;
}
export function createQccClient(key:string,{fetcher=fetch,timeout=30000}:{fetcher?:typeof fetch;timeout?:number}={}){
  const secret=normalizeKey(key);
  async function rpc(method:string,params:unknown){
    const id=randomUUID();
    try{
      const response=await fetcher(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeout),headers:{Authorization:'Bearer '+secret,Accept:'application/json, text/event-stream','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
      if(!response.ok){void response.body?.cancel().catch(()=>{});upstreamError(null,response.status);}
      const result=await readRpc(response,id);
      // Defense against accidental echoes even in an otherwise successful response.
      return JSON.parse(JSON.stringify(result).split(secret).join('[REDACTED]'));
    }catch(e){
      if(e instanceof CompanyError)throw e;
      if((e as Error).name==='TimeoutError'||(e as Error).name==='AbortError')return fail('QCC_TIMEOUT','企查查请求超时；未自动重试，避免重复计费。');
      return fail('QCC_NETWORK','无法连接企查查，请检查网络后重试。');
    }
  }
  return {async run(input:CompanyRequest){
    const request=validateRequest(input);
    if(request.action==='status')return connectionStatus(true,'provided');
    if(request.action==='check'){
      const result=await rpc('tools/list',{}) as any;
      if(!Array.isArray(result?.tools))return fail('QCC_RESPONSE','企查查未返回有效的工具列表。');
      const available=new Set(result.tools.map((tool:any)=>tool.name));
      const expected=['get_company_by_query',...Object.values(sections).map(s=>s.tool)];
      const missing=expected.filter(name=>!available.has(name));
      return {provider:'qcc',connected:true,checked_at:new Date().toISOString(),available_tools:expected.filter(name=>available.has(name)),missing_tools:missing,verification:'tools/list（未执行企业查询）'};
    }
    const section=request.action==='inspect'?(request.section??'registration') as keyof typeof sections:undefined;
    const tool=section?sections[section].tool:'get_company_by_query';
    const result=await rpc('tools/call',{name:tool,arguments:{searchKey:request.query}});
    return {provider:'qcc',source_url:endpoint,fetched_at:new Date().toISOString(),tool,query:request.query,...(section?{section}:{}),result:extractData(result),...(request.action==='search'?{next_action:'多候选时展示候选主体并请用户确认；不得自动选择第一项。已明确主体后用公司全称或统一社会信用代码执行 company inspect。'}:{})};
  }};
}

type Handler=(request:CompanyRequest)=>Promise<unknown>;
let handler:Handler|undefined;
export function setCompanyHandler(value:Handler){handler=value;}
export async function runCompany(input:CompanyRequest){
  const request=validateRequest(input);
  if(handler)return handler(request);
  const key=process.env.QCC_API_KEY;
  if(request.action==='status')return connectionStatus(Boolean(key?.trim()),key?.trim()?'environment':'none');
  if(!key?.trim())return fail('QCC_NOT_CONFIGURED','尚未配置企查查。桌面版请到设置 → 外部服务填写 API Key；npm 版使用 QCC_API_KEY 环境变量。');
  return createQccClient(key).run(request);
}
