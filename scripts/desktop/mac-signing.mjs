import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdtemp,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const previewEntitlements=fileURLToPath(new URL('../../desktop/assets/entitlements.preview.plist',import.meta.url));

export function macSigningOptions(developerId=false){
 return developerId
  ? {hardenedRuntime:true,notarize:true}
  : {identity:'-',hardenedRuntime:true,notarize:false,entitlements:previewEntitlements,entitlementsInherit:previewEntitlements};
}

// This verifies bundle integrity, not Gatekeeper approval. A preview still needs
// the user's explicit permission on first launch after a browser download.
export function verifyMacBundle(appPath,{developerId=false}={}){
 const execute=(args)=>execFileSync('/usr/bin/codesign',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 try{
  execute(['--verify','--deep','--strict','--verbose=2',appPath]);
  // codesign writes its display output to stderr, even on success.
  const display=spawnSync('/usr/bin/codesign',['--display','--verbose=4',appPath],{encoding:'utf8'});
  if(display.error)throw display.error;
  if(display.status!==0)throw new Error(display.stderr||'无法读取签名');
  const details=display.stderr;
  if(!/^Sealed Resources version=/m.test(details))throw new Error('应用资源没有完整签名');
  if(developerId&&!/^Authority=Developer ID Application:/m.test(details))throw new Error('正式构建缺少 Developer ID Application 签名');
  if(!developerId&&!/^Signature=adhoc$/m.test(details))throw new Error('预览构建未使用预期的临时签名');
  return {app:appPath,integrity:'verified',signing:developerId?'developer-id':'ad-hoc',gatekeeper:developerId?'requires-separate-assessment':'requires-user-approval'};
 }catch(error){
  throw new Error(`Mac 应用签名校验失败：${appPath}\n${error.stderr?.toString().trim()||error.message}`,{cause:error});
 }
}

export async function verifyMacDiskImage(imagePath,options={}){
 const image=path.resolve(imagePath);
 const mount=await mkdtemp(path.join(tmpdir(),'career-installer-check-'));
 let attached=false;
 try{
  execFileSync('/usr/bin/hdiutil',['verify',image],{stdio:'pipe'});
  execFileSync('/usr/bin/hdiutil',['attach','-readonly','-nobrowse','-noautoopen','-mountpoint',mount,image],{stdio:'pipe'});
  attached=true;
  const {app,...signature}=verifyMacBundle(path.join(mount,'career.app'),options);
  return {image,...signature};
 }finally{
  if(attached)execFileSync('/usr/bin/hdiutil',['detach',mount],{stdio:'pipe'});
  await rmdir(mount);
 }
}
