import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, writeFile, readdir, rm, stat, chmod, symlink} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {PortalClient, SessionStore, normalizeOrigin} from '../portal/client.mjs';
import {handlePortal} from '../portal/server.mjs';
import {hashPassword} from '../portal/password.mjs';
import {localStore} from '../portal/local.mjs';
import {platforms} from '../portal/releases.mjs';

const cli = fileURLToPath(new URL('../scripts/portal-cli.mjs', import.meta.url));
const password = 'Synthetic-only#' + randomBytes(12).toString('hex');
const credentialHash = await hashPassword(password);
const manifest = {version: '1.2.3-test.1', tag: 'desktop-v1.2.3-test.1', assets: Object.fromEntries(platforms.map(p => [p,
  `https://github.com/heyjianhang/career/releases/download/desktop-v1.2.3-test.1/career-1.2.3-test.1-${p}.${p.startsWith('mac') ? 'dmg' : 'exe'}`]))};
const baseline = {version: null, tag: null, assets: Object.fromEntries(platforms.map(p => [p, null]))};
function github(url) {
  if (url.startsWith('https://api.github.com/')) return Promise.resolve(Response.json({tag_name: manifest.tag, draft: false, published_at: '2026-10-18', prerelease: true,
    assets: Object.values(manifest.assets).map(browser_download_url => ({browser_download_url, size: 42, state: 'uploaded', digest: 'sha256:' + 'a'.repeat(64)}))}));
  return Promise.resolve(new Response('x', {status: 206, headers: {'content-type': 'application/octet-stream'}}));
}
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'career-portal-cli-'));
  const kv = await localStore(path.join(dir, 'server'));
  const env = {PORTAL_ADMIN_KEY_HASH: credentialHash, PORTAL_SESSION_SECRET: randomBytes(32).toString('base64url')};
  let now, failGithub = false, source;
  const calls = [];
  const server = createServer(async (req, res) => {
    try {
      calls.push(req.url);
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const response = await handlePortal(new Request(source + req.url, {method: req.method, headers: req.headers,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : {body: Buffer.concat(chunks)})}),
      {kv, env, baseline, local: true, now, fetcher: failGithub ? async () => new Response('', {status: 404}) : github});
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(500); res.end('test server error'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  source = `http://127.0.0.1:${server.address().port}`;
  env.PORTAL_ORIGIN = source;
  const config = path.join(dir, 'sessions');
  const client = new PortalClient({origin: source, directory: config, releaseFetcher: github});
  const manifestFile = path.join(dir, 'manifest.json'); const notesFile = path.join(dir, 'notes.md');
  await writeFile(manifestFile, JSON.stringify(manifest)); await writeFile(notesFile, '合成验收说明');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, {recursive: true, force: true}); });
  async function run(args, input) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, ...args, '--origin', source, '--json'], {
        cwd: dir, env: {...process.env, CAREER_PORTAL_CONFIG_DIR: config}, stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '', stderr = '';
      child.stdout.on('data', s => stdout += s); child.stderr.on('data', s => stderr += s); child.on('error', reject);
      child.on('close', code => {
        try { resolve({code, stdout, stderr, result: JSON.parse(code === 0 ? stdout : stderr)}); } catch (error) { reject(error); }
      });
      child.stdin.on('error', () => {}); child.stdin.end(input);
    });
  }
  return {dir, config, client, run, kv, env, calls, manifestFile, notesFile, origin: source,
    advance() { now = Date.now() + 28800001; }, breakGithub() { failGithub = true; }};
}

