import {mkdir, copyFile, chmod, cp} from 'node:fs/promises';
await mkdir('dist/presentation', {recursive: true});
await copyFile('src/presentation/styles.css', 'dist/presentation/styles.css');
await chmod('dist/cli.js', 0o755);
await cp('src/presentation/templates', 'dist/presentation/templates', {recursive:true, filter:source=>!source.endsWith('.ts')});
