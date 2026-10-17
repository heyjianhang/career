#!/usr/bin/env node
import {readFile, stat} from 'node:fs/promises';
import {emitKeypressEvents} from 'node:readline';
import {PortalClient, PortalError, failure, defaultOrigin} from '../portal/client.mjs';

const commands = {
  login: ['password-stdin'], logout: [], status: [], current: [], stats: ['days'],
  'release list': [], 'release show': ['id'],
  'release save': ['manifest', 'notes-file', 'id', 'revision'],
  'release verify': ['id', 'revision'],
  'release publish': ['id', 'revision', 'current-revision', 'acceptance-confirmed'],
};
const booleans = new Set(['help', 'json', 'password-stdin', 'acceptance-confirmed']);
const help = {
  name: 'career portal admin', defaultOrigin, node: '22+',
  commands: {
    login: '输入管理密码（终端隐藏输入）；自动化用 --password-stdin',
    status: '确认登录状态及会话到期时间', logout: '退出并删除本机保存的会话',
    current: '匿名读取当前门户下载版本与 revision', stats: '--days 7|30：访问与下载点击统计',
    'release list': '查看草稿与当前发布快照', 'release show': '--id <草稿 ID>',
    'release save': '--manifest <JSON 文件> --notes-file <说明文件>；编辑追加 --id <ID> --revision <修订号>',
    'release verify': '--id <ID> --revision <修订号>：只读验证公开 Release 与匿名下载，不代替安装验收',
    'release publish': '--id <ID> --revision <修订号> --current-revision <首页修订号> --acceptance-confirmed',
  },
  options: {'--origin': '指定门户 origin，默认生产；仅本机允许 HTTP', '--json': '单行 JSON，适合 Agent', '--help': '查看命令说明'},
  session: '只保存 8 小时会话，不保存密码；不同 origin 隔离。CAREER_PORTAL_CONFIG_DIR 可覆盖本机专用会话目录。',
  publishing: '只维护门户版本入口；构建、GitHub 上传、安装验收和静态回退清单由 career-release 指导。',
};

function parse(argv) {
  const words = [], options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { words.push(arg); continue; }
    const key = arg.slice(2);
    if (!/^[a-z-]+$/.test(key) || Object.hasOwn(options, key)) failure('INVALID_ARGUMENT', '存在无效或重复选项，请运行 --help');
    if (key === 'password' || key === 'key' || key === 'token') failure('INVALID_ARGUMENT', '不要通过命令行参数传入密码或会话；请使用 login 隐藏输入');
    if (booleans.has(key)) options[key] = true;
    else { if (!argv[i + 1] || argv[i + 1].startsWith('--')) failure('INVALID_ARGUMENT', '选项缺少值，请运行 --help'); options[key] = argv[++i]; }
  }
  const command = words.join(' ');
  if (options.help || !argv.length) return {command: 'help', options};
  if (!Object.hasOwn(commands, command)) failure('INVALID_ARGUMENT', '命令不存在，请运行 --help');
  const allowed = new Set(['origin', 'json', ...commands[command]]);
  if (Object.keys(options).some(key => !allowed.has(key))) failure('INVALID_ARGUMENT', '命令包含不支持的选项，请运行 --help');
  return {command, options};
}
function required(options, key) { if (!options[key]) failure('INVALID_ARGUMENT', `缺少 --${key}`); return options[key]; }
async function textFile(filename, limit) {
  const info = await stat(filename);
  if (!info.isFile() || info.size > limit) failure('INVALID_ARGUMENT', '输入文件过大或不是普通文件');
  const value = await readFile(filename, 'utf8');
  if (Buffer.byteLength(value) > limit) failure('INVALID_ARGUMENT', '输入文件超过限额');
  return value;
}
async function password(stdinMode) {
  const input = process.stdin;
  if (stdinMode) {
    if (input.isTTY) failure('INVALID_ARGUMENT', '--password-stdin 需要通过标准输入传递；终端直接运行 login 即可');
    input.setEncoding('utf8'); let value = '';
    for await (const chunk of input) { value += chunk; if (value.length > 130) failure('INVALID_PASSWORD', '管理密码过长'); }
    return value.replace(/\r?\n$/, '');
  }
  if (!input.isTTY || !process.stderr.isTTY) failure('INTERACTIVE_LOGIN_REQUIRED', '请在终端运行 login 完成隐藏输入，或由安全凭据工具通过 --password-stdin 传入');
  process.stderr.write('管理密码（输入隐藏）：');
  return new Promise((resolve, reject) => {
    let value = ''; const wasRaw = input.isRaw;
    emitKeypressEvents(input); input.setRawMode(true); input.resume();
    function done(error) {
      input.removeListener('keypress', onKey); input.removeListener('end', onEnd);
      input.setRawMode(!!wasRaw); input.pause(); process.stderr.write('\n');
      if (error) reject(error); else resolve(value);
    }
    function onEnd() { done(new PortalError('CANCELLED', '登录已取消')); }
    function onKey(text, key = {}) {
      if ((key.ctrl && ['c', 'd'].includes(key.name)) || key.name === 'escape') return onEnd();
      if (key.name === 'return' || key.name === 'enter') return done();
      if (key.name === 'backspace') { value = Array.from(value).slice(0, -1).join(''); return; }
      if (text && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(text)) value += text;
      if (value.length > 128) done(new PortalError('INVALID_PASSWORD', '管理密码过长'));
    }
    input.on('keypress', onKey); input.once('end', onEnd);
  });
}

let command = 'unknown', origin;
try {
  const parsed = parse(process.argv.slice(2)); command = parsed.command; const options = parsed.options;
  let data;
  if (command === 'help') data = help;
  else {
    const client = new PortalClient({origin: options.origin}); origin = client.origin;
    switch (command) {
      case 'login': data = await client.login(await password(options['password-stdin'])); break;
      case 'logout': data = await client.logout(); break;
      case 'status': data = await client.status(); break;
      case 'current': data = await client.current(); break;
      case 'stats': data = await client.stats(Number(options.days || 7)); break;
      case 'release list': data = await client.list(); break;
      case 'release show': data = await client.show(required(options, 'id')); break;
      case 'release save': {
        const source = await textFile(required(options, 'manifest'), 12000); let manifest;
        try { manifest = JSON.parse(source); } catch { failure('INVALID_ARGUMENT', '安装包清单不是有效 JSON'); }
        const notes = await textFile(required(options, 'notes-file'), 20000);
        data = await client.save({manifest, notes, id: options.id, revision: options.revision}); break;
      }
      case 'release verify': data = await client.verify(required(options, 'id'), required(options, 'revision')); break;
      case 'release publish': data = await client.publish({id: required(options, 'id'), revision: required(options, 'revision'), currentRevision: required(options, 'current-revision'), accepted: options['acceptance-confirmed'] === true}); break;
    }
  }
  process.stdout.write(JSON.stringify({ok: true, command, ...(origin ? {origin} : {}), data}, null, options.json ? 0 : 2) + '\n');
} catch (error) {
  const known = error instanceof PortalError;
  process.stderr.write(JSON.stringify({ok: false, command, ...(origin ? {origin} : {}), error: {
    code: known ? error.code : 'LOCAL_ERROR', message: known ? error.message : '无法读取文件或保存会话，请检查路径和权限',
    ...(error.status ? {status: error.status} : {}),
  }}) + '\n');
  process.exitCode = 1;
}
