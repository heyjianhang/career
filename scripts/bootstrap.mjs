import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
export const installUrl='https://raw.githubusercontent.com/heyjianhang/career/main/install.md';

// The short prompt stays stable; release-specific commands live in the installation guide.
export async function readBootstrap(){
  const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  const readme=await readFile(path.join(root,'README.md'),'utf8');
  const prompt=readme.match(/```text\r?\n([\s\S]*?)\r?\n```/)?.[1];
  assert.equal(prompt,`请读取 ${installUrl}，按指引帮我安装并初始化 career。`,'Bootstrap must point to the stable installation guide');
  const guide=await readFile(path.join(root,'install.md'),'utf8');
  const index=await readFile(path.join(root,'llms.txt'),'utf8');
  assert.ok(guide.includes(`--package ${pkg.name}@${pkg.version} career setup --workspace`),'Installation guide package or version is stale');
  assert.ok(index.includes(`](${installUrl})`),'llms.txt must link to the installation guide');
  return {pkg,prompt,guide,index};
}
