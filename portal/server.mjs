import {platforms, validateManifest, verifyRelease} from './releases.mjs';
import {validCredentialHash, verifyPassword} from './password.mjs';

const encoder = new TextEncoder();
const id = () => crypto.randomUUID().replaceAll('-', '');
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
export const sha256 = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const equal = (a, b) => { let diff = a.length ^ b.length; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0); return diff === 0; };
const day = time => new Date(time + 8 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');
const formatDay = value => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
}});
const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
const get = async (kv, key) => { const value = await kv.get(key); return value ? JSON.parse(value) : null; };
const put = (kv, key, value) => kv.put(key, JSON.stringify(value));
async function body(request) {
  if (!/^(application\/json|text\/plain)(;|$)/i.test(request.headers.get('content-type') || '')) fail('不支持的请求格式', 415);
  const reader = request.body?.getReader(); if (!reader) fail('请求内容为空');
  const chunks = []; let size = 0;
  try { for (;;) { const {value, done} = await reader.read(); if (done) break; size += value.length; if (size > 24000) fail('请求内容过大', 413); chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const value = JSON.parse(new TextDecoder().decode(bytes)); if (!value || typeof value !== 'object' || Array.isArray(value)) fail('请求格式不正确'); return value; }
  catch { fail('请求格式不正确'); }
}
async function sign(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
function configured(env) { return validCredentialHash(env.PORTAL_ADMIN_KEY_HASH) && (env.PORTAL_SESSION_SECRET || '').length >= 43; }
function cookie(request) { return request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('career_admin='))?.slice(13) || ''; }
function cookieHeader(value, request, age = 28800) { return `career_admin=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`; }
async function session(request, env, now) {
  const token = cookie(request);
  if (!configured(env) || !/^[a-f0-9]{32}\.\d{13}\.[a-f0-9]{64}$/.test(token)) return null;
  const [nonce, expiry, mac] = token.split('.');
  if (Number(expiry) <= now || Number(expiry) > now + 28800000 || !equal(mac, await sign(env.PORTAL_SESSION_SECRET, `${nonce}.${expiry}`))) return null;
  return {csrf: await sign(env.PORTAL_SESSION_SECRET, `csrf:${token}`)};
}
async function list(kv, prefix, budget = 32) {
  const keys = []; let cursor;
  for (let page = 0; page < budget; page++) {
    const result = await kv.list({prefix, limit: 256, ...(cursor ? {cursor} : {})});
    keys.push(...result.keys.map(item => item.key));
    if (result.complete) return {keys, complete: true};
    if (!result.cursor || result.cursor === cursor) break;
    cursor = result.cursor;
  }
  return {keys, complete: false};
}
async function active(kv, baseline) {
  const saved = kv ? await get(kv, 'active_release') : null;
  return saved || {id: null, revision: 'baseline', manifest: baseline, notes: '', publishedAt: null, verification: null};
}
async function stats(kv, days, now) {
  const dates = Array.from({length: days}, (_, i) => day(now - (days - i - 1) * 86400000));
  const visitors = new Set(); const versions = {}; const sources = {}; const architectures = Object.fromEntries(platforms.map(p => [p, 0]));
  let complete = true; const series = [];
  // Immutable event keys avoid lost increments when requests reach different edge nodes.
  for (const date of dates) {
    const result = await list(kv, `event_${date}_`, 4); complete &&= result.complete;
    let views = 0, downloads = 0; const dailyVisitors = new Set();
    for (const key of result.keys) {
      const [, , kind, visitor, detail, source] = key.split('_');
      if (kind === 'v') { views++; visitors.add(visitor); dailyVisitors.add(visitor); sources[source] = (sources[source] || 0) + 1; }
      if (kind === 'd') { downloads++; const [platformIndex, version] = detail.split('x'); const platform = platforms[Number(platformIndex)]; if (platform) architectures[platform]++;
        const name = version ? new TextDecoder().decode(Uint8Array.from(version.match(/.{2}/g) || [], c => parseInt(c, 16))) : '未知'; versions[name] = (versions[name] || 0) + 1; }
    }
    series.push({date: formatDay(date), views, visitors: dailyVisitors.size, downloads});
  }
  return {days, timezone: 'Asia/Shanghai', complete, updatedAt: new Date(now).toISOString(), visitors: visitors.size,
    views: series.reduce((n, s) => n + s.views, 0), downloads: series.reduce((n, s) => n + s.downloads, 0), series, architectures, versions, sources};
}

export async function handlePortal(request, options) {
  const {kv, env = {}, baseline, fetcher = fetch, now = Date.now()} = options;
  const url = new URL(request.url); const route = url.pathname.replace(/\/$/, ''); const method = request.method;
  try {
    if (['POST', 'PUT', 'DELETE'].includes(method) && request.headers.get('origin') !== (env.PORTAL_ORIGIN || url.origin)) fail('请求来源不匹配', 403);
    if (route === '/api/downloads' && method === 'GET') {
      let current; let storageAvailable = !!kv;
      try { current = await active(kv, baseline); } catch { current = await active(null, baseline); storageAvailable = false; }
      return json({...current, tracking: storageAvailable, source: current.id ? 'managed' : 'build'});
    }
    if (route === '/api/events' && method === 'POST') {
      if (!kv) return json({recorded: false}, 503);
      if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return json({recorded: false});
      const value = await body(request);
      if (!['view', 'download'].includes(value.type) || !/^[a-f0-9]{32}$/.test(value.event || '') || !/^[a-f0-9]{32}$/.test(value.visitor || '')) fail('统计事件格式不正确');
      const source = ['direct', 'github', 'search', 'other'].includes(value.source) ? value.source : 'direct';
      const visitor = (await sha256(`visitor:${value.visitor}`)).slice(0, 24);
      let detail = '0';
      if (value.type === 'download') {
        if (!platforms.includes(value.platform) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value.version || '') || value.version.length > 80) fail('下载事件格式不正确');
        detail = `${platforms.indexOf(value.platform)}x${hex(encoder.encode(value.version))}`;
      }
      await kv.put(`event_${day(now)}_${value.type === 'view' ? 'v' : 'd'}_${visitor}_${detail}_${source}_${value.event}`, '1');
      return json({recorded: true});
    }
    if (!route.startsWith('/api/admin/')) return json({error: '接口不存在'}, 404);
    if (!configured(env) || !kv) return json({error: '管理服务尚未配置。需要绑定存储并设置管理密钥。', configured: false}, 503);
    if (route === '/api/admin/login' && method === 'POST') {
      const value = await body(request);
      if (!await verifyPassword(value.key, env.PORTAL_ADMIN_KEY_HASH)) fail('管理密钥不正确', 401);
      const payload = `${id()}.${now + 28800000}`;
      const token = `${payload}.${await sign(env.PORTAL_SESSION_SECRET, payload)}`;
      return json({ok: true}, 200, {'Set-Cookie': cookieHeader(token, request)});
    }
    const auth = await session(request, env, now);
    if (!auth) fail('请先登录管理后台', 401);
    if (method !== 'GET' && request.headers.get('x-csrf-token') !== auth.csrf) fail('会话已变化，请刷新后重试', 403);
    if (route === '/api/admin/session' && method === 'GET') return json({csrf: auth.csrf, mode: options.local ? 'local' : 'cloud'});
    if (route === '/api/admin/logout' && method === 'POST') return json({ok: true}, 200, {'Set-Cookie': cookieHeader('', request, 0)});
    if (route === '/api/admin/stats' && method === 'GET') return json(await stats(kv, [7, 30].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 7, now));
    if (route === '/api/admin/releases' && method === 'GET') {
      const result = await list(kv, 'release_', 1);
      const releases = (await Promise.all(result.keys.map(key => get(kv, key)))).filter(Boolean).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return json({releases, current: await active(kv, baseline)});
    }
    if (route === '/api/admin/releases' && method === 'POST') {
      const value = await body(request); const manifest = validateManifest(value.manifest);
      if (!manifest.version) fail('版本草稿需要至少一个安装包地址');
      if (typeof value.notes !== 'string' || value.notes.length > 6000) fail('发布说明最多 6000 字');
      if (value.id && !/^[a-f0-9]{32}$/.test(value.id)) fail('草稿编号无效');
      const old = value.id ? await get(kv, `release_${value.id}`) : null;
      if (value.id && !old) fail('草稿不存在', 404);
      if (old && value.revision !== old.revision) fail('草稿已被修改，请刷新后再保存', 409);
      if (!old && (await list(kv, 'release_', 1)).keys.length >= 100) fail('最多保留 100 份版本草稿，请复用已有记录');
      const saved = {id: old?.id || id(), revision: id(), manifest, notes: value.notes.trim(), updatedAt: new Date(now).toISOString()};
      await put(kv, `release_${saved.id}`, saved);
      return json(saved);
    }
    if (route === '/api/admin/publish' && method === 'POST') {
      const value = await body(request);
      if (value.accepted !== true) fail('请先确认所选安装包已完成安装验收');
      if (!/^[a-f0-9]{32}$/.test(value.id || '')) fail('请先保存草稿');
      const draft = await get(kv, `release_${value.id}`);
      if (!draft || draft.revision !== value.revision) fail('草稿已变化，请重新加载', 409);
      const before = await active(kv, baseline);
      if (value.currentRevision !== before.revision) fail('首页版本已变化，请刷新后重试', 409);
      const verification = await verifyRelease(draft.manifest, fetcher);
      const latest = await get(kv, `release_${value.id}`);
      if (latest?.revision !== draft.revision || (await active(kv, baseline)).revision !== before.revision) fail('验证期间版本已变化，请重试', 409);
      const published = {...draft, revision: id(), publishedAt: new Date(now).toISOString(), verification};
      // Keep an immutable audit record before changing the homepage selection.
      await put(kv, `publication_${published.revision}`, {previous: before, next: published});
      await put(kv, 'active_release', published);
      return json(published);
    }
    return json({error: '接口不存在或方法不支持'}, 404);
  } catch (error) {
    const expected = error.status || (error instanceof Error && /安装包|版本|Release|GitHub|草稿|发布说明|清单/.test(error.message));
    return json({error: expected ? error.message : '服务暂时不可用，请稍后重试'}, error.status || (expected ? 400 : 503));
  }
}
