import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderDownloads,releasesUrl} from '../scripts/site-downloads.mjs';
const empty=()=>({version:null,tag:null,assets:{'mac-arm64':null,'mac-x64':null,'win-x64':null,'win-arm64':null}});
const published=()=>({version:'0.3.0-alpha.1',tag:'desktop-v0.3.0-alpha.1',assets:{...empty().assets,
  'mac-arm64':`${releasesUrl}/download/desktop-v0.3.0-alpha.1/career-0.3.0-alpha.1-mac-arm64.dmg`,
  'win-x64':`${releasesUrl}/download/desktop-v0.3.0-alpha.1/career-0.3.0-alpha.1-win-x64.exe`,
}});

test('portal has no invented downloads before a desktop release',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../site/downloads.json',import.meta.url),'utf8'));
  assert.doesNotThrow(()=>renderDownloads(manifest));
  const result=renderDownloads(empty());
  assert.equal(result.RELEASE_URL,releasesUrl);
  assert.doesNotMatch(result.MAC_DOWNLOADS+result.WINDOWS_DOWNLOADS,/href=/);
  assert.equal((result.MAC_DOWNLOADS+result.WINDOWS_DOWNLOADS).match(/ disabled /g).length,4);
  assert.doesNotMatch(result.DESKTOP_RELEASE,/v\d/);
});

test('partial desktop releases only enable verified system and architecture assets',()=>{
  const result=renderDownloads(published());
  assert.match(result.DESKTOP_RELEASE,/v0.3.0-alpha.1 · 预览版/);
  assert.match(result.MAC_DOWNLOADS,/aria-label="下载 macOS Apple Silicon 安装包"/);
  assert.match(result.MAC_DOWNLOADS,/disabled aria-label="macOS Intel 安装包准备中"/);
  assert.match(result.WINDOWS_DOWNLOADS,/aria-label="下载 Windows x64 安装包"/);
  assert.match(result.WINDOWS_DOWNLOADS,/disabled aria-label="Windows ARM64 安装包准备中"/);
  assert.equal(result.RELEASE_URL,`${releasesUrl}/tag/desktop-v0.3.0-alpha.1`);
});

test('portal rejects stale versions, wrong architectures and unofficial installer locations',()=>{
  for(const [from,to] of [
    ['https://github.com','http://github.com'],
    ['/heyjianhang/career/','/someone/career/'],
    ['/download/desktop-v0.3.0-alpha.1/','/download/desktop-v0.2.0/'],
    ['-mac-arm64.dmg','-mac-x64.dmg'],
    ['-mac-arm64.dmg','-mac-arm64.zip'],
    ['-mac-arm64.dmg','-mac-arm64.dmg?token=secret'],
  ]){
    const config=published();config.assets['mac-arm64']=config.assets['mac-arm64'].replace(from,to);
    assert.throws(()=>renderDownloads(config),`${from} → ${to}`);
  }
  assert.throws(()=>renderDownloads({...empty(),version:'0.3.0'}));
});
