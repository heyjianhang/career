import assert from 'node:assert/strict';
import {mkdtemp, readFile, mkdir, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright';
import {startPortalPreview} from '../scripts/preview-site.mjs';
import {setLocalPassword} from '../portal/local.mjs';

const directory = await mkdtemp(path.join(os.tmpdir(), 'career-portal-browser-'));
const key = 'Test-only#42';
await setLocalPassword(directory, key);
const output = new URL('../.cache/portal-review/', import.meta.url); await mkdir(output, {recursive: true});
let failVerification = true;
const version = '0.3.0-alpha.99';
const asset = `https://github.com/heyjianhang/career/releases/download/desktop-v${version}/career-${version}-mac-arm64.dmg`;
const preview = await startPortalPreview({directory, fetcher: async url => {
  if (failVerification) return new Response('', {status: 429});
  if (url.startsWith('https://api.github.com/')) return Response.json({tag_name: `desktop-v${version}`, published_at: '2026-10-17', draft: false, prerelease: true, assets: [{browser_download_url: asset, size: 10, state: 'uploaded'}]});
  return new Response('x', {status: 206, headers: {'Content-Type': 'application/octet-stream'}});
}});
const browser = await chromium.launch({headless: true});
const context = await browser.newContext(); const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
async function screenshot(name) { await page.screenshot({path: new URL(name, output).pathname, fullPage: true}); }
async function noOverflow(label) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label); }
try {
  await page.goto(preview.url + '/admin/'); await page.locator('#admin-key').fill('wrong'.repeat(12)); await page.getByRole('button', {name: '进入后台'}).click(); await page.getByText('管理密钥不正确').waitFor();
  await page.locator('#admin-key').fill(key); await page.getByRole('button', {name: '进入后台'}).click(); await page.locator('#metric-views').filter({hasText: '0'}).waitFor();
  assert.equal(await page.locator('#admin-key').inputValue(), '');
  await page.goto(preview.url + '/'); await page.waitForResponse(r => r.url().endsWith('/api/events') && r.status() === 200);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({width, height: 1000}); await noOverflow(`homepage ${width}`);
    await page.getByRole('group', {name: '切换产品截图'}).getByRole('button', {name: '排版样式'}).click(); assert.match(await page.locator('#preview-image').getAttribute('src'), /styles.jpg/);
    await page.locator('#expand').click(); await page.keyboard.press('Escape');
    await page.getByLabel('下载 macOS，选择架构').click(); await page.getByRole('link', {name: '下载 macOS Apple Silicon 安装包'}).waitFor(); await noOverflow(`menu ${width}`); await page.keyboard.press('Escape');
    if (width === 1440 || width === 390) { await page.evaluate(() => scrollTo(0, 0)); await screenshot(`homepage-${width}.png`); }
  }
  await page.setViewportSize({width: 1440, height: 1000});
  await page.getByRole('link', {name: '通过 Agent 安装'}).click(); await page.locator('#copy').click(); await page.waitForFunction(() => document.querySelector('#copy-status').textContent); assert.match(await page.locator('#copy-status').textContent(), /已复制|已选中/);
  await page.route('https://github.com/**', route => route.fulfill({body: 'Synthetic installer target'}));
  await page.getByLabel('下载 macOS，选择架构').click(); const event = page.waitForRequest(r => r.url().endsWith('/api/events'));
  await page.getByRole('link', {name: '下载 macOS Apple Silicon 安装包'}).click(); assert.equal((await event).method(), 'POST');
  await page.goto(preview.url + '/admin/'); await page.locator('#metric-downloads').filter({hasText: '1'}).waitFor(); assert.equal(await page.locator('#metric-visitors').textContent(), '1');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({width, height: 1000}); await noOverflow(`dashboard ${width}`); if (width === 1440 || width === 390) await screenshot(`admin-${width}.png`);
  }
  await page.getByRole('button', {name: '近 30 天'}).click(); await page.getByText('最近 30 天', {exact: false}).waitFor();
  await page.getByRole('button', {name: '版本管理'}).click(); await page.getByRole('button', {name: '新建版本'}).click();
  await page.locator('#release-version').fill(version); await page.locator('#asset-mac-arm64').check(); await page.locator('#release-notes').fill('<img src=x onerror=alert(1)> 合成发布测试'); await noOverflow('editor mobile');
  await page.getByRole('button', {name: '保存草稿', exact: true}).click(); await page.getByText('草稿已保存，首页下载未改变。').waitFor();
  await page.reload(); await page.locator('.release-row').waitFor(); assert.equal(await page.locator('.release-notes img').count(), 0); assert.equal(await page.locator('#current-version').textContent(), 'v0.3.0-alpha.1');
  await page.setViewportSize({width: 1440, height: 1000}); await screenshot('admin-versions.png');
  await page.getByRole('button', {name: '设为首页版本', exact: true}).click(); assert.equal(await page.locator('#publish-confirm').isDisabled(), true); await page.locator('#acceptance').check(); await page.locator('#publish-confirm').click(); await page.locator('#publish-error').filter({hasText: '限流'}).waitFor(); assert.equal(await page.locator('#current-version').textContent(), 'v0.3.0-alpha.1');
  failVerification = false; await page.locator('#publish-confirm').click(); await page.locator('#current-version').filter({hasText: version}).waitFor();
  await page.goto(preview.url + '/'); await page.locator('#desktop-version').filter({hasText: version}).waitFor(); await page.getByLabel('下载 macOS，选择架构').click(); assert.equal(await page.getByRole('link', {name: '下载 macOS Apple Silicon 安装包'}).getAttribute('href'), asset); assert.equal(await page.locator('.download-options button:disabled').count(), 3);
  await page.getByRole('button', {name: '隐私与统计'}).click(); await page.locator('#analytics-optout').check(); await page.getByRole('button', {name: '关闭隐私说明'}).click();
  let collected = 0; page.on('request', request => { if (request.url().endsWith('/api/events')) collected++; }); await page.reload(); await page.waitForResponse(r => r.url().endsWith('/api/downloads')); await page.waitForTimeout(100); assert.equal(collected, 0);
  await page.route('**/api/downloads', route => route.abort()); await page.reload(); assert.match(await page.locator('.download-option[data-platform="mac-arm64"]').getAttribute('href'), /alpha\.1/);
  const noJS = await browser.newContext({javaScriptEnabled: false}); const staticPage = await noJS.newPage(); await staticPage.goto(preview.url); await staticPage.getByLabel('下载 macOS，选择架构').click(); assert.match(await staticPage.getByRole('link', {name: '下载 macOS Apple Silicon 安装包'}).getAttribute('href'), /alpha\.1/); await noJS.close();
  await page.goto(preview.url + '/admin/'); await page.locator('#logout').click(); await page.locator('#login').waitFor();
  for (const route of ['/.git/config', '/portal/server.mjs', '/.cache/portal/admin-key.json', '/workspace/career.json']) assert.equal((await context.request.get(preview.url + route)).status(), 404);
  assert.deepEqual(errors, []); console.log(JSON.stringify({ok: true, widths: [320, 390, 768, 1024, 1440], output: output.pathname, verification: 'synthetic GitHub responses; no public releases changed'}));
} finally { await browser.close(); await new Promise(resolve => preview.server.close(resolve)); await rm(directory, {recursive: true, force: true}); }
