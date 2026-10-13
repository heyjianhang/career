import {lstat, mkdir, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const defaultWorkspace = process.cwd();

export function args(argv, names) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (!names.includes(name) || out[name] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error(`参数无效：${name}；支持 ${names.join('、')}，每个参数需要一个值`);
    }
    out[name] = argv[++i];
  }
  return out;
}

// Reject existing symlinks before following any component of a managed path.
export async function noLinks(target) {
  const absolute = path.resolve(target);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`不跟随符号链接：${current}`);
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}

export async function directory(target) {
  await noLinks(target);
  await mkdir(target, {recursive: true});
}

export async function walk(dir) {
  await noLinks(dir);
  let entries;
  try { entries = await readdir(dir, {withFileTypes: true}); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`不跟随符号链接：${file}`);
    if (entry.isDirectory()) result.push(...await walk(file));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}

export function isMain(url) { return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(url); }
