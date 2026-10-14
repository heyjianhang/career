import test from 'node:test';
import assert from 'node:assert/strict';
import {cp, mkdtemp, readFile, realpath, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {initialize} from '../scripts/init.mjs';
import {validate} from '../scripts/validate.mjs';
import {freeze} from '../scripts/freeze.mjs';
import {readRecord, serialize} from '../scripts/records.mjs';
import {projectRoot} from '../scripts/paths.mjs';

const example = path.join(projectRoot, 'examples/fictional-operations');
const version = 'resume-example-events';
const versionDir = `resume/versions/${version}`;
const resumeFile = `${versionDir}/resume.md`;
const employmentFile = 'resume/facts/employment/employment-example-bookstore.md';
async function temp(t, fixture = false) {
  const dir = await mkdtemp(path.join(await realpath(tmpdir()), 'career-test-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  if (fixture) await cp(example, dir, {recursive: true});
  return dir;
}
async function edit(workspace, file, change) {
  const record = await readRecord(path.join(workspace, file));
  change(record.meta);
  await writeFile(path.join(workspace, file), serialize(record.meta, record.body));
}
const has = (values, pattern) => assert.ok(values.some(value => pattern.test(value)), values.join('\n'));

test('new workspace validates; reinitialization preserves edited files byte for byte', async t => {
  const dir = await temp(t);
  assert.equal((await initialize(dir)).created.length, 12);
  const profile = path.join(dir, 'resume/facts/profile.md');
  const custom = (await readFile(profile, 'utf8')) + '\n我的自定义内容\n';
  await writeFile(profile, custom);
  const goalsFile = path.join(dir, 'context/goals.md');
  const goals = '# 用户已填写的目标\n\n只考虑本地工作，来源：本轮用户说明。\n';
  await writeFile(goalsFile, goals);
  const maintenanceFile = path.join(dir, 'resume/maintenance.md');
  const maintenance = '# 已维护记录\n\n初期维护已完成；新项目待更新母版。\n';
  await writeFile(maintenanceFile, maintenance);
  const result = await initialize(dir);
  assert.equal(result.created.length, 0);
  assert.equal(result.preserved.length, 12);
  assert.equal(await readFile(profile, 'utf8'), custom);
  assert.equal(await readFile(goalsFile, 'utf8'), goals);
  assert.equal(await readFile(maintenanceFile, 'utf8'), maintenance);
  assert.deepEqual((await validate(dir)).errors, []);
});

test('legacy workspace gains context without changing its existing resume data', async t => {
  const dir = await temp(t, true);
  await rm(path.join(dir, 'context'), {recursive: true, force: true});
  const original = await readFile(path.join(dir, employmentFile), 'utf8');
  const result = await initialize(dir);
  assert.equal(result.created.filter(file => file.startsWith('context/')).length, 6);
  assert.equal(await readFile(path.join(dir, employmentFile), 'utf8'), original);
  assert.deepEqual((await validate(dir)).errors, []);
  assert.doesNotMatch(await readFile(path.join(dir, 'context/INDEX.md'), 'utf8'), /__TODAY__/);
  assert.match(await readFile(path.join(dir, 'context/state.md'), 'utf8'), /尚未核对个人材料/);
});

test('partial initialization resumes without replacing other data or custom config', async t => {
  const dir = await temp(t);
  await initialize(dir);
  const configFile = path.join(dir, 'career.json');
  const config = JSON.parse(await readFile(configFile));
  config.my_custom_field = {keep: true};
  const original = JSON.stringify(config, null, 4);
  await writeFile(configFile, original);
  await rm(path.join(dir, 'resume/master/index.md'));
  await writeFile(path.join(dir, 'resume/sources/old-notes.md'), '旧材料');
  const result = await initialize(dir);
  assert.deepEqual(result.created, ['resume/master/index.md']);
  assert.equal(await readFile(configFile, 'utf8'), original);
  assert.equal(await readFile(path.join(dir, 'resume/sources/old-notes.md'), 'utf8'), '旧材料');
});

test('existing resume gains a maintenance ledger without resetting facts, masters or context', async t => {
  const dir = await temp(t, true);
  await rm(path.join(dir, 'resume/maintenance.md'), {force: true});
  const protectedFiles = [employmentFile, 'resume/master/index.md', 'resume/master/projects/master-project-example.md', 'context/state.md'];
  const originals = await Promise.all(protectedFiles.map(file => readFile(path.join(dir, file), 'utf8')));
  const result = await initialize(dir);
  assert.ok(result.created.includes('resume/maintenance.md'));
  for (let i = 0; i < protectedFiles.length; i++) {
    assert.equal(await readFile(path.join(dir, protectedFiles[i]), 'utf8'), originals[i]);
  }
  const ledger = await readFile(path.join(dir, 'resume/maintenance.md'), 'utf8');
  assert.match(ledger, /未盘点/);
  assert.doesNotMatch(ledger, /__TODAY__/);
  // A fresh ledger must not declare existing facts or the whole resume complete.
  assert.doesNotMatch(ledger, /初期维护：已完成|本轮已整理/);
  assert.deepEqual((await validate(dir)).errors, []);
});

test('legacy workspace gains stage progress without changing assets or existing conversation, and preserves later edits', async t => {
  const dir = await temp(t, true);
  await initialize(dir);
  const progress = path.join(dir, 'context/progress.md');
  await rm(progress);
  const protectedFiles = [employmentFile, 'resume/master/index.md', 'resume/maintenance.md', 'context/state.md', 'context/goals.md'];
  const originals = await Promise.all(protectedFiles.map(file => readFile(path.join(dir, file), 'utf8')));
  const result = await initialize(dir);
  assert.deepEqual(result.created, ['context/progress.md']);
  for (let i = 0; i < protectedFiles.length; i++) assert.equal(await readFile(path.join(dir, protectedFiles[i]), 'utf8'), originals[i]);
  const content = await readFile(progress, 'utf8');
  assert.match(content, /当前大阶段：待核对/);
  assert.doesNotMatch(content, /__TODAY__/);
  const edited = content + '\n本轮只整理书店任职；仍待了解现场核对过程。\n';
  await writeFile(progress, edited);
  assert.deepEqual((await initialize(dir)).created, []);
  assert.equal(await readFile(progress, 'utf8'), edited);
  assert.deepEqual((await validate(dir)).errors, []);
});

test('incompatible config is not replaced', async t => {
  const dir = await temp(t);
  const file = path.join(dir, 'career.json');
  const original = '{"schema":"unknown","resume_dir":"elsewhere"}';
  await writeFile(file, original);
  await assert.rejects(initialize(dir), /不兼容/);
  assert.equal(await readFile(file, 'utf8'), original);
});

test('initialization and validation reject linked data without changing its target', async t => {
  const dir = await temp(t);
  await initialize(dir);
  const linked = path.join(dir, 'resume/facts/profile.md');
  const target = path.join(dir, 'original.md');
  await writeFile(target, '外部资料');
  await rm(linked);
  await symlink(target, linked);
  await assert.rejects(initialize(dir), /符号链接/);
  has((await validate(dir)).errors, /符号链接/);
  assert.equal(await readFile(target, 'utf8'), '外部资料');
});

test('default workspace is Git ignored while templates and examples are publishable', async t => {
  const repo = await temp(t);
  await cp(path.join(projectRoot, '.gitignore'), path.join(repo, '.gitignore'));
  execFileSync('git', ['init', '-q'], {cwd: repo});
  await initialize(path.join(repo, 'workspace'));
  const ignored = execFileSync('git', ['check-ignore', 'workspace/resume/facts/profile.md'], {cwd: repo, encoding: 'utf8'});
  assert.equal(ignored.trim(), 'workspace/resume/facts/profile.md');
  const generatedOrPrivate = ['.env', '.env.local', '.npmrc', 'private.key', 'local/cert.pem', 'node_modules/cache.js', 'nested/node_modules/cache.js', 'dist/cli.js', 'resources/workspace/AGENTS.md', '.cache/screenshot.png', 'build/resume.pdf', 'outputs/private.html', 'playwright-report/index.html', 'test-results/trace.zip', 'career-0.2.0.tgz'];
  const excluded = execFileSync('git', ['check-ignore', ...generatedOrPrivate], {cwd: repo, encoding: 'utf8'}).trim().split('\n');
  assert.deepEqual(excluded, generatedOrPrivate);
  const publicFiles = spawnSync('git', ['check-ignore', '.agents/skills/career-intake/templates/facts/profile.md', 'examples/fictional-operations/resume/facts/profile.md', 'docs/assets/career-hero.png', 'docs/brand.md', 'docs/roadmap.md', '.env.example', 'LICENSE', 'src/cli.ts'], {cwd: repo});
  assert.equal(publicFiles.status, 1);
});

test('fictional example links every layer and keeps the known gaps visible', async () => {
  const result = await validate(example);
  assert.deepEqual(result.errors, []);
  assert.equal(result.records.length, 15);
  assert.equal(result.warnings.length, 2);
  has(result.warnings, /仍不完整/);
  has(result.warnings, /模板仍待核实/);
});

test('duplicate IDs and unresolved sources are errors', async t => {
  const dir = await temp(t, true);
  await cp(path.join(dir, employmentFile), path.join(dir, 'resume/facts/employment/duplicate.md'));
  await edit(dir, 'resume/facts/profile.md', m => { m.source_ids = ['source-does-not-exist']; });
  const result = await validate(dir);
  has(result.errors, /ID 重复/);
  has(result.errors, /引用不存在: source-does-not-exist/);
});

test('invalid calendar dates, month precision and contradictory current dates are rejected', async t => {
  const dir = await temp(t, true);
  await edit(dir, employmentFile, m => { m.start = '2024-13'; m.is_current = true; m.updated = '2026-02-30'; });
  await edit(dir, resumeFile, m => { m.generated_at = '2026-02-30T12:00:00+08:00'; });
  const result = await validate(dir);
  has(result.errors, /updated/);
  has(result.errors, /start 必须/);
  has(result.errors, /至今与结束日期冲突/);
  has(result.errors, /生成时间/);
});

test('duplicate YAML keys fail rather than silently replacing values', async t => {
  const dir = await temp(t, true);
  const file = path.join(dir, 'resume/facts/profile.md');
  const original = await readFile(file, 'utf8');
  await writeFile(file, original.replace('---\n', '---\nid: conflicting-id\n'));
  has((await validate(dir)).errors, /unique|重复/i);
});

test('changed facts warn without changing master wording; reviewable masters need baselines', async t => {
  const dir = await temp(t, true);
  const master = 'resume/master/employment/master-employment-example.md';
  const original = await readFile(path.join(dir, master), 'utf8');
  await edit(dir, employmentFile, m => { m.department = '新增部门'; });
  has((await validate(dir)).warnings, /来源已变化/);
  assert.equal(await readFile(path.join(dir, master), 'utf8'), original);
  await edit(dir, master, m => { m.based_on = {}; });
  has((await validate(dir)).errors, /缺少已核对来源摘要/);
});

test('JD reference and platform verification status must agree with their records', async t => {
  const dir = await temp(t, true);
  await edit(dir, resumeFile, m => { m.target_id = 'source-example-interview'; });
  await edit(dir, `${versionDir}/platforms/zhaopin.md`, m => { m.verification_status = 'verified'; });
  const result = await validate(dir);
  has(result.errors, /引用类型不符/);
  has(result.errors, /平台稿核对状态/);
});

test('malformed platform collections produce validation errors without crashing', async t => {
  const dir = await temp(t, true);
  for (const platforms of [{generic: true}, 1, ['../outside'], ['generic', 'generic']]) {
    await edit(dir, resumeFile, m => { m.platforms = platforms; });
    has((await validate(dir)).errors, /platforms 必须/);
  }
});

test('freezing records a valid snapshot; repeat execution preserves it and source updates do not rewrite it', async t => {
  const dir = await temp(t, true);
  assert.deepEqual(await freeze(dir, version), {id: version, preserved: false});
  assert.deepEqual((await validate(dir)).errors, []);
  const file = path.join(dir, resumeFile);
  const original = await readFile(file, 'utf8');
  const manifestFile = path.join(dir, versionDir, 'manifest.json');
  const manifestText = await readFile(manifestFile, 'utf8');
  const manifest = JSON.parse(manifestText);
  assert.ok(manifest.sources.some(source => source.id === 'source-example-interview'));
  assert.equal(manifest.templates.length, 2);
  assert.equal((await readRecord(file)).meta.state, 'frozen');
  assert.deepEqual(await freeze(dir, version), {id: version, preserved: true});
  await edit(dir, employmentFile, m => { m.department = '后续补充'; });
  assert.deepEqual((await validate(dir)).errors, []);
  assert.equal(await readFile(file, 'utf8'), original);
  assert.equal(await readFile(manifestFile, 'utf8'), manifestText);
});

test('changed frozen files are detected and cannot be silently re-frozen', async t => {
  const dir = await temp(t, true);
  await freeze(dir, version);
  const fieldFile = path.join(dir, versionDir, 'platforms/generic.md');
  await writeFile(fieldFile, (await readFile(fieldFile, 'utf8')) + '\n已改动\n');
  has((await validate(dir)).errors, /冻结内容已变化/);
  await assert.rejects(freeze(dir, version), /冻结内容已变化/);
});

test('interrupted freeze lock is preserved for review', async t => {
  const dir = await temp(t, true);
  const lock = path.join(dir, versionDir, '.freeze.lock');
  await writeFile(lock, '未核对的中断');
  await assert.rejects(freeze(dir, version), /EEXIST/);
  assert.equal(await readFile(lock, 'utf8'), '未核对的中断');
  assert.equal((await readRecord(path.join(dir, resumeFile))).meta.state, 'draft');
});
