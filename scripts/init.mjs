import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {args, defaultWorkspace, directory, isMain, noLinks, projectRoot} from './paths.mjs';

export async function initialize(workspace = defaultWorkspace) {
  workspace = path.resolve(workspace);
  await directory(workspace);
  const configPath = path.join(workspace, 'career.json');
  await noLinks(configPath);
  try {
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    if (config.schema !== 'career-workspace/v1' || config.resume_dir !== 'resume') {
      throw new Error('已有 career.json 的格式或 resume_dir 不兼容；未覆盖，请先核对配置');
    }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }

  const directories = ['sources', 'assets', 'facts/education', 'facts/employment', 'facts/projects',
    'facts/skills', 'facts/languages', 'facts/certificates', 'master/employment', 'master/projects', 'versions'];
  for (const dir of directories) await directory(path.join(workspace, 'resume', dir));
  await directory(path.join(workspace, 'context', 'sessions'));
  const today = new Intl.DateTimeFormat('en-CA', {year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const config = {schema: 'career-workspace/v1', resume_dir: 'resume', locale: 'zh-CN',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone};
  const files = new Map([
    ['career.json', JSON.stringify(config, null, 2) + '\n'],
    ['README.md', '# 我的 career 工作区\n\n原始材料放在 `resume/sources/`。在 Agent 软件中打开本目录（或添加为现有项目），新建对话并发送：“请读取当前工作区的 AGENTS.md，按已有进度引导我开始使用 career。”\n\n请读取本目录 AGENTS.md 完成首次引导。可先仅保存在本机，或连接自己的 GitHub 私人仓库；本地版本与远程同步分别记录。\n'],
  ]);
  for (const [dest, skill, template] of [
    ['resume/facts/profile.md', 'career-intake', 'facts/profile.md'],
    ['resume/master/index.md', 'resume-master', 'index.md'],
    ['resume/questions.md', 'career-intake', 'questions.md'],
    ['resume/maintenance.md', 'career-intake', 'maintenance.md'],
  ]) {
    const content = await readFile(path.join(projectRoot, '.agents/skills', skill, 'templates', template), 'utf8');
    files.set(dest, content.replaceAll('__TODAY__', today));
  }
  for (const name of ['INDEX.md', 'goals.md', 'progress.md', 'state.md', 'decisions.md', 'feedback.md']) {
    const content = await readFile(path.join(projectRoot, 'templates/context', name), 'utf8');
    files.set(`context/${name}`, content.replaceAll('__TODAY__', today));
  }
  const result = {workspace, created: [], preserved: []};
  for (const [relative, content] of files) {
    const file = path.join(workspace, relative);
    await noLinks(file);
    try { await writeFile(file, content, {flag: 'wx'}); result.created.push(relative); }
    catch (e) { if (e.code !== 'EEXIST') throw e; result.preserved.push(relative); }
  }
  return result;
}

if (isMain(import.meta.url)) {
  try {
    const options = args(process.argv.slice(2), ['--workspace']);
    const result = await initialize(options['--workspace']);
    console.log(`工作区：${result.workspace}\n新建 ${result.created.length} 个文件，保留 ${result.preserved.length} 个已有文件。`);
    console.log('接下来读取 context/progress.md、context/state.md 与 resume/maintenance.md：先核对阶段和范围，再接着当前一项整理。');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
