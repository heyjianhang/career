import {mkdir, copyFile, chmod, cp} from 'node:fs/promises';
await mkdir('dist/presentation', {recursive: true});
await copyFile('src/presentation/styles.css', 'dist/presentation/styles.css');
await copyFile('src/presentation/SHELL-ICONS-LICENSE', 'dist/presentation/SHELL-ICONS-LICENSE');
await chmod('dist/cli.js', 0o755);
await cp('src/presentation/templates', 'dist/presentation/templates', {recursive:true, filter:source=>!source.endsWith('.ts')});

await mkdir('dist/board', {recursive:true});
await copyFile('src/board/styles.css','dist/board/styles.css');
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
