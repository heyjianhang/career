import {createRequire} from 'node:module';
import path from 'node:path';
import {ensureElectron,root,run} from './prepare.mjs';
const require=createRequire(import.meta.url);await ensureElectron();
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
run(require('electron'),[path.join(root,'scripts/desktop/icons.cjs')],{env,timeout:30000});
