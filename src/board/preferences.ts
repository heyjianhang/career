import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {noSymlinks} from '../presentation/io.js';
import {config,withLock} from '../workspace/setup.js';

const relative='.local/ui-preferences.json';
export async function preferences(workspace:string):Promise<Record<string,any>>{
  await config(workspace);const file=path.join(workspace,relative);await noSymlinks(file);
  try{const data=JSON.parse(await readFile(file,'utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('界面设置文件应为 JSON 对象');return data;}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e;}
}
export async function savePreferences(workspace:string,width:unknown){
  if(typeof width!=='number'||!Number.isFinite(width)||width<480||width>1920)throw new Error('抽屉宽度应为 480–1920 像素');
  return withLock(workspace,async()=>{
    const old=await preferences(workspace);
    if(old.board!==undefined&&(!old.board||typeof old.board!=='object'||Array.isArray(old.board)))throw new Error('board 界面设置应为对象');
    const next={...old,board:{...old.board,drawer_width:Math.round(width)}};
    const file=path.join(workspace,relative);await noSymlinks(file);await mkdir(path.dirname(file),{recursive:true});
    const temp=file+'.'+randomUUID()+'.tmp';try{await writeFile(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});await rename(temp,file);}finally{await rm(temp,{force:true});}
    return next;
  });
}
