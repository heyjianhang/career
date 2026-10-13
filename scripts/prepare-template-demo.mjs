import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {hash} from '../dist/presentation/io.js';
import {prepareDemo} from './prepare-presentation-demo.mjs';

// This opt-in developer demo only creates a new directory; never touches user packages.
const workspace=path.resolve(process.argv[2]??'.cache/template-demo-'+Date.now());
await mkdir(workspace);
await prepareDemo(workspace);
const portrait=await readFile(new URL('../examples/presentation/assets/demo-portrait.jpg',import.meta.url));
await mkdir(path.join(workspace,'assets'));
await writeFile(path.join(workspace,'assets/demo-portrait.jpg'),portrait,{flag:'wx'});
const full=path.join(workspace,'resume/presentations/resume-demo-ai/package.json');
const data=JSON.parse(await readFile(full,'utf8'));
data.resume.photo={path:'assets/demo-portrait.jpg',sha256:hash(portrait),alt:'虚构示例人物插画',position:{x:50,y:35}};
await writeFile(full,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({workspace,synthetic:true,photo:'full only; brief has no photo'}));