test('CLI hidden credential transport, session reuse, drafts, conflicts, publish and readback', async t => {
  const f = await fixture(t);
  assert.equal((await f.run(['status'])).result.data.authenticated, false);
  assert.equal((await f.run(['release', 'list'])).result.error.code, 'AUTH_REQUIRED');
  assert.equal((await f.run(['login', '--password-stdin'], 'incorrect-password')).code, 1);
  const login = await f.run(['login', '--password-stdin'], password + '\n');
  assert.equal(login.code, 0); assert.equal(login.result.data.authenticated, true);
  assert.equal(login.stdout.includes(password), false); assert.equal(login.stderr, '');
  const files = await readdir(f.config); assert.equal(files.length, 1);
  const state = await readFile(path.join(f.config, files[0]), 'utf8');
  assert.equal(state.includes(password), false); assert.doesNotMatch(state, /csrf|PORTAL_SESSION_SECRET|key/);
  const token = JSON.parse(state).token;
  assert.equal(login.stdout.includes(token), false);
  if (process.platform !== 'win32') {
    assert.equal((await stat(f.config)).mode & 0o777, 0o700);
    assert.equal((await stat(path.join(f.config, files[0]))).mode & 0o777, 0o600);
  }
  assert.equal((await f.run(['status'])).result.data.authenticated, true);
  assert.equal((await f.run(['stats', '--days', '30'])).result.data.days, 30);
  assert.equal((await f.run(['stats', '--days', '15'])).result.error.code, 'INVALID_ARGUMENT');
  const saved = await f.run(['release', 'save', '--manifest', f.manifestFile, '--notes-file', f.notesFile]);
  assert.equal(saved.code, 0); const draft = saved.result.data;
  assert.deepEqual((await f.run(['release', 'show', '--id', draft.id])).result.data, draft);
  const list = await f.run(['release', 'list']); assert.equal(list.result.data.releases.length, 1);
  assert.equal((await f.run(['current'])).result.data.revision, 'baseline');
  const changed = (await f.run(['release', 'save', '--manifest', f.manifestFile, '--notes-file', f.notesFile, '--id', draft.id, '--revision', draft.revision])).result.data;
  assert.notEqual(changed.revision, draft.revision);
  assert.equal((await f.run(['release', 'save', '--manifest', f.manifestFile, '--notes-file', f.notesFile, '--id', draft.id, '--revision', draft.revision])).result.error.code, 'CONFLICT');
  assert.equal((await f.run(['release', 'verify', '--id', draft.id, '--revision', draft.revision])).result.error.code, 'CONFLICT');
  const verification = await f.client.verify(changed.id, changed.revision);
  assert.equal(verification.installed, 'not-checked'); assert.equal(Object.keys(verification.verification.assets).length, 4);
  const publishArgs = ['release', 'publish', '--id', changed.id, '--revision', changed.revision, '--current-revision', 'baseline'];
  assert.equal((await f.run(publishArgs)).result.error.code, 'ACCEPTANCE_REQUIRED');
  const published = await f.run([...publishArgs, '--acceptance-confirmed']);
  assert.equal(published.code, 0); assert.equal(published.result.data.publicFeedConfirmed, true);
  assert.deepEqual((await f.run(['current'])).result.data.manifest, manifest);
  assert.equal((await f.run([...publishArgs, '--acceptance-confirmed'])).result.error.code, 'CONFLICT');
  assert.equal((await f.run(['logout'])).result.data.localSessionRemoved, true);
  assert.equal((await readdir(f.config)).length, 0);
  assert.equal((await f.run(['status'])).result.data.authenticated, false);
});

test('CLI rejects unsafe arguments and malformed data before making mutations', async t => {
  const f = await fixture(t);
  for (const args of [['login', '--password', password], ['login', '--key', password], ['login', `--password=${password}`], ['login', '--unknown'], ['login', '--json', '--json']]) {
    const result = await f.run(args);
    assert.equal(result.code, 1); assert.equal((result.stdout + result.stderr).includes(password), false);
  }
  assert.equal((await f.run(['login'])).result.error.code, 'INTERACTIVE_LOGIN_REQUIRED');
  assert.equal((await f.run(['login', '--password-stdin'], 'x'.repeat(131))).result.error.code, 'INVALID_PASSWORD');
  assert.equal((await f.run(['--help'])).result.data.commands['release publish'].includes('--acceptance-confirmed'), true);
  await writeFile(f.manifestFile, '{broken');
  assert.equal((await f.run(['release', 'save', '--manifest', f.manifestFile, '--notes-file', f.notesFile])).result.error.code, 'INVALID_ARGUMENT');
  await writeFile(f.manifestFile, JSON.stringify({...manifest, assets: {...manifest.assets, 'mac-arm64': 'https://example.com/untrusted.dmg'}}));
  assert.equal((await f.run(['release', 'save', '--manifest', f.manifestFile, '--notes-file', f.notesFile])).result.error.code, 'INVALID_ARGUMENT');
  assert.equal(f.calls.length, 0);
});

test('verification failure preserves live release and never changes saved draft', async t => {
  const f = await fixture(t); await f.client.login(password);
  const draft = await f.client.save({manifest, notes: '合成记录'});
  f.breakGithub();
  await assert.rejects(f.client.publish({...draft, currentRevision: 'baseline', accepted: true}), /公开 Release/);
  assert.equal((await f.client.current()).revision, 'baseline');
  assert.equal((await f.client.show(draft.id)).revision, draft.revision);
});

