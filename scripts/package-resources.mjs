import {mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
const out='resources/workspace';
await rm('resources',{recursive:true,force:true});
await mkdir(out+'/docs',{recursive:true});
await cp('templates/workspace',out,{recursive:true});
// npm excludes .gitignore even inside included directories. Restore its name at setup.
await cp(out+'/.gitignore',out+'/gitignore.template');
await rm(out+'/.gitignore');
// Maintainer Skills stay in the development repository. Match package.json files.
for(const name of ['career-setup','career-git','career-intake','career-employment','career-project','resume-master','resume-tailor','career-board']){
 await cp('.agents/skills/'+name,out+'/.agents/skills/'+name,{recursive:true});
}
await cp('schemas',out+'/schemas',{recursive:true});
await mkdir(out+'/examples/presentation',{recursive:true});
await cp('examples/presentation/package.json',out+'/examples/presentation/package.json');
for(const file of ['data-model.md','context-protocol.md','agent-workflow.md','career-assets.md','installation.md','opportunities.md','resume-packages.md']){
 let text=await readFile('docs/'+file,'utf8');
 if(file==='context-protocol.md')text=text.replace(/^.*\]\((?:context\.md|decisions\/)\).*\n/gm,'');
 await writeFile(out+'/docs/'+file,text);
}
await writeFile(out+'/docs/presentation.md','# 简历成果页契约\n\n使用 `npm run career -- resume schema --json` 读取当前工具的真实 Schema；字段规则用 `resume platforms`，样式用 `resume themes`。\n\n完整执行方法见 [CLI 操作](../.agents/skills/resume-tailor/references/cli.md)。内容在 resume/presentations，预览在 build；个人资料与照片不会上传到 npm。\n');
