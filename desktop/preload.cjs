const {contextBridge,ipcRenderer}=require('electron');
const invoke=async(name,...args)=>{const response=await ipcRenderer.invoke('career:'+name,...args);if(!response.ok)throw new Error(response.error);return response.value;};
contextBridge.exposeInMainWorld('careerDesktop',Object.freeze({
 updatesState:()=>invoke('updatesState'),updatesCheck:()=>invoke('updatesCheck'),updatesPreferences:value=>invoke('updatesPreferences',value),updatesClaimNotice:tag=>invoke('updatesClaimNotice',tag),updatesOpenDownload:tag=>invoke('updatesOpenDownload',tag),
 onUpdates:listener=>{const handler=(_event,state)=>listener(state);ipcRenderer.on('career:updates',handler);return ()=>ipcRenderer.removeListener('career:updates',handler);},
 aiStatus:()=>invoke('aiStatus'),aiSave:value=>invoke('aiSave',value),aiDefaults:value=>invoke('aiDefaults',value),aiRemove:id=>invoke('aiRemove',id),aiCheck:value=>invoke('aiCheck',value),aiExtract:value=>invoke('aiExtract',value),aiCancel:id=>invoke('aiCancel',id),
 commandPrefix:process.platform==='win32'?'& .\\.local\\career.cmd':'./.local/career',
 companyStatus:()=>invoke('companyStatus'),companySave:key=>invoke('companySave',key),companyCheck:()=>invoke('companyCheck'),companyRemove:()=>invoke('companyRemove'),
 syncEnvironment:()=>invoke('syncEnvironment'),syncLogin:()=>invoke('syncLogin'),syncLoginStatus:()=>invoke('syncLoginStatus'),
 state:()=>invoke('state'),chooseDirectory:directory=>invoke('chooseDirectory',directory),
 createWorkspace:details=>invoke('createWorkspace',details),openWorkspace:directory=>invoke('openWorkspace',directory),
 handoff:()=>invoke('handoff'),copyPrompt:directory=>invoke('copyPrompt',directory),copyText:text=>invoke('copyText',text),reveal:directory=>invoke('reveal',directory),navigate:url=>invoke('navigate',url)
}));
