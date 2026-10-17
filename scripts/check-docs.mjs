import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'yaml';
import {readBootstrap} from './bootstrap.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const ignored=new Set(['node_modules','.git','.cache','.local','dist','resources','build','release','outputs','coverage']);
async function markdownFiles(dir){
 // The user-entry template's links are checked in resources and the installed workspace.
 if(dir===path.join(root,'workspace')||dir===path.join(root,'templates/workspace'))return [];
 const files=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(ignored.has(entry.name)||entry.isSymbolicLink())continue;
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())files.push(...await markdownFiles(file));
  else if(entry.isFile()&&file.endsWith('.md'))files.push(file);
 }
 return files;
}

// Shared with the real-package smoke check: resolve references from their installed paths.
export async function checkDocumentation(directory){
 const files=await markdownFiles(directory),errors=[];
 let links=0,skills=0;
 for(const file of files){
  const text=await readFile(file,'utf8');
  if(path.basename(file)==='SKILL.md'){
   const header=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
   assert.ok(header,`${file}: missing Skill frontmatter`);
   const metadata=parse(header[1]);
   assert.equal(metadata.name,path.basename(path.dirname(file)),`${file}: Skill name must match directory`);
   assert.match(metadata.name,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
   assert.ok(metadata.name.length<=64&&typeof metadata.description==='string'&&metadata.description.trim().length>0&&metadata.description.length<=1024,`${file}: invalid Skill metadata`);
   skills++;
  }
  // Examples in fenced code blocks aren't document navigation.
  const prose=text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm,'');
  for(const match of prose.matchAll(/\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)){
   const href=match[1]??match[2];
   if(href.startsWith('#')||/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href))continue;
   const target=decodeURIComponent(href.split(/[?#]/)[0]);
   if(!target)continue;
   links++;
   if(path.isAbsolute(target)||!await stat(path.resolve(path.dirname(file),target)).catch(()=>null))errors.push(`${path.relative(directory,file)} → ${href}`);
  }
 }
 assert.equal(errors.length,0,`Broken relative references:\n${errors.join('\n')}`);
 return {markdown:files.length,skills,links};
}

async function main(){
 const source=await checkDocumentation(root);
 const installed=await checkDocumentation(path.join(root,'resources/workspace'));
 assert.equal(source.skills,14);assert.equal(installed.skills,13);
 const readme=await readFile(path.join(root,'README.md'),'utf8');
 const installation=await readFile(path.join(root,'docs/installation.md'),'utf8');
 const page=await readFile(path.join(root,'docs/get-started.html'),'utf8');
 const prompt=readme.match(/```text\n([\s\S]*?)\n```/)[1];
 assert.equal(installation.match(/```text\n([\s\S]*?)\n```/)[1],prompt,'Installation prompt differs from README');
 const htmlPrompt=page.match(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/)[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 assert.equal(htmlPrompt,prompt,'Copy page prompt differs from README');
 assert.equal((await readBootstrap()).prompt,prompt);
 console.log(JSON.stringify({source,installed,bootstrap:'consistent'}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