test('expired, revoked and cross-origin sessions are not reused', async t => {
  const f = await fixture(t); await f.client.login(password);
  const other = new PortalClient({origin: 'https://other.example', directory: f.config, fetcher: () => assert.fail('must not send credentials')});
  assert.equal((await other.status()).authenticated, false);
  assert.equal(await f.client.store.load(Date.now() + 28800001), null);
  assert.equal((await readdir(f.config)).length, 0);
  await f.client.login(password); f.advance();
  assert.equal((await f.client.status()).authenticated, false);
  assert.equal((await readdir(f.config)).length, 0);
});

test('transport refuses credential redirects and reports ambiguous writes without retry', async t => {
  const f = await fixture(t); await f.client.login(password);
  let count = 0;
  const client = new PortalClient({origin: f.origin, directory: f.config, fetcher: async (url, options) => {
    assert.equal(options.redirect, 'error');
    if (url.endsWith('/admin/session')) return fetch(url, options);
    count++; throw new Error('private-network-details');
  }});
  await assert.rejects(client.save({manifest, notes: '合成记录'}), {code: 'RESULT_UNKNOWN'});
  assert.equal(count, 1);
  const unavailable = new PortalClient({origin: f.origin, directory: f.config, fetcher: (url, options) =>
    url.endsWith('/admin/session') ? fetch(url, options) : Promise.resolve(Response.json({error: 'service unavailable'}, {status: 503}))});
  await assert.rejects(unavailable.save({manifest, notes: '合成记录'}), {code: 'RESULT_UNKNOWN'});
  await assert.rejects(client.logout(), {code: 'NETWORK_ERROR'});
  assert.equal((await readdir(f.config)).length, 0);
  for (const value of ['http://example.com', 'https://user:password@example.com', 'https://example.com/path', 'https://example.com?token=private', 'file:///tmp/']) {
    assert.throws(() => normalizeOrigin(value), {code: 'INVALID_ORIGIN'});
  }
  assert.equal(normalizeOrigin('https://example.com/'), 'https://example.com');
});

test('public readback failure cannot be mistaken for confirmed publication', async t => {
  const f = await fixture(t); await f.client.login(password);
  const draft = await f.client.save({manifest, notes: '合成记录'});
  const client = new PortalClient({origin: f.origin, directory: f.config, fetcher: async (url, options) => {
    if (url.endsWith('/downloads')) return Response.json({source: 'build', revision: 'baseline', manifest: baseline});
    return fetch(url, options);
  }});
  await assert.rejects(client.publish({...draft, currentRevision: 'baseline', accepted: true}), {code: 'PUBLISH_NOT_CONFIRMED'});
  assert.equal((await f.client.current()).id, draft.id);
});

test('session storage rejects broad permissions, symlinks and malformed files', {skip: process.platform === 'win32'}, async t => {
  const f = await fixture(t); await f.client.login(password);
  await chmod(f.client.store.filename, 0o644);
  await assert.rejects(f.client.status(), {code: 'SESSION_STORAGE'});
  await chmod(f.client.store.filename, 0o600);
  const contents = await readFile(f.client.store.filename, 'utf8');
  await f.client.store.clear();
  const target = path.join(f.dir, 'outside.json'); await writeFile(target, contents, {mode: 0o600});
  await symlink(target, f.client.store.filename);
  await assert.rejects(f.client.status(), {code: 'SESSION_STORAGE'});
  await f.client.store.clear();
  assert.equal(await readFile(target, 'utf8'), contents);
  await writeFile(f.client.store.filename, '{bad-json', {mode: 0o600});
  await assert.rejects(f.client.logout(), {code: 'SESSION_STORAGE'});
  assert.equal((await readdir(f.config)).length, 0);
  await chmod(f.config, 0o755);
  await assert.rejects(new SessionStore(f.origin, f.config).load(), {code: 'SESSION_STORAGE'});
});

test('credential echoes in API errors are redacted', async t => {
  const f = await fixture(t);
  const client = new PortalClient({origin: f.origin, directory: f.config, fetcher: async (url, options) => {
    const value = JSON.parse(options.body); return Response.json({error: 'rejected ' + value.key}, {status: 401});
  }});
  await assert.rejects(client.login(password), error => error.code === 'AUTH_REQUIRED' && !error.message.includes(password));
});
