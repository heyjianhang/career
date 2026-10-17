import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, stat} from 'node:fs/promises';
import {pbkdf2Sync} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {handlePortal, sha256} from '../portal/server.mjs';
import {localStore, localCredentials, setLocalPassword} from '../portal/local.mjs';
import {hashPassword, verifyPassword, validCredentialHash} from '../portal/password.mjs';
import {validateManifest, verifyRelease} from '../portal/releases.mjs';
import {blobNamespace, blobStore} from '../portal/blob.mjs';

const baseline = JSON.parse(await readFile(new URL('../site/downloads.json', import.meta.url), 'utf8'));
const origin = 'https://career.example';
const now = Date.parse('2026-10-17T08:00:00Z');
const adminKey = 'test-only-' + 'k'.repeat(43);
const env = {PORTAL_ADMIN_KEY_HASH: await sha256(adminKey), PORTAL_SESSION_SECRET: 'test-only-' + 's'.repeat(43), PORTAL_ORIGIN: origin};
function memory() {
  const map = new Map();
  return {map, async get(k) { return map.get(k) || null; }, async put(k, v) { assert.match(k, /^[\w]+$/); map.set(k, v); }, async delete(k) { map.delete(k); }, async list({prefix = '', cursor, limit = 256}) { const keys = [...map.keys()].filter(k => k.startsWith(prefix) && (!cursor || k >= cursor)).sort(); return {keys: keys.slice(0, limit).map(key => ({key})), complete: keys.length <= limit, cursor: keys[limit] || null}; }};
}
function mockGithub(manifest = baseline) {
  return async url => {
    if (url.startsWith('https://api.github.com/')) return Response.json({tag_name: manifest.tag, draft: false, prerelease: true, published_at: '2026-10-17', assets: Object.values(manifest.assets).filter(Boolean).map(browser_download_url => ({browser_download_url, state: 'uploaded', size: 100, digest: 'sha256:' + 'a'.repeat(64)}))});
    return new Response('x', {status: 206, headers: {'Content-Type': 'application/octet-stream'}});
  };
}
function client(options = {}) {
  const kv = options.kv || memory(); let cookie = '', csrf = '';
  async function call(route, data, extra = {}) {
    const request = new Request(origin + '/api/' + route, {method: data === undefined ? 'GET' : 'POST', headers: {Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrf, ...extra.headers}, body: data === undefined ? undefined : JSON.stringify(data)});
    const response = await handlePortal(request, {kv, env, baseline, now, fetcher: mockGithub(), ...options, ...extra.options});
    return {response, status: response.status, data: await response.json()};
  }
  return {kv, call, async login() { const result = await call('admin/login', {key: adminKey}); cookie = result.response.headers.get('set-cookie').split(';')[0]; const info = await call('admin/session'); csrf = info.data.csrf; return result; }};
}
const view = (event = '1'.repeat(32), visitor = 'a'.repeat(32)) => ({type: 'view', event, visitor, source: 'github'});
const draft = () => ({manifest: baseline, notes: '合成验收说明'});

function mockBlob() {
  const map = new Map();
  return {map,
    async get(key, options) { assert.equal(options.consistency, 'strong'); return map.get(key) ?? null; },
    async set(key, value, options) { assert.equal(options.cacheControl, 'no-store'); map.set(key, value); },
    async list({prefix, limit, cursor, paginate, consistency}) {
      assert.equal(consistency, 'strong'); assert.equal(paginate, false); assert.equal(limit, 256);
      const keys = [...map.keys()].filter(k => k.startsWith(prefix) && (!cursor || k > cursor)).sort();
      return {blobs: keys.slice(0, limit).map(key => ({key, etag: 'test'})), directories: [], ...(keys.length > limit ? {cursor: keys[limit - 1]} : {})};
    },
  };
}

