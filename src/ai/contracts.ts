import {Ajv} from 'ajv';
export type ProviderKind = 'bailian'|'deepseek'|'volcengine'|'compatible';
export type ModelUse = 'text'|'vision'|'speech';
export type ModelModality = 'language'|'speech';
export type Provider = {id:string;name:string;kind:ProviderKind;baseURL:string;model:string;vision:boolean;method:'jsonMode'|'jsonSchema'|'functionCalling';modality?:ModelModality;serviceId?:string;enabled?:boolean;credentialReady?:boolean};
export type ModelService = {id:string;name:string;kind:ProviderKind;baseURL:string;speechURL:string;enabled:boolean;hasKey:boolean;hasSpeechKey?:boolean};
export function supportsUse(p:Provider,use:ModelUse){return p.enabled!==false && p.credentialReady!==false && (use==='speech'?p.modality==='speech':p.modality!=='speech'&&(use==='text'||p.vision));}
export function checkedService(value:unknown):Omit<ModelService,'hasKey'|'hasSpeechKey'> {
 const s=value as ModelService;
 if(!s||typeof s.enabled!=='boolean')throw new Error('服务配置无效。');
 const p=checkedProvider({...s,id:'',model:'connection',vision:false,method:'jsonMode',modality:'language'});
 if(s.id&&!/^service-[a-f0-9-]{36}$/.test(s.id))throw new Error('服务标识无效。');
 const speechURL=typeof s.speechURL==='string'?s.speechURL.trim():'';
 if(speechURL){let u:URL;try{u=new URL(speechURL);}catch{throw new Error('请填写完整的语音 WebSocket 地址。');}
 if(u.protocol!=='wss:'||u.username||u.password||u.search||u.hash)throw new Error('语音服务地址需要 wss://，且不能包含密钥或查询参数。');}
 return {id:s.id||'',name:p.name,kind:p.kind,baseURL:p.baseURL,speechURL,enabled:s.enabled};
}
export type ImageInput = {name:string;data:string};
export type JDInput = {text:string;images:ImageInput[]};
export type JDDraft = {company:string;title:string;location:string;salary:string;raw_text:string;warnings:string[]};
export const jdSchema = {type:'object',additionalProperties:false,properties:{company:{type:'string',maxLength:500},title:{type:'string',maxLength:500},location:{type:'string',maxLength:500},salary:{type:'string',maxLength:500},raw_text:{type:'string',maxLength:50000},warnings:{type:'array',maxItems:20,items:{type:'string',maxLength:1000}}},required:['company','title','location','salary','raw_text','warnings']};
const validate=new Ajv().compile(jdSchema);
export function checkedDraft(value:unknown):JDDraft {if(!validate(value))throw new Error('模型返回的字段不完整或格式不符合要求，请重试或手动填写。');return value as JDDraft;}
export function checkedProvider(value:unknown):Provider {
 const p=value as Provider;if(!p||!['bailian','deepseek','volcengine','compatible'].includes(p.kind)||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||typeof p.model!=='string'||!p.model.trim()||p.model.length>150||typeof p.vision!=='boolean'||!['jsonMode','jsonSchema','functionCalling'].includes(p.method))throw new Error('请填写服务名称、模型和输出方式。');
 let u:URL;try{u=new URL(p.baseURL);}catch{throw new Error('请填写完整的 API Base URL。');}
 if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw new Error('服务地址需要 HTTPS；本机服务可使用 http://127.0.0.1。地址中不能包含密钥或查询参数。');
 if(/\/(chat\/completions|responses)\/?$/.test(u.pathname))throw new Error('请填写 Base URL（通常以 /v1 结尾），不要包含 /chat/completions。');
 if(p.id&&!/^model-[a-f0-9-]{36}$/.test(p.id))throw new Error('模型标识无效。');
 if(p.modality!==undefined&&!['language','speech'].includes(p.modality))throw new Error('模型类型无效。');
 if(p.modality==='speech'&&(p.vision||!['bailian','volcengine'].includes(p.kind)))throw new Error('实时语音配置支持百炼和火山语音；请勿把语音模型设为图片模型。');
 return {id:p.id||'',name:p.name.trim(),kind:p.kind,baseURL:u.toString().replace(/\/$/,''),model:p.model.trim(),vision:p.vision,method:p.method,...(p.modality?{modality:p.modality}:{}),...(p.serviceId?{serviceId:p.serviceId}: {})};
}
export function checkedInput(value:unknown):JDInput {
 const v=value as JDInput;if(!v||typeof v.text!=='string'||v.text.length>50000||!Array.isArray(v.images)||v.images.length>4)throw new Error('每次导入一个岗位，文字最多 5 万字，图片最多 4 张。');
 let total=0;const images=v.images.map(i=>{
  if(!i||typeof i.name!=='string'||i.name.length>255||typeof i.data!=='string'||i.data.length>6*1024*1024)throw new Error('图片无效或超过 4 MiB。');
  const m=i.data.match(/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/);if(!m)throw new Error('仅支持 PNG、JPEG、WebP 图片。');
  const b=Buffer.from(m[2]!,'base64');total+=b.length;
  const valid=m[1]==='png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?b[0]===255&&b[1]===216&&b[2]===255:b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';
  if(!valid||b.length>4*1024*1024||total>12*1024*1024)throw new Error('图片格式不符，或超过每张 4 MiB / 合计 12 MiB。');
  return {name:i.name,data:i.data};
 });
 if(!v.text.trim()&&!images.length)throw new Error('请粘贴职位描述或添加截图。');
 return {text:v.text,images};
}
