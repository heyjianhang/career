// Synthetic browser bridge: no real credentials, user workspace, or external calls.
export function installAIBridge(){
 const load=()=>JSON.parse(sessionStorage.getItem('synthetic-models')||'{"services":[],"providers":[],"defaults":{"text":null,"vision":null,"speech":null},"secure_storage_available":true}');
 const save=s=>{sessionStorage.setItem('synthetic-models',JSON.stringify(s));return s;};let cancelled=false;
 const ready=(s,p)=>s.kind==='volcengine'&&p.modality==='speech'?s.hasSpeechKey:s.hasKey;
 const add=(state,p,s)=>{p={...p,id:p.id||'model-'+crypto.randomUUID(),name:s.name,kind:s.kind,baseURL:s.baseURL,enabled:s.enabled,credentialReady:!!ready(s,p),serviceId:s.id,tested:{}};state.providers=state.providers.filter(v=>v.id!==p.id).concat(p);if(p.credentialReady&&s.enabled){if(p.modality==='speech')state.defaults.speech||=p.id;else{state.defaults.text||=p.id;if(p.vision)state.defaults.vision||=p.id;}}return p;};
 const updateState={currentVersion:'0.3.0-alpha.15',platform:'darwin',arch:'arm64',automatic:false,preview:true,checking:false,lastChecked:null,latest:null,error:'',nextCheckAt:null,retryAt:null,publicVersion:null,publicChecked:null};
 window.careerDesktop={
 companyStatus:async()=>({configured:false,secure_storage_available:true}),
 updatesState:async()=>updateState,
 updatesCheck:async()=>updateState,
 updatesPreferences:async input=>Object.assign(updateState,input),
 updatesClaimNotice:async()=>false,
 onUpdates:()=>()=>{},
 aiStatus:async()=>load(),
 aiServiceSave:async input=>{const state=load(),old=state.services.find(s=>s.id===input.id);if(!old&&!input.key&&!(input.kind==='volcengine'&&input.speechKey))throw new Error('请输入 API Key');const s={id:old?.id||'service-'+crypto.randomUUID(),name:input.name,kind:input.kind,baseURL:input.baseURL,speechURL:input.speechURL,enabled:input.enabled,hasKey:!!(input.key||old?.hasKey),hasSpeechKey:!!(input.speechKey||old?.hasSpeechKey)};state.services=state.services.filter(v=>v.id!==s.id).concat(s);if(!old)for(const p of input.models||[])add(state,p,s);else state.providers=state.providers.map(p=>p.serviceId===s.id?{...p,enabled:s.enabled,credentialReady:!!ready(s,p)}:p);return save(state);},
 aiServiceRemove:async id=>{const state=load();state.services=state.services.filter(s=>s.id!==id);const ids=state.providers.filter(p=>p.serviceId===id).map(p=>p.id);state.providers=state.providers.filter(p=>!ids.includes(p.id));for(const use of ['text','vision','speech'])if(ids.includes(state.defaults[use]))state.defaults[use]=null;return save(state);},
 aiSave:async p=>{const state=load(),s=state.services.find(s=>s.id===p.serviceId);if(state.providers.some(m=>m.serviceId===s.id&&m.model===p.model))throw new Error('这个模型已添加。');add(state,p,s);return save(state);},
 aiDefaults:async d=>{const state=load();return save({...state,defaults:{...state.defaults,...d}});},
 aiRemove:async id=>{const state=load();state.providers=state.providers.filter(p=>p.id!==id);for(const use of ['text','vision','speech'])if(state.defaults[use]===id)state.defaults[use]=null;return save(state);},
 aiCheck:async input=>{const state=load(),p=state.providers.find(p=>p.id===input.id);if(p.modality==='speech')throw new Error('语音暂未接入');p.tested[input.vision?'vision':'text']='synthetic-test';save(state);return {text:true};},
 aiCancel:async()=>{cancelled=true;},
 aiExtract:async input=>{cancelled=false;await new Promise(r=>setTimeout(r,150));if(cancelled)throw new Error('已取消');return {company:'远山科技（合成）',title:'AI 应用工程师',location:'杭州',salary:'20–30K',raw_text:input.text||'招聘 AI 应用工程师\n开发企业 Agent，熟悉 MCP 和 RAG。',warnings:input.images.length?['截图中的福利文字较小，请核对原图。']:[]};}
 };
}