test('Blob keeps preview and production separate without requesting another credential', () => {
  assert.equal(blobNamespace({}), 'career-portal-preview');
  assert.equal(blobNamespace({PORTAL_ORIGIN: 'https://preview.example'}), 'career-portal-preview');
  assert.equal(blobNamespace({PORTAL_ORIGIN: 'https://career.heyjianhang.top'}), 'career-portal-production');
});
test('Blob events, drafts and publication survive new server instances', async () => {
  const store = mockBlob(); const c = client({kv: blobStore(store)});
  await Promise.all(Array.from({length: 300}, (_, i) => c.call('events', view(i.toString(16).padStart(32, '0')))));
  await c.call('events', view('0'.repeat(32)));
  await c.login(); const saved = (await c.call('admin/releases', draft())).data;
  const reopened = client({kv: blobStore(store)}); await reopened.login();
  assert.equal((await reopened.call('admin/stats')).data.views, 300);
  assert.equal((await reopened.call('admin/stats')).data.complete, true);
  assert.equal((await reopened.call('admin/releases')).data.releases[0].id, saved.id);
  assert.equal((await reopened.call('admin/publish', {id: saved.id, revision: saved.revision, currentRevision: 'baseline', accepted: true})).status, 200);
  assert.equal((await c.call('downloads')).data.id, saved.id);
  assert.equal([...store.map.keys()].filter(k => k.startsWith('publication_')).length, 1);
});
test('Blob pagination respects the daily read budget', async () => {
  const store = mockBlob(); const c = client({kv: blobStore(store)});
  for (let i = 0; i < 1025; i++) await c.call('events', view(i.toString(16).padStart(32, '0')));
  await c.login(); const result = (await c.call('admin/stats')).data;
  assert.equal(result.views, 1024); assert.equal(result.complete, false);
});
test('Blob failures preserve downloads, block false login success and redact SDK internals', async () => {
  const unavailable = () => { throw Object.assign(new Error('signed-url-and-private-token'), {code: 'CREDENTIAL_ERROR'}); };
  const c = client({kv: blobStore({get: unavailable, set: unavailable, list: unavailable})});
  const downloads = await c.call('downloads');
  assert.deepEqual(downloads.data.manifest, baseline); assert.equal(downloads.data.tracking, false);
  for (const [route, value] of [['admin/login', {key: adminKey}], ['events', view()]]) {
    const result = await c.call(route, value);
    assert.equal(result.status, 503); assert.match(result.data.error, /存储暂时无法连接/);
    assert.doesNotMatch(JSON.stringify(result.data), /private-token|signed-url/);
    assert.equal(result.response.headers.get('set-cookie'), null);
  }
  const missingPassword = await c.call('admin/session', undefined, {options: {env: {}}});
  assert.match(missingPassword.data.error, /密码尚未配置/);
  const missingStorage = await c.call('admin/session', undefined, {options: {kv: null}});
  assert.match(missingStorage.data.error, /存储尚未连接/);
});

test('edge ArrayBuffer, sliced typed arrays and string request chunks parse with byte limits', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({key: adminKey}));
  const padded = new Uint8Array(bytes.length + 10); padded.set(bytes, 5);
  for (const chunks of [[bytes.buffer.slice(0, 17), bytes.buffer.slice(17)], [padded.subarray(5, -5)], [JSON.stringify({key: adminKey})]]) {
    const request = new Request(origin + '/api/admin/login', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'}, duplex: 'half', body: new ReadableStream({start(controller) { for (const value of chunks) controller.enqueue(value); controller.close(); }})});
    assert.equal((await handlePortal(request, {kv: memory(), env, baseline, now})).status, 200);
  }
  const huge = new TextEncoder().encode(JSON.stringify({key: '中'.repeat(9000)}));
  const request = new Request(origin + '/api/admin/login', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'}, duplex: 'half', body: new ReadableStream({start(controller) { controller.enqueue(huge.buffer); controller.close(); }})});
  assert.equal((await handlePortal(request, {kv: memory(), env, baseline, now})).status, 413);
});

test('custom passwords use salted PBKDF2 and preserve legacy generated keys', async () => {
  const password = 'Test-only#42';
  const stored = await hashPassword(password);
  const [, , salt, hash] = stored.split(':');
  assert.equal(hash, pbkdf2Sync(password, Buffer.from(salt, 'hex'), 600000, 32, 'sha256').toString('hex'));
  assert.notEqual(await hashPassword(password), stored);
  assert.equal(await verifyPassword(password, stored), true);
  assert.equal(await verifyPassword('test-only#42', stored), false);
  assert.equal(await verifyPassword(password, await sha256(password)), false);
  assert.equal(await verifyPassword(adminKey, env.PORTAL_ADMIN_KEY_HASH), true);
  assert.equal(validCredentialHash(stored.replace(':600000:', ':1:')), false);
  assert.equal(await verifyPassword('x'.repeat(129), stored), false);
  await assert.rejects(hashPassword('short'));
  const c = client({env: {...env, PORTAL_ADMIN_KEY_HASH: stored}});
  assert.equal((await c.call('admin/login', {key: password})).status, 200);
  assert.equal((await c.call('admin/login', {key: 'test-only#42'})).status, 401);
  assert.equal((await c.call('admin/login', {key: password}, {options: {kv: null}})).status, 503);
});

