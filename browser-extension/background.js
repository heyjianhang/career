import {createStore} from './store.js';
const store=createStore(chrome.storage.local);
// Only extension-owned UI can read/write history. Pages have no message bridge.
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('')))return false;
  (async()=>{
    switch(message?.type){
      case 'list':return await store.list();
      case 'save':return await store.save(message.clip,message.expected);
      case 'copied':return await store.copied(message.id,message.revision);
      default:throw new Error('不支持的操作。');
    }
  })().then(data=>respond({ok:true,data}),error=>respond({ok:false,error:error.message||'操作未完成，请重试。'}));
  return true;
});
