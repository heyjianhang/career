import {localCredentials} from '../portal/local.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Generate once, reuse on rerun, never print the key into terminal logs.
const directory = fileURLToPath(new URL('../.cache/portal-production', import.meta.url));
await localCredentials(directory);
console.log(`已准备生产管理凭据：${path.join(directory, 'admin-key.json')}\n将两个 PORTAL_* 字段作为服务端环境变量配置，key 字段只用于本人登录。不要提交该文件。`);
