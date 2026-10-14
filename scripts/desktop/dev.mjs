import {createRequire} from 'node:module';
import {ensureElectron,prepare,stage,run} from './prepare.mjs';
const require=createRequire(import.meta.url);await ensureElectron();await prepare();
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
run(require('electron'),[stage],{env});
