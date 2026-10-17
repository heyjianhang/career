import {localCredentials, setLocalPassword} from '../portal/local.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Generate once, reuse on rerun, never print the key into terminal logs.
const directory = fileURLToPath(new URL('../.cache/portal-production', import.meta.url));
if (process.argv.includes('--password-stdin')) {
  if (process.stdin.isTTY) throw new Error('请通过标准输入传入密码，不要将密码放在命令行参数中');
  let password = '';
  for await (const chunk of process.stdin) { password += chunk; if (password.length > 130) throw new Error('管理密码过长'); }
  await setLocalPassword(directory, password.replace(/\r?\n$/, ''));
} else {
  if (process.argv.length > 2) throw new Error('支持的选项为 --password-stdin');
  await localCredentials(directory);
}
console.log(`已准备生产管理凭据：${path.join(directory, 'admin-key.json')}\n将两个 PORTAL_* 字段作为服务端环境变量配置，并重新部署。自定义密码不会保存在文件中；自动生成的 key 字段只用于本人登录。不要提交该文件。`);
