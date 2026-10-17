import { rm } from 'node:fs/promises';
import { hash } from '../presentation/io.js';
import { withLock } from '../workspace/setup.js';
import { fail } from './validation.js';
import {
  safe, existing, digest, ready, atomic, encode, managedPath, limit, now, id,
} from './files.js';

const attachmentLimit = 24 * 1024 * 1024;
const journalLimit = 64 * 1024 * 1024;
const journalPath = 'opportunities/.transaction.json';

interface PendingWrite {
  path: string;
  before: string | null;
  after: string;
  content: string;
}
interface Journal {
  schema: 'career-opportunity-transaction/v1';
  writes: PendingWrite[];
}
interface CheckedWrite extends PendingWrite {
  bytes: Buffer;
  current: string | null;
}

export async function idle(w: string) {
  if (await existing(await safe(w, journalPath), journalLimit)) {
    fail('RECOVERY_REQUIRED', '有未完成的岗位写入；先运行 career board recover，再重新读取。');
  }
}

export async function locked<T>(w: string, fn: () => Promise<T>) {
  await ready(w);
  return withLock(w, async () => {
    await idle(w);
    return fn();
  });
}

// A durable intent joins a data change and its activity receipt. Interrupted
// writes finish only when every destination still has its old or new hash.
export async function commit(
  w: string, op: string, p: string, bytes: Buffer, old: Buffer | null,
  title: string, actor = 'agent',
) {
  return commitFiles(w, op, [{path:p,bytes,old}], title, actor);
}

// One journal covers card, source documents, attachments and one activity receipt.
export async function commitFiles(w:string, op:string, files:{path:string;bytes:Buffer;old:Buffer|null}[], title:string, actor='user') {
  if(!files.length||files.length>8)fail('INVALID_TRANSACTION','事务文件数量无效');
  for(const f of files){const max=/^opportunities\/[^/]+\/attachments\//.test(f.path)?attachmentLimit:limit;if(f.bytes.length>max)fail('FILE_TOO_LARGE','写入超过该文件类型的大小限制');}
  const first=files[0]!,eventId=id('event'),at=now();
  if(!actor.trim()||actor.length>500)fail('INVALID_ARGUMENT','actor 需要简短的记录者标识');
  const event=encode({schema:'career-activity/v1',id:eventId,kind:'record_change',actor,title,created_at:at,target:first.path,before_sha256:digest(first.old),after_sha256:hash(first.bytes)},'');
  const eventPath=`opportunities/${op}/activity/${eventId}.md`;
  const journal:Journal={schema:'career-opportunity-transaction/v1',writes:[...files.map(f=>({path:f.path,before:digest(f.old),after:hash(f.bytes),content:f.bytes.toString('base64')})),{path:eventPath,before:null,after:hash(event),content:event.toString('base64')}]};
  const bytes=Buffer.from(JSON.stringify(journal));if(bytes.length>journalLimit)fail('FILE_TOO_LARGE','事务过大');
  await atomic(w,journalPath,bytes);await finish(w,journal);
  return {path:first.path,sha256:hash(first.bytes),event:eventPath};
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function finish(w: string, journal: unknown) {
  if (!object(journal) || journal.schema !== 'career-opportunity-transaction/v1' ||
      !Array.isArray(journal.writes) || (journal.writes.length < 2 || journal.writes.length > 9)) {
    fail('INVALID_TRANSACTION', '事务记录无效，保留文件待人工核对');
  }
  const changes: unknown[] = journal.writes;
  const writes: CheckedWrite[] = [];
  for (const change of changes) {
    if (!object(change) || typeof change.path !== 'string' ||
        !/^opportunities\/opp-[a-z0-9-]{1,80}\//.test(change.path) ||
        !managedPath(change.path.split('/').slice(2).join('/'), true) ||
        typeof change.content !== 'string' ||
        typeof change.after !== 'string' || !/^[a-f0-9]{64}$/.test(change.after) ||
        !(change.before === null || (typeof change.before === 'string' && /^[a-f0-9]{64}$/.test(change.before)))) {
      fail('INVALID_TRANSACTION', '事务路径或摘要无效');
    }
    const bytes = Buffer.from(change.content, 'base64');
    if (hash(bytes) !== change.after || bytes.length > attachmentLimit) {
      fail('INVALID_TRANSACTION', '事务内容摘要不匹配');
    }
    const file = await safe(w, change.path);
    const current = digest(await existing(file, attachmentLimit));
    if (current !== change.before && current !== change.after) {
      fail('RECORD_CONFLICT', '恢复目标已被修改；保留事务与原文件，请人工合并', { path: change.path });
    }
    writes.push({ path: change.path, before: change.before, after: change.after, content: change.content, bytes, current });
  }
  if (new Set(writes.map(w=>w.path)).size !== writes.length || writes.some(w=>w.path.split('/')[1] !== writes[0]!.path.split('/')[1]) ||
      !/^activity\/event-[a-z0-9-]+\.md$/.test(writes.at(-1)!.path.split('/').slice(2).join('/'))) {
    fail('INVALID_TRANSACTION', '事务必须属于同一个岗位');
  }
  for (const change of writes) {
    const current = digest(await existing(await safe(w, change.path), attachmentLimit));
    if (current === change.after) continue;
    if (current !== change.before) fail('RECORD_CONFLICT', '文件在恢复期间改变');
    await atomic(w, change.path, change.bytes);
  }
  await rm(await safe(w, journalPath));
}

export async function recover(w: string) {
  await ready(w);
  return withLock(w, async () => {
    const bytes = await existing(await safe(w, journalPath), journalLimit);
    if (!bytes) return { recovered: false };
    await finish(w, JSON.parse(bytes.toString('utf8')));
    return { recovered: true, next_action: 'read_board_again' };
  });
}
