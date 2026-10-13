import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {args, defaultWorkspace, isMain, noLinks, projectRoot, walk} from './paths.mjs';
import {readRecord, sha256} from './records.mjs';

export const factTypes = ['profile', 'education', 'employment', 'project', 'skill', 'language', 'certificate'];
const types = [...factTypes, 'questions', 'source', 'master-index', 'master-entry', 'resume-version', 'resume-target', 'platform-output'];
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const digestPattern = /^[a-f0-9]{64}$/;
const own = (object, key) => Object.hasOwn(object, key);
const isoTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) && day(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const period = value => value === null || typeof value === 'string' && /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(value);
const periodMin = value => value.length === 4 ? `${value}-01` : value;
const periodMax = value => value.length === 4 ? `${value}-12` : value;

export async function validate(workspace = defaultWorkspace) {
  workspace = path.resolve(workspace);
  const root = path.join(workspace, 'resume');
  const errors = [], warnings = [], records = [], ids = new Map();
  const templates = new Map();
  const fail = (record, message) => errors.push(`${record?.file ? path.relative(workspace, record.file) : '工作区'}: ${message}`);
  const warn = (record, message) => warnings.push(`${path.relative(workspace, record.file)}: ${message}`);
  try {
    await noLinks(workspace);
    const config = JSON.parse(await readFile(path.join(workspace, 'career.json'), 'utf8'));
    if (config.schema !== 'career-workspace/v1' || config.resume_dir !== 'resume') fail(null, 'career.json 格式不兼容');
    for (const file of (await walk(path.join(projectRoot, '.agents/skills/resume-tailor/templates/platforms'))).filter(file => file.endsWith('.md'))) {
      const template = await readRecord(file);
      templates.set(template.meta.id, template.meta);
    }
    const files = (await walk(root)).filter(file => {
      const rel = path.relative(root, file).split(path.sep).join('/');
      return /^(facts|master)\/.*\.md$/.test(rel) || /^sources\/[^/]+\/source\.md$/.test(rel) ||
        rel === 'questions.md' || /^versions\/[^/]+\/(resume|target)\.md$/.test(rel) || /^versions\/[^/]+\/platforms\/[^/]+\.md$/.test(rel);
    });
    for (const file of files) {
      try { records.push(await readRecord(file)); } catch (e) { fail({file}, e.message); }
    }
  } catch (e) { fail(null, e.message); return {errors, warnings, records}; }

  const required = {
    profile: ['name', 'headline', 'city', 'phone', 'email', 'career_status', 'links'],
    education: ['school', 'major', 'qualification', 'degree', 'start', 'end', 'is_current'],
    employment: ['company', 'department', 'title', 'employment_type', 'city', 'start', 'end', 'is_current'],
    project: ['name', 'employment_id', 'organization', 'role', 'start', 'end', 'is_current', 'links'],
    skill: ['name', 'category', 'proficiency', 'related_ids'], language: ['name', 'proficiency'],
    certificate: ['name', 'issuer', 'obtained', 'expires', 'links'], source: ['kind', 'created_at'],
    'master-index': ['profile_id', 'language', 'sections'], 'master-entry': ['kind', 'source_ids', 'readiness', 'based_on'],
    'resume-version': ['source_master_id', 'target_id', 'target_job_id', 'generated_at', 'language', 'state', 'readiness', 'platforms', 'derived_from'],
    'resume-target': ['company', 'title', 'source_url', 'captured_at'],
    'platform-output': ['resume_id', 'template_id', 'template_revision', 'generated_at', 'verification_status'],
  };
  for (const record of records) {
    const m = record.meta;
    const relative = path.relative(root, record.file).split(path.sep).join('/');
    const locations = {profile: /^facts\/profile\.md$/, education: /^facts\/education\//, employment: /^facts\/employment\//,
      project: /^facts\/projects\//, skill: /^facts\/skills\//, language: /^facts\/languages\//, certificate: /^facts\/certificates\//,
      source: /^sources\/[^/]+\/source\.md$/, questions: /^questions\.md$/, 'master-index': /^master\/index\.md$/,
      'master-entry': /^master\//, 'resume-version': /^versions\/[^/]+\/resume\.md$/, 'resume-target': /^versions\/[^/]+\/target\.md$/,
      'platform-output': /^versions\/[^/]+\/platforms\/[^/]+\.md$/};
    if (locations[m.type] && !locations[m.type].test(relative)) fail(record, '记录类型与文件位置不符');
    if (!types.includes(m.type)) fail(record, `未知 type: ${m.type}`);
    const schema = m.type === 'source' ? 'career-source/v2' : factTypes.includes(m.type) || m.type === 'questions' ? 'career/v2' : 'career-resume/v2';
    if (m.schema !== schema) fail(record, `schema 应为 ${schema}`);
    if (typeof m.id !== 'string' || !idPattern.test(m.id)) fail(record, 'ID 不合法');
    else if (ids.has(m.id)) fail(record, `ID 重复: ${m.id}`);
    else ids.set(m.id, record);
    if (!day(m.updated)) fail(record, 'updated 必须是有效日期字符串');
    for (const field of required[m.type] ?? []) if (!own(m, field)) fail(record, `缺少字段 ${field}`);
    for (const field of ['name', 'headline', 'city', 'phone', 'email', 'career_status', 'school', 'major', 'qualification', 'degree', 'company',
      'department', 'title', 'employment_type', 'employment_id', 'organization', 'role', 'category', 'proficiency', 'issuer', 'source_url', 'target_job_id']) {
      if (own(m, field) && m[field] !== null && typeof m[field] !== 'string') fail(record, `${field} 必须为字符串或 null`);
    }
    if (factTypes.includes(m.type) && !Array.isArray(m.source_ids)) fail(record, 'source_ids 必须是数组');
    if (Array.isArray(m.source_ids) && !m.source_ids.length && factTypes.includes(m.type)) warn(record, '尚无来源，不能据此称为已核实');
    if (Array.isArray(m.source_ids) && new Set(m.source_ids).size !== m.source_ids.length) fail(record, 'source_ids 含重复引用');
    for (const field of ['start', 'end', 'project_start', 'project_end', 'obtained', 'expires']) {
      if (own(m, field) && !period(m[field])) fail(record, `${field} 必须为 null、YYYY 或 YYYY-MM 字符串`);
    }
    if (own(m, 'is_current') && ![true, false, null].includes(m.is_current)) fail(record, 'is_current 必须为 true/false/null');
    if (m.is_current === true && m.end !== null) fail(record, '至今与结束日期冲突');
    if (typeof m.start === 'string' && typeof m.end === 'string' && period(m.start) && period(m.end) && periodMin(m.start) > periodMax(m.end)) fail(record, '起止时间倒置');
    for (const field of ['created_at', 'generated_at', 'captured_at', 'frozen_at']) {
      if (own(m, field) && m[field] !== null && !isoTime(m[field])) fail(record, `${field} 须为带时区时间戳`);
    }
    if (own(m, 'readiness') && !['incomplete', 'reviewable'].includes(m.readiness)) fail(record, 'readiness 不合法');
    if (m.type === 'resume-version' && !['draft', 'frozen'].includes(m.state)) fail(record, 'state 不合法');
    if (m.type === 'resume-version' && (!Array.isArray(m.platforms) || m.platforms.some(x => typeof x !== 'string' || !idPattern.test(x)) || new Set(m.platforms).size !== m.platforms.length)) fail(record, 'platforms 必须为不重复的平台标识数组');
    if (m.type === 'resume-version' && !isoTime(m.generated_at)) fail(record, '岗位版本必须记录实际生成时间');
    if (m.type === 'platform-output' && !isoTime(m.generated_at)) fail(record, '平台稿必须记录实际生成时间');
    if (m.type === 'resume-version' && m.readiness === 'incomplete') warn(record, '此版本仍不完整');
    if (own(m, 'links') && (!Array.isArray(m.links) || m.links.some(x => !x || typeof x.label !== 'string' || typeof x.url !== 'string'))) fail(record, 'links 应为 label/url 对象数组');
  }
  const ref = (record, id, allowed, optional = false) => {
    if (id === null && optional) return;
    const target = ids.get(id);
    if (!target) fail(record, `引用不存在: ${String(id)}`);
    else if (!allowed.includes(target.meta.type)) fail(record, `引用类型不符: ${id}`);
    return target;
  };
  for (const record of records) {
    const m = record.meta;
    if (factTypes.includes(m.type) && Array.isArray(m.source_ids)) for (const id of m.source_ids) ref(record, id, ['source']);
    if (m.type === 'project') ref(record, m.employment_id, ['employment'], true);
    if (m.type === 'skill') {
      if (!Array.isArray(m.related_ids)) fail(record, 'related_ids 必须为数组');
      else for (const id of m.related_ids) ref(record, id, factTypes);
    }
    if (m.type === 'master-entry') {
      if (!['summary', 'employment', 'project'].includes(m.kind)) fail(record, '母版 kind 不合法');
      if (!Array.isArray(m.source_ids)) fail(record, 'source_ids 必须是数组');
      else {
        if (!m.source_ids.length && m.readiness === 'reviewable') fail(record, '可核对的母版必须有事实来源');
        for (const id of m.source_ids) {
          const target = ref(record, id, m.kind === 'summary' ? factTypes : [m.kind]);
          const hash = m.based_on?.[id];
          if (hash != null && (typeof hash !== 'string' || !digestPattern.test(hash))) fail(record, `来源摘要不合法: ${id}`);
          if (!hash && m.readiness === 'reviewable') fail(record, `缺少已核对来源摘要: ${id}`);
          if (target && hash && sha256(target.text) !== hash) warn(record, `来源已变化，需核对: ${id}`);
        }
      }
      if (!m.based_on || typeof m.based_on !== 'object' || Array.isArray(m.based_on)) fail(record, 'based_on 必须为对象');
    }
    if (m.type === 'master-index') {
      ref(record, m.profile_id, ['profile']);
      if (!Array.isArray(m.sections)) fail(record, 'sections 必须为数组');
      else {
        const kinds = new Set();
        for (const section of m.sections) {
          if (!section || !['summary', 'employment', 'project', 'education', 'skill', 'language', 'certificate'].includes(section.kind) || !Array.isArray(section.ids)) { fail(record, '母版 section 不合法'); continue; }
          if (kinds.has(section.kind)) fail(record, `重复的母版模块: ${section.kind}`);
          kinds.add(section.kind);
          if (new Set(section.ids).size !== section.ids.length) fail(record, '母版模块含重复条目');
          for (const id of section.ids) {
            const isEntry = ['summary', 'employment', 'project'].includes(section.kind);
            const target = ref(record, id, isEntry ? ['master-entry'] : [section.kind]);
            if (target && isEntry && target.meta.kind !== section.kind) fail(record, `母版条目 kind 不匹配: ${id}`);
          }
        }
      }
    }
    if (m.type === 'resume-version') {
      if (m.state !== 'frozen') ref(record, m.source_master_id, ['master-index']);
      const target = ref(record, m.target_id, ['resume-target']);
      if (target && path.dirname(target.file) !== path.dirname(record.file)) fail(record, '目标 JD 必须在当前版本目录');
      if (m.derived_from !== null) ref(record, m.derived_from, ['resume-version']);
      if (m.state === 'frozen') {
        if (!isoTime(m.frozen_at)) fail(record, '冻结版本缺少 frozen_at');
        await verifyManifest(record, fail);
      }
    }
    if (m.type === 'platform-output') {
      const version = ref(record, m.resume_id, ['resume-version']);
      if (version && path.dirname(path.dirname(record.file)) !== path.dirname(version.file)) fail(record, '平台稿必须属于所在目录的简历版本');
      if (!['draft', 'verified', 'not-applicable'].includes(m.verification_status)) fail(record, '平台核对状态不合法');
      if (m.verification_status === 'draft') warn(record, '平台模板仍待核实，填写稿仅为草稿');
      if (!Number.isInteger(m.template_revision) || m.template_revision < 1) fail(record, 'template_revision 不合法');
      if (version?.meta.state !== 'frozen') {
        const template = templates.get(m.template_id);
        if (!template) fail(record, '平台模板不存在');
        else {
          if (template.revision !== m.template_revision) warn(record, '平台模板修订号已变化，需核对字段稿');
          if (m.verification_status !== template.verification_status) fail(record, '平台稿核对状态不能高于或不同于所用模板');
          if (!Array.isArray(version?.meta.platforms) || !version.meta.platforms.includes(template.platform)) fail(record, '平台稿未登记在所属版本的 platforms 中');
        }
      }
    }
  }
  for (const [file, type] of [['facts/profile.md', 'profile'], ['master/index.md', 'master-index'], ['questions.md', 'questions']]) {
    if (!records.some(record => record.file === path.join(root, file) && record.meta.type === type)) fail(null, `缺少有效的 ${file}`);
  }
  for (const record of records.filter(record => record.meta.type === 'resume-version')) {
    for (const platform of Array.isArray(record.meta.platforms) ? record.meta.platforms : []) {
      if (!records.some(output => output.meta.type === 'platform-output' && output.meta.resume_id === record.meta.id && output.meta.template_id === `template-${platform}`)) fail(record, `缺少已登记的平台稿: ${platform}`);
    }
  }
  return {errors, warnings, records};
}

async function verifyManifest(record, fail) {
  const dir = path.dirname(record.file);
  try {
    const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
    if (manifest.schema !== 'career-snapshot/v1' || manifest.resume_id !== record.meta.id || !Array.isArray(manifest.files)) throw new Error('冻结清单格式或版本 ID 不符');
    const actual = (await walk(dir)).filter(file => path.basename(file) !== 'manifest.json').map(file => path.relative(dir, file).split(path.sep).join('/')).sort();
    const declared = manifest.files.map(item => item.path).sort();
    if (JSON.stringify(actual) !== JSON.stringify(declared)) throw new Error('冻结清单与实际文件列表不符');
    for (const item of manifest.files) {
      if (typeof item.path !== 'string' || path.isAbsolute(item.path) || item.path.split(/[\\/]/).includes('..') || !digestPattern.test(item.sha256)) throw new Error('冻结文件路径或摘要不合法');
      if (sha256(await readFile(path.join(dir, item.path))) !== item.sha256) throw new Error(`冻结内容已变化: ${item.path}`);
    }
  } catch (e) { fail(record, e.message); }
}

if (isMain(import.meta.url)) {
  try {
    const options = args(process.argv.slice(2), ['--workspace']);
    const result = await validate(options['--workspace']);
    for (const warning of result.warnings) console.log(`提示：${warning}`);
    for (const error of result.errors) console.error(`错误：${error}`);
    console.log(`检查 ${result.records.length} 条记录，${result.errors.length} 个错误，${result.warnings.length} 个提示。`);
    console.log('基础检查不证明履历真实、写作质量或平台已保存。');
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
