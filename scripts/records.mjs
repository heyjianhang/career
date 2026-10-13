import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseDocument, stringify} from 'yaml';

export const sha256 = content => createHash('sha256').update(content).digest('hex');
export function parseRecord(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new Error('缺少 YAML frontmatter');
  const doc = parseDocument(match[1], {uniqueKeys: true});
  if (doc.errors.length) throw new Error(doc.errors.map(e => e.message).join('; '));
  const meta = doc.toJS({maxAliasCount: 0});
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('元数据须为对象');
  return {meta, body: text.slice(match[0].length), text};
}
export const serialize = (meta, body) => `---\n${stringify(meta)}---\n${body}`;
export async function readRecord(file) { return {...parseRecord(await readFile(file, 'utf8')), file}; }
