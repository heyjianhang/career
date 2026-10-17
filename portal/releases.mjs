// Shared by the static build, management API and browser-facing release feed.
export const repository = 'heyjianhang/career';
export const platforms = ['mac-arm64', 'mac-x64', 'win-x64', 'win-arm64'];
export function validateManifest(value) {
  if (!value || typeof value !== 'object' || !value.assets ||
      Object.keys(value).sort().join() !== 'assets,tag,version' ||
      Object.keys(value.assets).sort().join() !== [...platforms].sort().join()) throw new Error('安装包清单格式不正确');
  const available = Object.values(value.assets).filter(url => url !== null);
  if (!available.length) {
    if (value.version !== null || value.tag !== null) throw new Error('没有公开安装包时，版本与标签应为空');
    return value;
  }
  if (typeof value.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.version) ||
      value.version.length > 80 || value.tag !== `desktop-v${value.version}`) throw new Error('版本或 Release 标签不正确');
  for (const key of platforms) {
    if (value.assets[key] === null) continue;
    const expected = `https://github.com/${repository}/releases/download/${value.tag}/career-${value.version}-${key}.${key.startsWith('mac') ? 'dmg' : 'exe'}`;
    if (value.assets[key] !== expected) throw new Error(`${key} 必须使用对应版本的官方 GitHub 安装包地址`);
  }
  return value;
}

// Public metadata and a one-byte range GET verify visibility without downloading installers.
export async function verifyRelease(manifest, fetcher = fetch) {
  validateManifest(manifest);
  if (!manifest.version) throw new Error('请至少填写一个安装包');
  const response = await fetcher(`https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(manifest.tag)}`, {
    headers: {Accept: 'application/vnd.github+json', 'User-Agent': 'career-portal'}, signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? 'GitHub 暂时限流，请稍后重新验证' : '找不到公开 Release，请先在 GitHub 发布安装包');
  const release = await response.json();
  if (release.draft || release.tag_name !== manifest.tag || !release.published_at) throw new Error('Release 尚未公开');
  const verified = {};
  for (const key of platforms) {
    const url = manifest.assets[key];
    if (!url) continue;
    const asset = release.assets?.find(item => item.browser_download_url === url && item.state === 'uploaded' && item.size > 0);
    if (!asset) throw new Error(`${key} 安装包尚未上传完成`);
    const download = await fetcher(url, {headers: {Range: 'bytes=0-0'}, signal: AbortSignal.timeout(15000), redirect: 'follow'});
    try {
      const finalUrl = new URL(download.url || url);
      if (!download.ok || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(finalUrl.hostname) ||
          /text\/html|application\/json/i.test(download.headers.get('content-type') || '')) throw new Error(`${key} 无法匿名下载`);
      verified[key] = {size: asset.size, digest: /^sha256:[a-f0-9]{64}$/.test(asset.digest || '') ? asset.digest : null};
    } finally { await download.body?.cancel(); }
  }
  return {assets: verified, prerelease: !!release.prerelease};
}
