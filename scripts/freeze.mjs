import {readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {args, defaultWorkspace, isMain, projectRoot, walk} from './paths.mjs';
import {readRecord, serialize, sha256} from './records.mjs';
import {validate} from './validate.mjs';

export async function freeze(workspace = defaultWorkspace, versionId) {
  workspace = path.resolve(workspace);
  const validation = await validate(workspace);
  if (validation.errors.length) throw new Error(validation.errors.join('\n'));
  const version = validation.records.find(record => record.meta.type === 'resume-version' && record.meta.id === versionId);
  if (!version) throw new Error(`没有该简历版本：${versionId}`);
  if (version.meta.state === 'frozen') return {id: versionId, preserved: true};
  const dir = path.dirname(version.file);
  const lock = path.join(dir, '.freeze.lock');
  const manifestPath = path.join(dir, 'manifest.json');
  const temp = path.join(dir, `.freeze-${randomUUID()}.tmp`);
  await writeFile(lock, '冻结进行中；若中断，先核对正文与清单，不要直接重建摘要。\n', {flag: 'wx'});
  let manifestText, wroteManifest = false, replacement;
  try {
    try { await readFile(manifestPath); throw new Error('草稿目录已有 manifest.json，请先核对中断或历史留存情况'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const now = new Date().toISOString();
    replacement = serialize({...version.meta, state: 'frozen', frozen_at: now}, version.body);
    const existing = (await walk(dir)).filter(file => file !== lock);
    const files = [];
    for (const file of existing) {
      const text = file === version.file ? replacement : await readFile(file);
      files.push({path: path.relative(dir, file).split(path.sep).join('/'), sha256: sha256(text)});
    }
    const byId = new Map(validation.records.map(record => [record.meta.id, record]));
    const dependencies = new Map();
    const visit = id => {
      if (dependencies.has(id)) return;
      const record = byId.get(id);
      if (!record) throw new Error(`冻结来源缺失：${id}`);
      dependencies.set(id, {id, path: path.relative(workspace, record.file).split(path.sep).join('/'), sha256: sha256(record.text)});
      if (record.meta.profile_id) visit(record.meta.profile_id);
      for (const section of record.meta.sections ?? []) for (const entry of section.ids) visit(entry);
      for (const source of record.meta.source_ids ?? []) visit(source);
    };
    visit(version.meta.source_master_id);
    const templates = [];
    for (const platform of version.meta.platforms) {
      const template = await readRecord(path.join(projectRoot, '.agents/skills/resume-tailor/templates/platforms', `${platform}.md`));
      templates.push({id: template.meta.id, revision: template.meta.revision, sha256: sha256(template.text), verification_status: template.meta.verification_status});
    }
    manifestText = JSON.stringify({schema: 'career-snapshot/v1', resume_id: versionId, frozen_at: now, files, sources: [...dependencies.values()], templates}, null, 2) + '\n';
    await writeFile(temp, replacement, {flag: 'wx'});
    if (await readFile(version.file, 'utf8') !== version.text) throw new Error('冻结前正文被其他编辑器修改，请重新核对');
    for (const file of existing.filter(file => file !== version.file)) {
      const expected = files.find(entry => entry.path === path.relative(dir, file).split(path.sep).join('/'));
      if (sha256(await readFile(file)) !== expected.sha256) throw new Error('冻结期间附件或字段稿发生变化，请重新核对');
    }
    const currentFiles = (await walk(dir)).filter(file => file !== lock && file !== temp);
    if (JSON.stringify(currentFiles) !== JSON.stringify(existing)) throw new Error('冻结期间文件列表发生变化，请重新核对');
    await writeFile(manifestPath, manifestText, {flag: 'wx'}); wroteManifest = true;
    await rename(temp, version.file);
    return {id: versionId, preserved: false};
  } catch (e) {
    // Remove only the manifest created by this attempt when the resume is unchanged.
    if (wroteManifest && await readFile(version.file, 'utf8') === version.text && await readFile(manifestPath, 'utf8') === manifestText) await rm(manifestPath);
    throw e;
  } finally {
    await rm(temp, {force: true});
    await rm(lock, {force: true});
  }
}

if (isMain(import.meta.url)) {
  try {
    const options = args(process.argv.slice(2), ['--workspace', '--version']);
    if (!options['--version']) throw new Error('请提供 --version <简历版本 ID>');
    const result = await freeze(options['--workspace'] ?? defaultWorkspace, options['--version']);
    console.log(result.preserved ? `保留已冻结版本：${result.id}` : `已留存版本：${result.id}；留存不代表内容完整或已投递。`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
