import {readFile, writeFile, mkdir, rename, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {sha256} from './server.mjs';

// Uses the same API as EdgeOne KV; local preview data never enters the public build.
export async function localStore(directory) {
  await mkdir(directory, {recursive: true, mode: 0o700});
  const filename = key => { if (!/^[a-zA-Z0-9_]+$/.test(key)) throw new Error('Invalid KV key'); return path.join(directory, key + '.json'); };
  return {
    async get(key) { try { return await readFile(filename(key), 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } },
    async put(key, value) { const target = filename(key); const temp = `${target}.${randomBytes(8).toString('hex')}.tmp`; await writeFile(temp, value, {mode: 0o600}); await rename(temp, target); },
    async delete(key) { await rm(filename(key), {force: true}); },
    async list({prefix = '', limit = 256, cursor} = {}) {
      const all = (await readdir(directory)).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)).filter(key => key.startsWith(prefix) && (!cursor || key >= cursor)).sort();
      return {keys: all.slice(0, limit).map(key => ({key})), complete: all.length <= limit, cursor: all[limit] || null};
    },
  };
}
export async function localCredentials(directory) {
  await mkdir(directory, {recursive: true, mode: 0o700});
  const filename = path.join(directory, 'admin-key.json');
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const key = randomBytes(32).toString('base64url');
  const result = {key, PORTAL_ADMIN_KEY_HASH: await sha256(key), PORTAL_SESSION_SECRET: randomBytes(32).toString('base64url')};
  await writeFile(filename, JSON.stringify(result, null, 2), {mode: 0o600, flag: 'wx'});
  return result;
}
