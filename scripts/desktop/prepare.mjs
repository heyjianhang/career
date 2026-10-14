import {readFile,writeFile,mkdir,rm,cp,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
export const stage=path.join(root,'.cache/desktop-app');
export function run(command,args,options={}){const result=spawnSync(command,args,{cwd:root,stdio:'inherit',...options});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${command} 退出：${result.signal??result.status}`);return result;}
export function npm(args,options={}){const cli=process.env.npm_execpath;if(!cli)throw new Error('请使用 npm run desktop:* 执行构建');return run(process.execPath,[cli,...args],options);}
export async function ensureElectron(){
 try{await access(path.join(root,'node_modules/electron/path.txt'));}catch{run(process.execPath,[path.join(root,'node_modules/electron/install.js')],{env:{...process.env,electron_config_cache:path.join(root,'.cache/electron')}});}
}
export async function prepare(){
 npm(['run','build']);
 const packed=npm(['pack','--dry-run','--ignore-scripts','--json'],{encoding:'utf8',stdio:['ignore','pipe','inherit']});
 const [{files}]=JSON.parse(packed.stdout);
 await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
 await cp(path.join(root,'desktop'),stage,{recursive:true});
 const runtime=path.join(stage,'runtime');await mkdir(runtime,{recursive:true});
 for(const file of ['package.json','package-lock.json'])await cp(path.join(root,file),path.join(runtime,file));
 npm(['ci','--prefix',runtime,'--omit=dev','--ignore-scripts','--no-audit','--no-fund']);
 const core=path.join(runtime,'node_modules/@heyjianhang/career');await mkdir(core,{recursive:true});
 for(const {path:file} of files){if(file.startsWith('..')||path.isAbsolute(file))throw new Error('Invalid package path');await mkdir(path.dirname(path.join(core,file)),{recursive:true});await cp(path.join(root,file),path.join(core,file));}
 await cp(path.join(root,'LICENSE'),path.join(stage,'LICENSE'));
 // npm is only a build-time tool. The payload ships the CLI and locked production modules.
 await rm(path.join(runtime,'package.json'));await rm(path.join(runtime,'package-lock.json'));
 await writeFile(path.join(stage,'build-info.json'),JSON.stringify({schema:'career-desktop-build/v1',desktop:JSON.parse(await readFile(path.join(root,'desktop/package.json'),'utf8')).version,core:JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version,files:files.length},null,2));
 return stage;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await prepare();
