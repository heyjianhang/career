import assert from 'node:assert/strict';

export const releasesUrl='https://github.com/heyjianhang/career/releases';
const variants={
  'mac-arm64':{label:'Apple Silicon',system:'macOS',extension:'.dmg'},
  'mac-x64':{label:'Intel',system:'macOS',extension:'.dmg'},
  'win-x64':{label:'x64',system:'Windows',extension:'.exe'},
  'win-arm64':{label:'ARM64',system:'Windows',extension:'.exe'},
};
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

// This manifest describes verified public assets, not the local desktop candidate.
// Null entries must never produce a guessed /latest/download URL.
export function renderDownloads(config){
  assert.deepEqual(Object.keys(config).sort(),['assets','tag','version']);
  assert.deepEqual(Object.keys(config.assets).sort(),Object.keys(variants).sort());
  const available=Object.values(config.assets).filter(url=>url!==null);
  if(available.length){
    assert.match(config.version,/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,'A published desktop version is required');
    assert.equal(typeof config.tag,'string');
    assert.ok(config.tag.includes(config.version)&&!/[\s/#?]/.test(config.tag),'Release tag must identify the published desktop version');
  }else{
    assert.equal(config.version,null,'Do not advertise a desktop version without public assets');
    assert.equal(config.tag,null);
  }
  const releaseUrl=available.length?`${releasesUrl}/tag/${encodeURIComponent(config.tag)}`:releasesUrl;
  const options=Object.entries(variants).map(([key,variant])=>{
    const url=config.assets[key];
    if(url===null)return `<button type="button" class="download-option" disabled aria-label="${variant.system} ${variant.label} 安装包准备中"><span>${variant.label}</span><small>准备中</small></button>`;
    assert.equal(typeof url,'string');
    const parsed=new URL(url);
    assert.equal(parsed.origin,'https://github.com','Installer must be an official GitHub release asset');
    assert.equal(parsed.username+parsed.password+parsed.search+parsed.hash,'');
    const prefix=`/heyjianhang/career/releases/download/${encodeURIComponent(config.tag)}/`;
    assert.ok(parsed.pathname.startsWith(prefix),'Installer must belong to the selected career release');
    const filename=decodeURIComponent(parsed.pathname.slice(prefix.length));
    assert.ok(!filename.includes('/')&&filename.includes(config.version)&&filename.endsWith(`-${key}${variant.extension}`),'Installer filename must match its version, OS and architecture');
    return `<a class="download-option" href="${escape(url)}" aria-label="下载 ${variant.system} ${variant.label} 安装包"><span>${variant.label}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg></a>`;
  });
  return {
    DESKTOP_RELEASE:available.length?`v${config.version}${config.version.includes('-')?' · 预览版':''}`:'预览版准备中',
    MAC_DOWNLOADS:options.slice(0,2).join(''),
    WINDOWS_DOWNLOADS:options.slice(2).join(''),
    DOWNLOAD_STATUS:available.length?'内含运行环境，无需安装 Node.js 或 npm。':'安装包公开发布后，即可在这里下载。',
    RELEASE_URL:releaseUrl,
    RELEASE_LABEL:available.length?'发布说明与全部下载':'查看发布进度',
  };
}
