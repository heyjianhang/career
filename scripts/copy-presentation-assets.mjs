import {mkdir, copyFile, chmod, cp, readFile, writeFile} from 'node:fs/promises';
await mkdir('dist/presentation', {recursive: true});
// Each workbench embeds shell.js and shared styles. tsc recreates shell.js before
// this step, so the desktop update UI is bundled exactly once; welcome imports it.
await copyFile('src/presentation/updates.css','dist/presentation/updates.css');
await writeFile('dist/presentation/styles.css',(await readFile('src/presentation/styles.css','utf8'))+'\n'+await readFile('src/presentation/updates.css','utf8')+'\n'+await readFile('src/presentation/select.css','utf8')+'\n'+await readFile('src/presentation/models.css','utf8'));
await writeFile('dist/presentation/shell.js',(await readFile('dist/presentation/model-catalog.js','utf8'))+'\n'+(await readFile('dist/presentation/select.js','utf8'))+'\n'+(await readFile('dist/presentation/models.js','utf8'))+'\n'+(await readFile('dist/presentation/updates.js','utf8'))+'\n'+await readFile('dist/presentation/shell.js','utf8'));
await copyFile('src/presentation/SHELL-ICONS-LICENSE', 'dist/presentation/SHELL-ICONS-LICENSE');
await chmod('dist/cli.js', 0o755);
await cp('src/presentation/templates', 'dist/presentation/templates', {recursive:true, filter:source=>!source.endsWith('.ts')});

await mkdir('dist/board', {recursive:true});
await writeFile('dist/board/styles.css',(await readFile('src/board/styles.css','utf8'))+'\n'+await readFile('src/board/jd-import.css','utf8'));
await copyFile('src/board/icons.json','dist/board/icons.json');
await copyFile('src/board/ICONS-LICENSE','dist/board/ICONS-LICENSE');
await mkdir('dist/board/pdf',{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])await copyFile('node_modules/pdfjs-dist/build/'+name,'dist/board/pdf/'+name);
for(const name of ['cmaps','standard_fonts','wasm'])await cp('node_modules/pdfjs-dist/'+name,'dist/board/pdf/'+name,{recursive:true});
await copyFile('node_modules/pdfjs-dist/LICENSE','dist/board/pdf/LICENSE');
await mkdir('dist/resumes',{recursive:true});
await copyFile('src/resumes/styles.css','dist/resumes/styles.css');

await mkdir('dist/profile',{recursive:true});
await copyFile('src/profile/styles.css','dist/profile/styles.css');

await cp('src/presentation/assets/models','dist/presentation/assets/models',{recursive:true});
