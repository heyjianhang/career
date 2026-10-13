import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

if (!process.argv.slice(2).length) {
  console.error('用法：node scripts/hash.mjs <已核对的事实文件> [...]');
  process.exitCode = 1;
} else {
  try {
    for (const file of process.argv.slice(2)) console.log(`${createHash('sha256').update(await readFile(file)).digest('hex')}  ${file}`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