test('password rotation persists no plaintext and invalidates previous sessions', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'career-password-'));
  try {
    const previous = await localCredentials(directory);
    const current = await setLocalPassword(directory, 'Test-only#42');
    assert.notEqual(current.PORTAL_SESSION_SECRET, previous.PORTAL_SESSION_SECRET);
    assert.deepEqual(await localCredentials(directory), current);
    assert.equal('key' in current, false);
    const filename = path.join(directory, 'admin-key.json');
    assert.doesNotMatch(await readFile(filename, 'utf8'), /Test-only#42/);
    if (process.platform !== 'win32') assert.equal((await stat(filename)).mode & 0o777, 0o600);
    const c = client(); await c.login();
    assert.equal((await c.call('admin/session', undefined, {options: {env: {...env, ...current}}})).status, 401);
    assert.equal((await c.call('admin/login', {key: previous.key}, {options: {env: {...env, ...current}}})).status, 401);
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('portal public manifest works without backend and never leaks credentials', async () => {
  const c = client(); const result = await c.call('downloads', undefined, {options: {kv: null}});
  assert.deepEqual(result.data.manifest, baseline); assert.equal(result.data.tracking, false);
  assert.doesNotMatch(JSON.stringify(result.data), /PORTAL_|test-only/);
  assert.equal((await c.call('admin/stats', undefined, {options: {kv: null}})).status, 503);
});
test('admin authentication, signed sessions, expiry, origin and CSRF are enforced', async () => {
  const c = client(); assert.equal((await c.call('admin/releases')).status, 401);
  assert.equal((await c.call('admin/login', {key: 'wrong'})).status, 401);
  assert.equal((await c.call('admin/login', {key: adminKey}, {headers: {Origin: 'https://evil.example'}})).status, 403);
  const login = await c.login(); assert.match(login.response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict;.*Secure/);
  assert.equal((await c.call('admin/releases', draft(), {headers: {'X-CSRF-Token': ''}})).status, 403);
  assert.equal((await c.call('admin/session', undefined, {options: {now: now + 28800001}})).status, 401);
  assert.equal((await c.call('admin/session', undefined, {headers: {Cookie: 'career_admin=' + 'a'.repeat(32) + '.' + (now + 1000) + '.' + '0'.repeat(64)}})).status, 401);
  assert.match((await c.call('admin/logout', {})).response.headers.get('set-cookie'), /Max-Age=0/);
});
test('event IDs deduplicate retries, visitors deduplicate across views, concurrent writes survive', async () => {
  const c = client(); await Promise.all(Array.from({length: 300}, (_, i) => c.call('events', view(i.toString(16).padStart(32, '0')))));
  await c.call('events', view('0'.repeat(32)));
  await c.call('events', {...view('d'.repeat(32)), type: 'download', platform: 'mac-arm64', version: baseline.version});
  await c.login(); const stats = (await c.call('admin/stats?days=7')).data;
  assert.equal(stats.views, 300); assert.equal(stats.visitors, 1); assert.equal(stats.downloads, 1); assert.equal(stats.architectures['mac-arm64'], 1); assert.equal(stats.versions[baseline.version], 1); assert.equal(stats.complete, true);
  assert.doesNotMatch(JSON.stringify(stats), new RegExp('a'.repeat(32))); // no visitor identifiers returned
});
test('stats mark truncated days and do not advertise incomplete numbers as complete', async () => {
  const c = client(); for (let i = 0; i < 1025; i++) await c.call('events', view(i.toString(16).padStart(32, '0')));
  await c.login(); const result = await c.call('admin/stats'); assert.equal(result.data.complete, false); assert.equal(result.data.views, 1024);
});
test('stats use Beijing date boundaries and exclude old events', async () => {
  const c = client(); await c.call('events', view(), {options: {now: Date.parse('2026-10-16T16:00:00Z')}});
  await c.call('events', view('2'.repeat(32)), {options: {now: now - 31 * 86400000}});
  await c.login(); const stats = (await c.call('admin/stats')).data; assert.equal(stats.views, 1); assert.equal(stats.series.at(-1).date, '2026-10-17'); assert.equal(stats.series.at(-1).views, 1);
});
test('tracking respects privacy signals and validates bounded payloads', async () => {
  const c = client(); assert.equal((await c.call('events', view(), {headers: {DNT: '1'}})).data.recorded, false);
  assert.equal((await c.call('events', view(), {headers: {'Sec-GPC': '1'}})).data.recorded, false);
  assert.equal((await c.call('events', {...view(), event: '../secret'})).status, 400);
  assert.equal((await c.call('events', {text: 'a'.repeat(25000)})).status, 413);
  assert.equal((await c.call('events', view(), {headers: {Origin: 'https://evil.example'}})).status, 403);
  assert.equal(c.kv.map.size, 0);
});
test('saving and editing drafts persists without changing the public version', async () => {
  const c = client(); await c.login(); const saved = await c.call('admin/releases', draft()); assert.equal(saved.status, 200);
  assert.equal((await c.call('downloads')).data.id, null);
  const updated = await c.call('admin/releases', {...draft(), id: saved.data.id, revision: saved.data.revision, notes: '<script>bad()</script>'}); assert.equal(updated.status, 200);
  assert.equal((await c.call('admin/releases', {...draft(), id: saved.data.id, revision: saved.data.revision})).status, 409);
  assert.equal((await c.call('admin/releases')).data.releases.length, 1);
});
test('publish verifies public assets, requires acceptance and records previous selection', async () => {
  const c = client(); await c.login(); const saved = (await c.call('admin/releases', draft())).data;
  const payload = {id: saved.id, revision: saved.revision, currentRevision: 'baseline'};
  assert.equal((await c.call('admin/publish', payload)).status, 400);
  const published = await c.call('admin/publish', {...payload, accepted: true}); assert.equal(published.status, 200);
  assert.equal((await c.call('downloads')).data.id, saved.id);
  assert.equal([...c.kv.map.keys()].filter(k => k.startsWith('publication_')).length, 1);
  assert.equal((await c.call('admin/publish', {...payload, accepted: true})).status, 409);
});
test('failed verification leaves homepage untouched and handles throttling', async () => {
  const c = client(); await c.login(); const saved = (await c.call('admin/releases', draft())).data;
  const result = await c.call('admin/publish', {id: saved.id, revision: saved.revision, currentRevision: 'baseline', accepted: true}, {options: {fetcher: async () => new Response('', {status: 429})}});
  assert.equal(result.status, 400); assert.match(result.data.error, /限流/); assert.equal((await c.call('downloads')).data.id, null);
});
test('published snapshot is immutable when its editable draft changes', async () => {
  const c = client(); await c.login(); const saved = (await c.call('admin/releases', draft())).data;
  await c.call('admin/publish', {id: saved.id, revision: saved.revision, currentRevision: 'baseline', accepted: true});
  await c.call('admin/releases', {...draft(), id: saved.id, revision: saved.revision, notes: '新的草稿'});
  assert.equal((await c.call('downloads')).data.notes, draft().notes);
});
test('official URL validation prevents arbitrary hosts and mismatched filenames', () => {
  for (const url of ['http://127.0.0.1/admin', 'https://github.com/another/repo/a.exe', baseline.assets['mac-arm64'] + '?token=secret']) assert.throws(() => validateManifest({...baseline, assets: {...baseline.assets, 'mac-arm64': url}}));
});
test('public verification rejects drafts, missing assets, and HTML download failures', async () => {
  await assert.rejects(verifyRelease(baseline, async () => Response.json({draft: true})), /公开/);
  await assert.rejects(verifyRelease(baseline, async () => Response.json({draft: false, tag_name: baseline.tag, published_at: 'now', assets: []})), /上传/);
  const mock = mockGithub(); await assert.rejects(verifyRelease(baseline, url => url.startsWith('https://api.github.com/') ? mock(url) : Promise.resolve(new Response('<html>', {headers: {'Content-Type': 'text/html'}}))), /下载/);
});
test('local store and credentials survive restart and files are not public assets', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'career-portal-test-'));
  try { const credentials = await localCredentials(dir); const first = await localStore(path.join(dir, 'data')); await first.put('record_1', 'saved'); const second = await localStore(path.join(dir, 'data')); assert.equal(await second.get('record_1'), 'saved'); assert.deepEqual(await localCredentials(dir), credentials); assert.equal(credentials.PORTAL_ADMIN_KEY_HASH, await sha256(credentials.key)); }
  finally { await rm(dir, {recursive: true, force: true}); }
});
test('storage failure cannot remove the static fallback downloads', async () => {
  const c = client({kv: {get() { throw new Error('internal-secret'); }}});
  const result = await c.call('downloads'); assert.deepEqual(result.data.manifest, baseline); assert.equal(result.data.tracking, false); assert.doesNotMatch(JSON.stringify(result), /internal-secret/);
});

// Some cloud hosts replace global crypto with an incomplete WebCrypto shim.
test('Node cloud authentication is independent of the host global crypto shim', () => {
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    Object.defineProperty(globalThis, 'crypto', {configurable: true, value: {subtle: {}}});
    const {hashPassword, verifyPassword} = await import('./portal/password.mjs');
    const {handlePortal, sha256} = await import('./portal/server.mjs');
    const key = 'synthetic-cloud-password';
    const stored = await hashPassword(key);
    assert.equal(await verifyPassword(key, stored), true);
    assert.equal(await verifyPassword('synthetic-wrong-password', stored), false);
    assert.equal((await sha256('test')).length, 64);
    const response = await handlePortal(new Request('https://test.example/api/admin/login', {
      method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://test.example'},
      body: JSON.stringify({key}),
    }), {kv: {async get() {return null;}}, env: {PORTAL_ADMIN_KEY_HASH: stored, PORTAL_SESSION_SECRET: 's'.repeat(43)}});
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  `], {cwd: new URL('..', import.meta.url), stdio: 'pipe'});
});
