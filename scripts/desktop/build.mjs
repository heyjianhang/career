import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {prepare,root,stage} from './prepare.mjs';
const require=createRequire(import.meta.url);
process.env.ELECTRON_BUILDER_CACHE??=path.join(root,'.cache/electron-builder');
const {build,Platform,Arch}=require('electron-builder');
const args=process.argv.slice(2),options={platform:process.platform==='darwin'?'mac':process.platform==='win32'?'win':'linux',arch:process.arch,dir:false};
for(let i=0;i<args.length;i++){if(args[i]==='--dir')options.dir=true;else if(['--platform','--arch'].includes(args[i]))options[args[i].slice(2)]=args[++i];else throw new Error('未知参数：'+args[i]);}
if(!['mac','win'].includes(options.platform))throw new Error('安装包支持 mac / win；请在对应操作系统上构建。');
if((options.platform==='mac'&&process.platform!=='darwin')||(options.platform==='win'&&process.platform!=='win32'))throw new Error('请在目标操作系统上构建安装包，或运行 GitHub Actions 桌面构建工作流。');
if(!['arm64','x64','all'].includes(options.arch))throw new Error('架构必须是 arm64、x64 或 all');
await prepare();
const electronVersion=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).devDependencies.electron;
const architectures=options.arch==='all'?[Arch.arm64,Arch.x64]:[Arch[options.arch]];
const output=path.join(root,'release/desktop');await mkdir(output,{recursive:true});
const artifacts=await build({targets:(options.platform==='mac'?Platform.MAC:Platform.WINDOWS).createTarget(options.dir?'dir':options.platform==='mac'?['dmg','zip']:['nsis'],...architectures),publish:'never',config:{
 appId:'top.heyjianhang.career',productName:'career',electronVersion,electronDownload:{cache:path.join(root,'.cache/electron')},forceCodeSigning:process.env.CAREER_DESKTOP_SIGN==='1',
 directories:{app:stage,output,buildResources:path.join(root,'desktop/assets')},
 asar:false,npmRebuild:false,files:['*.cjs','index.html','app.js','style.css','icon.svg','assets/**/*','LICENSE','package.json','build-info.json','runtime/node_modules/**/*','!node_modules/**/*'],
 artifactName:'career-${version}-${os}-${arch}.${ext}',
 mac:{category:'public.app-category.productivity',icon:'icon.icns',hardenedRuntime:true,...(process.env.CAREER_DESKTOP_SIGN==='1'?{notarize:true}:{identity:null})},
 win:{icon:'icon.ico'},nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,createDesktopShortcut:true,createStartMenuShortcut:true,shortcutName:'career',deleteAppDataOnUninstall:false,installerIcon:'icon.ico',uninstallerIcon:'icon.ico',installerHeaderIcon:'icon.ico'},
 dmg:{title:'career ${version}'},publish:null
}});
const hashes=[];for(const file of artifacts){try{hashes.push(createHash('sha256').update(await readFile(file)).digest('hex')+'  '+path.basename(file));}catch{}}
if(hashes.length)await writeFile(path.join(output,`SHA256SUMS-${options.platform}-${options.arch}.txt`),hashes.join('\n')+'\n');
if(hashes.length&&options.arch==='all'){
 for(const arch of ['arm64','x64'])await writeFile(path.join(output,`SHA256SUMS-${options.platform}-${arch}.txt`),hashes.filter(line=>line.includes(`-${arch}.`)).join('\n')+'\n');
}else if(hashes.length)await rm(path.join(output,`SHA256SUMS-${options.platform}-all.txt`),{force:true});
console.log(JSON.stringify({platform:options.platform,arch:options.arch,output,artifacts},null,2));
