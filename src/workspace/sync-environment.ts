import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import os from 'node:os';
import {available,run,executable,SetupError} from './process.js';
export async function syncEnvironment(checkLogin=true){
 const [git,gh]=await Promise.all([available('git'),available('gh')]);let authenticated=false;
 if(gh&&checkLogin)try{await run('gh',['auth','status','--hostname','github.com','--active'],os.homedir(),15_000);authenticated=true;}catch{}
 const platform=process.platform;
 return {platform,git,gh,authenticated,ready:Boolean(git&&gh&&authenticated),git_url:'https://git-scm.com/install/'+(platform==='win32'?'windows':platform==='darwin'?'mac':'linux'),gh_url:'https://cli.github.com/',message:!git?'安装 Git 后即可启用同步；本机资料仍可照常使用。':!gh?'还需安装 GitHub CLI，用于登录你的私人仓库。':!authenticated?'请登录 GitHub；登录验证在官方页面完成。':'同步环境已准备好'};
}
let login:{status:'pending'|'success'|'error';code?:string;message?:string}|undefined;
let child:ChildProcessWithoutNullStreams|undefined;
export function loginStatus(){return login??{status:'idle'};}
export async function startLogin(){
 if(login?.status==='pending')return login;
 login={status:'pending'};
 if(!await available('gh')){login={status:'error',message:'请先安装 GitHub CLI，再点击重新检测。'};throw new SetupError('DEPENDENCY_MISSING',login.message!);}
 const env={...process.env};delete env.GH_PROMPT_DISABLED;
 child=spawn(await executable('gh'),['auth','login','--hostname','github.com','--git-protocol','https','--web','--skip-ssh-key'],{env,stdio:'pipe',windowsHide:true});
 // Keep only the public one-time device code, never raw output or access tokens.
 let buffer='';const capture=(chunk:Buffer)=>{buffer=(buffer+String(chunk)).slice(-4096);const code=buffer.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/);if(code&&login?.status==='pending')login.code=code[0];};
 child.stdout.on('data',capture);child.stderr.on('data',capture);child.stdin.on('error',()=>{});child.stdin.end('\n');
 const timeout=setTimeout(()=>child?.kill(),300_000);timeout.unref();
 child.on('error',()=>{login={status:'error',message:'无法启动 GitHub 登录，请安装后重新检测。'};});
 child.on('close',code=>{clearTimeout(timeout);login=code===0?{status:'success'}:{status:'error',message:'登录未完成或已超时，请重新登录。'};child=undefined;});
 return login;
}
export function stopLogin(){child?.kill();}
