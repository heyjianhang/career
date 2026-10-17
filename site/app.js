const downloadPickers = [...document.querySelectorAll('.download-picker')];
function closeDownloadPickers(except) {
  for (const picker of downloadPickers) if (picker !== except) picker.open = false;
}
for (const picker of downloadPickers) {
  picker.addEventListener('toggle', () => { if (picker.open) closeDownloadPickers(picker); });
  picker.addEventListener('keydown', event => {
    if (event.key === 'Escape' && picker.open) {
      event.preventDefault();
      picker.open = false;
      picker.querySelector('summary').focus();
    }
  });
  picker.addEventListener('focusout', () => {
    requestAnimationFrame(() => { if (!picker.contains(document.activeElement)) picker.open = false; });
  });
  picker.addEventListener('click', event => {
    if (event.target.closest('a.download-option')) picker.open = false;
  });
}
document.addEventListener('click', event => {
  closeDownloadPickers(event.target.closest('.download-picker'));
});

// Keep the alternative installer closed until explicitly requested.
document.querySelector('.alternative-link').addEventListener('click', () => {
  document.querySelector('#agent-install details').open = true;
});
if (location.hash === '#agent-install') document.querySelector('#agent-install details').open = true;
document.querySelectorAll('a[href="#agent-install"]').forEach(link => link.addEventListener('click', () => { document.querySelector('#agent-install details').open = true; }));

const prompt = document.querySelector('#prompt');
const copy = document.querySelector('#copy');
const status = document.querySelector('#copy-status');
copy.addEventListener('click', async () => {
  copy.disabled = true;
  try {
    await navigator.clipboard.writeText(prompt.textContent);
    status.textContent = '已复制，粘贴给你的 Agent 就可以开始。';
    copy.querySelector('span').textContent = '已复制安装指令';
  } catch {
    prompt.focus();
    const range = document.createRange();
    range.selectNodeContents(prompt);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = '已选中全部指令，请按 ⌘C 或 Ctrl+C 复制。';
  } finally {
    copy.disabled = false;
  }
});

const image = document.querySelector('#preview-image');
const imageButton = document.querySelector('#preview-image-button');
const dialog = document.querySelector('#image-dialog');
const dialogImage = document.querySelector('#dialog-image');
const dialogTitle = document.querySelector('#dialog-title');
const previews = {
  workspace: {name:'简历工作台',src:'assets/workspace.jpg',alt:'career 简历工作台，展示分页简历、照片、项目链接和导出按钮；内容为虚构示例'},
  styles: {name:'排版样式',src:'assets/styles.jpg',alt:'career 排版样式选择器，展示 14 款简历排版；内容为虚构示例'},
};
let current = previews.workspace;
for (const button of document.querySelectorAll('[data-preview]')) {
  button.addEventListener('click', () => {
    current = previews[button.dataset.preview];
    image.src = current.src;
    image.alt = current.alt;
    imageButton.setAttribute('aria-label', `放大${current.name}截图`);
    for (const item of document.querySelectorAll('[data-preview]')) item.setAttribute('aria-pressed', String(item === button));
  });
}
function expand() {
  dialogImage.src = current.src;
  dialogImage.alt = current.alt;
  dialogTitle.textContent = current.name;
  dialog.showModal();
}
document.querySelector('#expand').addEventListener('click', expand);
imageButton.addEventListener('click', expand);
document.querySelector('#close-preview').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {if (event.target === dialog) dialog.close();});

const privacyDialog = document.querySelector('#privacy-dialog');
document.querySelector('#privacy-open').addEventListener('click', () => privacyDialog.showModal());
document.querySelector('#privacy-close').addEventListener('click', () => privacyDialog.close());
const optout = document.querySelector('#analytics-optout');
const storage = {get(key) { try { return localStorage.getItem(key); } catch { return null; } }, set(key, value) { try { localStorage.setItem(key, value); } catch {} }};
optout.checked = storage.get('career-analytics-off') === '1';
optout.addEventListener('change', () => storage.set('career-analytics-off', optout.checked ? '1' : '0'));
let tracking = false;
function track(type, extra = {}) {
  if (!tracking || optout.checked || navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
  let visitor;
  try { visitor = JSON.parse(storage.get('career-visitor')); } catch {}
  if (!visitor || !/^[a-f0-9]{32}$/.test(visitor.id) || visitor.expires < Date.now()) {
    visitor = {id: crypto.randomUUID().replaceAll('-', ''), expires: Date.now() + 30 * 86400000};
    storage.set('career-visitor', JSON.stringify(visitor));
  }
  let source = 'direct';
  try { const host = new URL(document.referrer).hostname; if (host !== location.hostname) source = host === 'github.com' ? 'github' : /(^|\.)(google|bing|baidu)\./.test(host) ? 'search' : 'other'; } catch {}
  const event = JSON.stringify({type, event: crypto.randomUUID().replaceAll('-', ''), visitor: visitor.id, source, ...extra});
  // The actual installer link remains direct; a failed measurement never blocks a download.
  if (!navigator.sendBeacon?.('/api/events', new Blob([event], {type: 'text/plain'}))) fetch('/api/events', {method: 'POST', body: event, headers: {'Content-Type': 'application/json'}, keepalive: true}).catch(() => {});
}
document.querySelector('.download-platforms').addEventListener('click', event => {
  const link = event.target.closest('a[data-platform]');
  if (link) track('download', {platform: link.dataset.platform, version: link.dataset.version});
});
async function refreshDownloads() {
  try {
    const response = await fetch('/api/downloads', {signal: AbortSignal.timeout(4000)});
    if (!response.ok) return;
    const data = await response.json(); const config = data.manifest;
    if (config?.version) {
      if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(config.version) || config.tag !== `desktop-v${config.version}`) return;
      const variants = [['mac-arm64', 'Apple Silicon', 'macOS'], ['mac-x64', 'Intel', 'macOS'], ['win-x64', 'x64', 'Windows'], ['win-arm64', 'ARM64', 'Windows']];
      for (const [key] of variants) if (config.assets[key] !== null && config.assets[key] !== `https://github.com/heyjianhang/career/releases/download/${config.tag}/career-${config.version}-${key}.${key.startsWith('mac') ? 'dmg' : 'exe'}`) return;
      for (const [index, group] of [...document.querySelectorAll('.download-options')].entries()) {
        group.replaceChildren(...variants.slice(index * 2, index * 2 + 2).map(([key, label, system]) => {
          const link = document.createElement(config.assets[key] ? 'a' : 'button'); link.className = 'download-option';
          const name = document.createElement('span'); name.textContent = label; link.append(name);
          if (config.assets[key]) { link.href = config.assets[key]; link.dataset.platform = key; link.dataset.version = config.version; link.setAttribute('aria-label', `下载 ${system} ${label} 安装包`); const arrow = document.createElement('span'); arrow.textContent = '↓'; arrow.setAttribute('aria-hidden', 'true'); link.append(arrow); }
          else { link.disabled = true; link.textContent = `${label} · 准备中`; }
          return link;
        }));
      }
      document.querySelector('#desktop-version').textContent = `v${config.version}${config.version.includes('-') ? ' · 预览版' : ''}`;
      document.querySelector('#release-link').href = `https://github.com/heyjianhang/career/releases/tag/${config.tag}`;
    }
    tracking = !!data.tracking;
    if (document.visibilityState === 'visible') track('view');
    else document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') track('view'); }, {once: true});
  } catch { /* The build-time verified download links remain usable while offline. */ }
}
refreshDownloads();
