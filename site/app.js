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
