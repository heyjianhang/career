import {mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
const out='resources/workspace';
await rm('resources',{recursive:true,force:true});
await mkdir(out+'/docs',{recursive:true});
await cp('templates/workspace',out,{recursive:true});
// npm/electron-builder filter Git dotfiles even inside included directories.
// Ship them under resource names and restore the user-facing names at setup.
for(const name of ['gitignore','gitattributes']){
 await cp(out+'/.'+name,out+'/'+name+'.template');
 await rm(out+'/.'+name);
}
// Maintainer Skills stay in the development repository. Match package.json files.
for(const name of ['career-setup','career-git','career-intake','career-employment','career-project','resume-master','resume-tailor','career-board','career-company','career-match','career-outreach','career-discovery','boss-zhipin-scraper','jd-research']){
 await cp('.agents/skills/'+name,out+'/.agents/skills/'+name,{recursive:true});
}
await cp('schemas',out+'/schemas',{recursive:true});
for(const file of ['data-model.md','context-protocol.md','agent-workflow.md','career-assets.md','installation.md','opportunities.md','resume-packages.md','plans/ai-models-jd-import.md']){
 let text=await readFile('docs/'+file,'utf8');
 if(file==='context-protocol.md')text=text.replace(/^.*\]\((?:context\.md|decisions\/)\).*\n/gm,'');
 await mkdir(out+'/docs/'+file.split('/').slice(0,-1).join('/'),{recursive:true});
 await writeFile(out+'/docs/'+file,text);
}
await writeFile(out+'/docs/presentation.md','# 简历成果页契约\n\n使用 `npm run career -- resume schema --json` 读取当前工具的真实 Schema；字段规则用 `resume platforms`，样式用 `resume themes`。\n\n完整执行方法见 [CLI 操作](../.agents/skills/resume-tailor/references/cli.md)。内容在 resume/presentations，预览在 build；个人资料与照片不会上传到 npm。\n');
