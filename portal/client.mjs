import {mkdir, lstat, open, rename, rm, chmod} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash, randomBytes} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {validateManifest, verifyRelease} from './releases.mjs';

export const defaultOrigin = 'https://career.heyjianhang.top';
export class PortalError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}
export const failure = (code, message) => { throw new PortalError(code, message); };
export function normalizeOrigin(value) {
  let url;
  try { url = new URL(value); } catch { failure('INVALID_ORIGIN', '门户地址必须是完整的 HTTPS 地址'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) {
    failure('INVALID_ORIGIN', '门户地址只包含协议、域名和端口；仅本机调试允许 HTTP');
  }
  return url.origin;
}
export function defaultConfigDirectory() {
  return process.env.CAREER_PORTAL_CONFIG_DIR || (process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'career-portal')
    : path.join(os.homedir(), '.config', 'career-portal'));
}
const tokenPattern = /^[a-f0-9]{32}\.(\d{13})\.[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{32}$/;
export function requireRevision(value, label = 'revision', baseline = false) {
  if (!revisionPattern.test(value || '') && !(baseline && value === 'baseline')) failure('INVALID_ARGUMENT', `${label} 必须来自当前接口返回值`);
  return value;
}

// Each origin has a separate, owner-only session file. Passwords and CSRF never persist.
export class SessionStore {
  constructor(origin, directory = defaultConfigDirectory()) {
    this.origin = normalizeOrigin(origin);
    this.directory = path.resolve(directory);
    this.filename = path.join(this.directory, createHash('sha256').update(this.origin).digest('hex') + '.json');
  }
  async checkDirectory(create = false) {
    if (create) await mkdir(this.directory, {recursive: true, mode: 0o700});
    let info;
    try { info = await lstat(this.directory); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    if (!info.isDirectory() || info.isSymbolicLink()) failure('SESSION_STORAGE', '会话目录必须是本机专用目录，不能使用符号链接');
    if (process.platform !== 'win32' && (info.mode & 0o077)) failure('SESSION_STORAGE', '会话目录权限过宽，请将权限改为 0700');
    return true;
  }
  async load(now = Date.now()) {
    if (!await this.checkDirectory()) return null;
    let file;
    try {
      if ((await lstat(this.filename)).isSymbolicLink()) failure('SESSION_STORAGE', '会话文件不能使用符号链接');
      file = await open(this.filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    }
    catch (error) { if (error.code === 'ENOENT') return null; failure('SESSION_STORAGE', '无法安全读取本机会话文件'); }
    let saved;
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > 4096 || (process.platform !== 'win32' && (info.mode & 0o077))) failure('SESSION_STORAGE', '会话文件无效或权限过宽，应为 0600');
      try { saved = JSON.parse(await file.readFile('utf8')); } catch { failure('SESSION_STORAGE', '会话文件损坏，请先 logout 再登录'); }
    } finally { await file.close(); }
    const match = tokenPattern.exec(saved?.token || '');
    if (saved?.origin !== this.origin || !match || Number(match[1]) > now + 28800000) failure('SESSION_STORAGE', '会话文件无效，请先 logout 再登录');
    if (Number(match[1]) <= now) { await this.clear(); return null; }
    return {token: saved.token, expiresAt: new Date(Number(match[1])).toISOString()};
  }
  async save(token) {
    if (!tokenPattern.test(token)) failure('INVALID_RESPONSE', '服务端没有返回有效会话');
    await this.checkDirectory(true);
    const temporary = `${this.filename}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      const file = await open(temporary, 'wx', 0o600);
      try { await file.writeFile(JSON.stringify({origin: this.origin, token})); } finally { await file.close(); }
      await rename(temporary, this.filename);
      if (process.platform !== 'win32') await chmod(this.filename, 0o600);
    } finally { await rm(temporary, {force: true}); }
  }
  async clear() { if (await this.checkDirectory()) await rm(this.filename, {force: true}); }
}

async function responseBody(response) {
  if (!/application\/json/i.test(response.headers.get('content-type') || '')) failure('INVALID_RESPONSE', '门户没有返回 JSON，请检查服务地址与部署状态');
  if (!response.body) failure('INVALID_RESPONSE', '门户返回了空响应');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024 * 1024) failure('INVALID_RESPONSE', '门户响应超过读取限额');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { failure('INVALID_RESPONSE', '门户返回的 JSON 无效'); }
}

export class PortalClient {
  constructor({origin = defaultOrigin, directory, fetcher = fetch, releaseFetcher = fetch} = {}) {
    this.origin = normalizeOrigin(origin);
    this.store = new SessionStore(this.origin, directory);
    this.fetcher = fetcher; this.releaseFetcher = releaseFetcher;
  }
  async request(route, {data, token, csrf} = {}) {
    const mutation = data !== undefined; const uncertain = mutation && ['admin/releases', 'admin/publish'].includes(route);
    let response, value;
    try {
      response = await this.fetcher(`${this.origin}/api/${route}`, {
        method: mutation ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(route === 'admin/publish' ? 90000 : 20000),
        headers: {Accept: 'application/json', Origin: this.origin, 'User-Agent': 'career-portal-cli',
          ...(mutation ? {'Content-Type': 'application/json'} : {}),
          ...(token ? {Cookie: `career_admin=${token}`} : {}), ...(csrf ? {'X-CSRF-Token': csrf} : {})},
        ...(mutation ? {body: JSON.stringify(data)} : {}),
      });
      value = await responseBody(response);
    } catch (error) {
      if (uncertain) failure('RESULT_UNKNOWN', '请求结果尚未确认。先运行 release list 和 current 核对，不能直接重复写入');
      if (error instanceof PortalError) throw error;
      failure('NETWORK_ERROR', '无法连接门户或请求超时；为保护凭据，不跟随重定向');
    }
    if (!response.ok) {
      if (uncertain && response.status >= 500) failure('RESULT_UNKNOWN', '服务端写入结果尚未确认。先运行 release list 和 current 核对，不能直接重复写入');
      if (response.status === 401 && token) await this.store.clear();
      const code = ({401: 'AUTH_REQUIRED', 403: 'FORBIDDEN', 409: 'CONFLICT', 503: 'UNAVAILABLE'})[response.status] || 'API_ERROR';
      let message = typeof value?.error === 'string' ? value.error.slice(0, 400) : `门户请求失败（${response.status}）`;
      for (const secret of [token, csrf, data?.key].filter(Boolean)) message = message.replaceAll(secret, '[已隐藏]');
      throw new PortalError(code, message, response.status);
    }
    return {value, response};
  }
  async login(password) {
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) failure('INVALID_PASSWORD', '管理密码需为 12–128 个字符');
    const {response} = await this.request('admin/login', {data: {key: password}});
    const token = response.headers.get('set-cookie')?.match(/(?:^|,\s*)career_admin=([^;]+)/)?.[1];
    if (!tokenPattern.test(token || '')) failure('INVALID_RESPONSE', '登录响应缺少有效会话');
    const {value} = await this.request('admin/session', {token});
    if (!/^[a-f0-9]{64}$/.test(value?.csrf || '')) failure('INVALID_RESPONSE', '无法确认登录会话');
    await this.store.save(token);
    return {authenticated: true, expiresAt: new Date(Number(token.split('.')[1])).toISOString()};
  }
  async auth() {
    const saved = await this.store.load();
    if (!saved) failure('AUTH_REQUIRED', '尚未登录或会话已过期，请运行 login');
    const {value} = await this.request('admin/session', {token: saved.token});
    if (!/^[a-f0-9]{64}$/.test(value?.csrf || '')) failure('INVALID_RESPONSE', '门户会话响应无效');
    return {...saved, csrf: value.csrf, mode: value.mode};
  }
  async status() {
    try { const {expiresAt, mode} = await this.auth(); return {authenticated: true, expiresAt, mode}; }
    catch (error) { if (error.code === 'AUTH_REQUIRED') return {authenticated: false}; throw error; }
  }
  async logout() {
    try {
      const saved = await this.store.load();
      if (saved) { const auth = await this.auth(); await this.request('admin/logout', {...auth, data: {}}); }
      return {authenticated: false, localSessionRemoved: true};
    } finally { await this.store.clear(); }
  }
  async current() { return (await this.request('downloads')).value; }
  async stats(days = 7) {
    if (![7, 30].includes(days)) failure('INVALID_ARGUMENT', 'days 只能为 7 或 30');
    return (await this.request(`admin/stats?days=${days}`, await this.auth())).value;
  }
  async list() { return (await this.request('admin/releases', await this.auth())).value; }
  async show(id) {
    requireRevision(id, 'id');
    const draft = (await this.list()).releases?.find(item => item.id === id);
    if (!draft) failure('NOT_FOUND', '找不到指定版本草稿');
    return draft;
  }
  async save({manifest, notes, id, revision}) {
    try { validateManifest(manifest); } catch (error) { failure('INVALID_ARGUMENT', error.message); }
    if (!manifest.version) failure('INVALID_ARGUMENT', '版本草稿需要至少一个安装包');
    if (typeof notes !== 'string' || notes.length > 6000) failure('INVALID_ARGUMENT', '发布说明最多 6000 字');
    if (id || revision) { requireRevision(id, 'id'); requireRevision(revision); }
    const data = {manifest, notes, ...(id ? {id, revision} : {})};
    if (Buffer.byteLength(JSON.stringify(data)) > 24000) failure('INVALID_ARGUMENT', '草稿内容超过 24,000 字节');
    return (await this.request('admin/releases', {...await this.auth(), data})).value;
  }
  async verify(id, revision) {
    requireRevision(revision);
    const draft = await this.show(id);
    if (draft.revision !== revision) failure('CONFLICT', '草稿已变化，请重新查看');
    let verification;
    try { verification = await verifyRelease(draft.manifest, this.releaseFetcher); }
    catch (error) { failure('VERIFICATION_FAILED', error.message); }
    return {id, revision, manifest: draft.manifest, verification, installed: 'not-checked'};
  }
  async publish({id, revision, currentRevision, accepted}) {
    requireRevision(id, 'id'); requireRevision(revision); requireRevision(currentRevision, 'current-revision', true);
    if (accepted !== true) failure('ACCEPTANCE_REQUIRED', '需先完成所选安装包验收，再使用 --acceptance-confirmed');
    const result = (await this.request('admin/publish', {...await this.auth(), data: {id, revision, currentRevision, accepted}})).value;
    // A successful write is not enough: confirm the public feed serves that exact snapshot.
    let current;
    try { current = await this.current(); } catch { failure('PUBLISH_NOT_CONFIRMED', '发布请求已成功，公开入口暂未核实；请运行 current 核对，不要重复发布'); }
    if (current.source !== 'managed' || current.id !== result.id || current.revision !== result.revision ||
        JSON.stringify(current.manifest) !== JSON.stringify(result.manifest)) failure('PUBLISH_NOT_CONFIRMED', '发布请求已成功，但公开入口不一致；请运行 current 核对，不要重复发布');
    return {...result, publicFeedConfirmed: true};
  }
}
