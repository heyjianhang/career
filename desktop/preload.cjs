const {contextBridge,ipcRenderer}=require('electron');
const invoke=async(name,...args)=>{const response=await ipcRenderer.invoke('career:'+name,...args);if(!response.ok)throw new Error(response.error);return response.value;};
contextBridge.exposeInMainWorld('careerDesktop',Object.freeze({
 commandPrefix:process.platform==='win32'?'& .\\.local\\career.cmd':'./.local/career',
 state:()=>invoke('state'),chooseDirectory:directory=>invoke('chooseDirectory',directory),
 createWorkspace:details=>invoke('createWorkspace',details),openWorkspace:directory=>invoke('openWorkspace',directory),
 handoff:()=>invoke('handoff'),copyPrompt:directory=>invoke('copyPrompt',directory),reveal:directory=>invoke('reveal',directory),navigate:url=>invoke('navigate',url)
}));
