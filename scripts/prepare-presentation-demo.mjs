import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Two selections of the existing synthetic material demonstrate switching.
export async function prepareDemo(workspace) {
  const full=JSON.parse(await readFile(new URL('../examples/presentation/package.json',import.meta.url),'utf8'));
  const brief=structuredClone(full);brief.id='resume-demo-brief';brief.title='AI 应用开发 · 精简版';
  for(const section of brief.resume.sections)for(const item of section.items){item.paragraphs=item.paragraphs.slice(0,1);item.bullets=item.bullets.slice(0,1);}
  for(const report of Object.values(brief.reports))for(const section of report.sections)for(const field of section.fields)field.value=field.value.split('\n\n').slice(0,2).join('\n\n');
  for(const data of [full,brief]){
    const folder=path.join(workspace,'resume','presentations',data.id);await mkdir(folder,{recursive:true});
    try{await writeFile(path.join(folder,'package.json'),JSON.stringify(data,null,2)+'\n',{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await prepareDemo(path.resolve('.cache/demo-workspace'));
  console.log('已准备两份虚构演示简历；保留已存在的内容包。');
}
