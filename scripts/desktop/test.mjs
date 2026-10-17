import {mkdir,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ensureElectron,prepare,root,stage,run} from './prepare.mjs';
const require=createRequire(import.meta.url);await ensureElectron();
const args=process.argv.slice(2),packaged=args[0]==='--app'?args[1]:null;
if(!packaged)await prepare();
const directory=path.join(root,'.cache/desktop-test-'+Date.now());await mkdir(directory,{recursive:true});
const output=path.join(directory,'report.json');
const env={...process.env,CAREER_DESKTOP_USER_DATA:directory};delete env.ELECTRON_RUN_AS_NODE;
// Hosted Intel Macs have no usable GPU. Exercise rendering in software during the
// synthetic test only; normal application launches retain hardware acceleration.
try{run(packaged??require('electron'),[...(packaged?[]:[stage]),'--disable-gpu','--career-smoke',output],{env,timeout:180000,killSignal:'SIGKILL'});}
catch(error){
 const report=await readFile(output,'utf8').then(JSON.parse).catch(()=>null);
 if(report?.error)throw new Error(report.error,{cause:error});
 throw error;
}
const report=JSON.parse(await readFile(output,'utf8'));if(!report.ok)throw new Error(report.error);
// Reuse only this run's synthetic registry in a fresh process. This exercises
// application startup itself, independently of the in-process smoke helpers.
const startupOutput=path.join(directory,'startup-report.json');
try{run(packaged??require('electron'),[...(packaged?[]:[stage]),'--disable-gpu','--career-smoke',startupOutput,'--career-smoke-startup'],{env,timeout:60000,killSignal:'SIGKILL'});}
catch(error){
 const startup=await readFile(startupOutput,'utf8').then(JSON.parse).catch(()=>null);
 if(startup?.error)throw new Error(startup.error,{cause:error});
 throw error;
}
const startup=JSON.parse(await readFile(startupOutput,'utf8'));if(!startup.ok)throw new Error(startup.error);
console.log(JSON.stringify({...report,coldStart:startup,evidence:directory},null,2));
