import path from 'node:path';
import { readFile, writeFile, readdir, mkdir, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parseDocument, stringify } from 'yaml';
import { hash, noSymlinks } from '../presentation/io.js';
import { config } from '../workspace/setup.js';
import { fail, validate } from './validation.js';
import type { RecordFile, RecordKind, SchemaTypes } from './types.js';

export const limit = 2 * 1024 * 1024;

export const now = () => new Date().toISOString();

export const id = (prefix: string) => prefix + '-' + randomUUID();

export function validId(value: string, prefix = 'opp') {
  if (!new RegExp('^' + prefix + '-[a-z0-9-]{1,80}$').test(value)) fail('INVALID_ARGUMENT', '无效的 ' + prefix + ' ID');
  return value;
}

export function relative(value: string) {
  if (
    !value || value.length > 1000 || path.isAbsolute(value) ||
    value.includes('\\') || /[\x00-\x1f:<>"|?*]/.test(value) ||
    value.split('/').some(p =>
      !p || p === '.' || p === '..' || /[. ]$/.test(p) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)
    )
  ) {
    fail('INVALID_PATH', '使用目录内的相对路径，不允许跳出目录或跨系统特殊文件名');
  }
  return value;
}

export async function safe(w: string, p: string) {
  const file = path.join(w, relative(p));
  await noSymlinks(file);
  return file;
}

export async function existing(file: string, max = limit): Promise<Buffer | null> {
  await noSymlinks(file);
  try {
    const info = await stat(file);
    if (!info.isFile()) fail('INVALID_PATH', '需要普通文件：' + file);
    if (info.size > max) fail('FILE_TOO_LARGE', '文件超过读取限制：' + file);
    return await readFile(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export function digest(bytes: Buffer | null) {
  return bytes === null ? null : hash(bytes);
}

export async function ready(w: string) {
  await noSymlinks(w);
  await config(w);
  await noSymlinks(path.join(w, 'opportunities'));
}

export async function candidate(file: string): Promise<unknown> {
  const bytes = await existing(path.resolve(file));
  if (!bytes) fail('INPUT_MISSING', '输入文件不存在');
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    return fail('INVALID_RECORD', '输入必须是 JSON 对象');
  }
}

export function encode(meta: object, body: string) {
  return Buffer.from('---\n' + stringify(meta, {
    lineWidth: 0
  }) + '---\n' + body);
}

export function decode(bytes: Buffer, p: string) {
  const match = bytes.toString('utf8').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) fail('INVALID_RECORD', '缺少 Markdown frontmatter：' + p);
  const doc = parseDocument(match[1]!);
  if (doc.errors.length) fail('INVALID_RECORD', 'YAML 无效：' + p);
  return {
    meta: doc.toJS({
      maxAliasCount: 20
    }) as unknown,
    body: match[2]!
  };
}

export async function parseRecord<K extends RecordKind>(bytes: Buffer, p: string, kind: K) {
  const value = decode(bytes, p);
  return { meta: await validate(kind, value.meta), body: value.body };
}

export async function record<K extends RecordKind>(w: string, p: string, kind: K): Promise<RecordFile<SchemaTypes[K]>> {
  const bytes = await existing(await safe(w, p));
  if (!bytes) fail('NOT_FOUND', '记录不存在：' + p);
  return { path: p, sha256: hash(bytes), ...await parseRecord(bytes, p, kind) };
}

export async function entries(w: string, p: string) {
  const dir = await safe(w, p);
  try {
    return (await readdir(dir, {
      withFileTypes: true
    })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

export async function atomic(w: string, p: string, bytes: Buffer) {
  const target = await safe(w, p);
  await mkdir(path.dirname(target), {
    recursive: true
  });
  const temp = target + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, bytes, {
      flag: 'wx'
    });
    await rename(temp, target);
  } finally {
    await rm(temp, {
      force: true
    });
  }
}

export function expect(old: Buffer | null, expected?: string) {
  if (expected !== undefined && !/^[a-f0-9]{64}$/.test(expected)) fail('INVALID_ARGUMENT', '--if-match 需要 SHA-256');
  if (old !== null && expected === undefined) fail('MATCH_REQUIRED', '更新前先读取，再提供 --if-match', {
    sha256: hash(old)
  });
  if (expected !== undefined && digest(old) !== expected) fail('RECORD_CONFLICT', '文件已改变或不存在；重新读取、合并后再试', {
    actual: digest(old)
  });
}

export function managedPath(p: string, internal = false) {
  try {
    relative(p);
  } catch {
    return false;
  }
  return (
    internal && (
      /^(?:card\.md|tasks\/task-[a-z0-9-]+\.md|activity\/event-[a-z0-9-]+\.md)$/.test(p) ||
      p.startsWith('attachments/')
    )
  ) || p === 'job.md' || p === 'notes.md' || /^(?:analysis|interviews)\/(?:[^/]+\/)*[^/]+\.md$/.test(p);
}
