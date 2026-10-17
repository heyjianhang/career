const $ = selector => document.querySelector(selector);
const platforms = [['mac-arm64', 'macOS · Apple Silicon'], ['mac-x64', 'macOS · Intel'], ['win-x64', 'Windows · x64'], ['win-arm64', 'Windows · ARM64']];
let csrf = '', days = 7, releases = [], current = null, editing = null, publishing = null;
let statsRequest = 0;
const number = value => Number(value).toLocaleString('zh-CN');
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function notice(message, error = false) { $('#notice').textContent = message; $('#notice').hidden = !message; $('#notice').classList.toggle('error', error); }
function showLogin() { $('#console').hidden = true; $('#login').hidden = false; document.querySelectorAll('dialog[open]').forEach(d => d.close()); csrf = ''; }
async function api(path, data) {
  const response = await fetch(`/api/admin/${path}`, {method: data ? 'POST' : 'GET', headers: data ? {'Content-Type': 'application/json', 'X-CSRF-Token': csrf} : {}, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(path === 'publish' ? 90000 : 20000)});
  let result; try { result = await response.json(); } catch { throw new Error('管理接口未连接，请检查门户部署。'); }
  if (!response.ok) { if (response.status === 401 && path !== 'login') showLogin(); throw new Error(result.error || '请求失败，请稍后重试'); }
  return result;
}
async function busy(button, work, message = '处理中…') {
  const old = button.textContent; button.disabled = true; button.textContent = message;
  try { return await work(); } finally { button.disabled = false; button.textContent = old; }
}
async function enter() {
  const info = await api('session'); csrf = info.csrf;
  $('#environment').textContent = info.mode === 'local' ? '本地预览 · 独立数据' : '云端管理';
  $('#login').hidden = true; $('#console').hidden = false;
  await Promise.all([loadStats(), loadReleases()]); selectPage();
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('#login-error').textContent = '';
  try { await busy(event.submitter, async () => { await api('login', {key: $('#admin-key').value}); $('#admin-key').value = ''; await enter(); }, '正在登录…'); }
  catch (error) { $('#login-error').textContent = error.message; }
});
$('#logout').addEventListener('click', async () => { try { await api('logout', {}); showLogin(); } catch (error) { notice(error.message, true); } });
function selectPage() {
  const page = location.hash === '#versions' ? 'versions' : 'overview';
  $('#overview').hidden = page !== 'overview'; $('#versions').hidden = page !== 'versions';
  $('#breadcrumb').textContent = page === 'overview' ? '数据概览' : '版本管理';
  document.querySelectorAll('[data-page]').forEach(button => { if (button.dataset.page === page) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
}
document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { location.hash = button.dataset.page; selectPage(); }));
window.addEventListener('hashchange', selectPage);
document.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click', () => {
  days = Number(button.dataset.days); document.querySelectorAll('[data-days]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); loadStats();
}));
$('#refresh').addEventListener('click', event => busy(event.target, loadStats, '刷新中…'));
function rows(target, entries, empty) {
  const parent = $(target); parent.replaceChildren();
  if (!entries.length || entries.every(([, value]) => value === 0)) { parent.append(node('p', empty, 'empty')); return; }
  const max = Math.max(...entries.map(([, value]) => value), 1);
  for (const [label, value] of entries) { const row = node('div', undefined, 'stat-row'); const header = node('div'); header.append(node('span', label), node('strong', number(value))); const bar = node('div', undefined, 'bar'); const fill = node('i'); fill.style.width = `${Math.max(0, value / max * 100)}%`; bar.append(fill); row.append(header, bar); parent.append(row); }
}
function chart(series) {
  const parent = $('#chart'); parent.replaceChildren();
  if (series.every(s => !s.views && !s.downloads)) { parent.append(node('div', '还没有访问记录。官网开始被访问后，趋势会出现在这里。', 'chart-empty')); return; }
  const w = 660, h = 200, max = Math.max(4, ...series.map(s => Math.max(s.views, s.downloads)));
  const points = field => series.map((s, i) => `${36 + i / Math.max(1, series.length - 1) * (w - 56)},${h - 24 - s[field] / max * (h - 48)}`).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '访问与下载趋势；详细数据在下方展开');
  svg.innerHTML = [0, .5, 1].map(t => `<line x1="36" x2="640" y1="${h - 24 - t * (h - 48)}" y2="${h - 24 - t * (h - 48)}" stroke="#e4e9df"/><text x="5" y="${h - 20 - t * (h - 48)}" fill="#73806e" font-size="11">${Math.round(max * t)}</text>`).join('') + `<polyline points="${points('views')}" fill="none" stroke="#3c604b" stroke-width="2.5"/><polyline points="${points('downloads')}" fill="none" stroke="#a2bb79" stroke-width="2.5" stroke-dasharray="5 3"/>`;
  const axis = node('div', undefined, 'chart-axis'); axis.append(node('span', series[0].date), node('span', series.at(-1).date));
  const details = node('details', undefined, 'chart-data'); details.append(node('summary', '查看每日数据')); const table = node('table'); const head = node('tr'); ['日期', '访问', '访客', '下载点击'].forEach(text => head.append(node('th', text))); table.append(head);
  for (const item of series) { const row = node('tr'); [item.date, item.views, item.visitors, item.downloads].forEach(value => row.append(node('td', value))); table.append(row); }
  details.append(table); parent.append(svg, axis, details);
}
async function loadStats() {
  const request = ++statsRequest; $('#updated-at').textContent = '正在读取访问数据…';
  try {
    const data = await api(`stats?days=${days}`); if (request !== statsRequest) return;
    $('#metric-views').textContent = number(data.views); $('#metric-visitors').textContent = number(data.visitors); $('#metric-downloads').textContent = number(data.downloads);
    $('#updated-at').textContent = `最近 ${data.days} 天 · 更新于 ${new Date(data.updatedAt).toLocaleTimeString('zh-CN')}`;
    chart(data.series); rows('#architectures', platforms.map(([key, label]) => [label, data.architectures[key]]), '还没有下载点击。');
    rows('#version-stats', Object.entries(data.versions).sort((a, b) => b[1] - a[1]), '版本下载记录会显示在这里。');
    const sources = {direct: '直接访问 / 站内', github: 'GitHub', search: '搜索引擎', other: '其他网站'};
    rows('#sources', Object.entries(data.sources).map(([key, count]) => [sources[key] || '其他', count]), '还没有来源记录。');
    notice(data.complete ? '' : '当前结果不完整：单日超过 1,024 条事件。已显示部分数据，请扩展统计存储后查看完整总量。', !data.complete);
  } catch (error) { if (request === statsRequest) { $('#updated-at').textContent = '本次读取失败；屏幕上的旧数据未刷新'; notice(error.message, true); } }
}
async function loadReleases() {
  try {
    const result = await api('releases'); releases = result.releases; current = result.current;
    $('#current-version').textContent = current.manifest.version ? `v${current.manifest.version}` : '尚未提供安装包';
    const count = Object.values(current.manifest.assets).filter(Boolean).length;
    $('#current-detail').textContent = `${count} 个架构可下载 · ${current.id ? '由后台维护' : '使用随站点部署的版本'}`;
    $('#current-link').href = current.manifest.tag ? `https://github.com/heyjianhang/career/releases/tag/${current.manifest.tag}` : 'https://github.com/heyjianhang/career/releases';
    const list = $('#release-list'); list.replaceChildren();
    if (!releases.length) list.append(node('p', '还没有后台版本记录。新建草稿后，可以验证并设为首页下载。', 'empty'));
    for (const release of releases) {
      const live = current.id === release.id && JSON.stringify(current.manifest) === JSON.stringify(release.manifest) && current.notes === release.notes;
      const row = node('div', undefined, 'release-row'); const description = node('div', undefined, 'release-description'); const title = node('div', undefined, 'release-title'); title.append(node('strong', `v${release.manifest.version}`), node('span', live ? '首页使用中' : '草稿 / 可发布', `badge ${live ? 'live' : ''}`));
      description.append(title, node('p', `${Object.values(release.manifest.assets).filter(Boolean).length} 个架构 · ${new Date(release.updatedAt).toLocaleString('zh-CN')}`, 'muted'), node('p', release.notes || '尚未填写更新说明', 'release-notes'));
      const actions = node('div', undefined, 'release-actions'); const edit = node('button', '编辑', 'button secondary'); edit.type = 'button'; edit.addEventListener('click', () => openEditor(release));
      const publish = node('button', live ? '重新验证' : '设为首页版本', 'button secondary'); publish.type = 'button'; publish.addEventListener('click', () => openPublish(release)); actions.append(edit, publish); row.append(description, actions); list.append(row);
    }
  } catch (error) { notice(error.message, true); }
}
for (const [key, label] of platforms) {
  const item = node('div', undefined, 'asset-item'); const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.dataset.platform = key; checkbox.id = `asset-${key}`;
  const labelEl = node('label', label); labelEl.htmlFor = checkbox.id; labelEl.prepend(checkbox); const url = node('p', '', 'asset-url'); url.dataset.url = key; item.append(labelEl, url); $('#asset-fields').append(item);
}
function manifestFromForm() {
  const version = $('#release-version').value.trim(); const tag = `desktop-v${version}`;
  return {version, tag, assets: Object.fromEntries(platforms.map(([key]) => [key, $(`#asset-${key}`).checked ? `https://github.com/heyjianhang/career/releases/download/${tag}/career-${version}-${key}.${key.startsWith('mac') ? 'dmg' : 'exe'}` : null]))};
}
function updateAssets() { const manifest = manifestFromForm(); $('#release-tag').textContent = manifest.version ? `GitHub 标签：${manifest.tag}` : '填写版本后生成 Release 标签和下载地址。'; platforms.forEach(([key]) => { $(`[data-url="${key}"]`).textContent = manifest.version ? (manifest.assets[key] || '本次不提供') : '等待填写版本号'; }); }
$('#release-version').addEventListener('input', updateAssets); $('#asset-fields').addEventListener('change', updateAssets);
function openEditor(release = null) {
  editing = release; $('#editor-title').textContent = release ? '编辑版本草稿' : '新建版本'; $('#release-version').value = release?.manifest.version || ''; $('#release-notes').value = release?.notes || ''; $('#editor-error').textContent = '';
  platforms.forEach(([key]) => { $(`#asset-${key}`).checked = release ? !!release.manifest.assets[key] : false; }); updateAssets(); $('#editor').showModal();
}
$('#new-release').addEventListener('click', () => openEditor());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()));
$('#release-form').addEventListener('submit', async event => {
  event.preventDefault(); $('#editor-error').textContent = '';
  try { await busy(event.submitter, async () => { await api('releases', {id: editing?.id, revision: editing?.revision, manifest: manifestFromForm(), notes: $('#release-notes').value}); $('#editor').close(); await loadReleases(); notice('草稿已保存，首页下载未改变。'); }); }
  catch (error) { $('#editor-error').textContent = error.message; }
});
function openPublish(release) {
  publishing = release; $('#publish-summary').textContent = `将首页从 v${current.manifest.version || '未发布'} 切换为 v${release.manifest.version}。`;
  $('#publish-error').textContent = ''; $('#acceptance').checked = false; $('#publish-confirm').disabled = true; $('#publish-dialog').showModal();
}
$('#acceptance').addEventListener('change', () => { $('#publish-confirm').disabled = !$('#acceptance').checked; });
$('#publish-confirm').addEventListener('click', async event => {
  $('#publish-error').textContent = '';
  try { await busy(event.target, async () => { await api('publish', {id: publishing.id, revision: publishing.revision, currentRevision: current.revision, accepted: true}); $('#publish-dialog').close(); await loadReleases(); notice('首页下载版本已更新，重新打开官网即可查看。'); }, '正在验证公开安装包…'); }
  catch (error) { $('#publish-error').textContent = error.message; }
});
enter().catch(error => { showLogin(); if (!/请先登录/.test(error.message)) $('#login-error').textContent = error.message; });
