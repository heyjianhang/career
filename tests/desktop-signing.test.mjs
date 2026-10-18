import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {macSigningOptions,verifyMacBundle} from '../scripts/desktop/mac-signing.mjs';

test('preview signing is explicit and never submits to Apple; Developer ID uses its own settings',()=>{
 const preview=macSigningOptions();
 assert.equal(preview.identity,'-');
 assert.equal(preview.notarize,false);
 assert.equal(preview.hardenedRuntime,true);
 assert.equal(preview.entitlements,preview.entitlementsInherit);
 const formal=macSigningOptions(true);
 assert.equal(formal.notarize,true);
 assert.equal(formal.hardenedRuntime,true);
 assert.equal(formal.identity,undefined);
 assert.equal(formal.entitlements,undefined);
});

test('real bundle verification rejects unsigned or modified resources and distinguishes Developer ID',{skip:process.platform!=='darwin'},async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'career-signing-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const app=path.join(directory,'Synthetic.app'),contents=path.join(app,'Contents');
 await mkdir(path.join(contents,'MacOS'),{recursive:true});
 await mkdir(path.join(contents,'Resources'));
 const binary=path.join(contents,'MacOS','synthetic'),resource=path.join(contents,'Resources','example.txt');
 await copyFile('/usr/bin/true',binary);
 await writeFile(path.join(contents,'Info.plist'),'<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>top.career.signature-test</string><key>CFBundleExecutable</key><string>synthetic</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>');
 await writeFile(resource,'Synthetic signing fixture');
 execFileSync('/usr/bin/codesign',['--remove-signature',binary]);
 assert.throws(()=>verifyMacBundle(app),/签名校验失败/);
 execFileSync('/usr/bin/codesign',['--force','--sign','-',app]);
 assert.equal(verifyMacBundle(app).integrity,'verified');
 assert.throws(()=>verifyMacBundle(app,{developerId:true}),/Developer ID Application/);
 await writeFile(resource,'Changed after signing');
 assert.throws(()=>verifyMacBundle(app),/签名校验失败/);
});
