import {cp, mkdir, readFile, writeFile, symlink, access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const requested=process.argv[2]==='--out' ? process.argv[3] : null;
if(!requested||!path.isAbsolute(requested))throw new Error('使用 --out 指定源码之外、尚不存在的绝对临时目录');
const out=path.resolve(requested);
if(out===root||out.startsWith(root+path.sep))throw new Error('模拟资料必须位于开发源码之外');
try {await access(out);throw new Error('输出目录已存在；每次使用新目录，保留旧证据');} catch(e) {if(e.code!=='ENOENT')throw e;}
await mkdir(out,{recursive:true});
const packed=JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--cache',path.join(out,'npm-cache'),'--pack-destination',out],{cwd:root,encoding:'utf8'}))[0];
if(packed.files.some(entry=>entry.path.startsWith('evals/')))throw new Error('隐藏案例进入了安装包，停止测试');
execFileSync('tar',['-xzf',path.join(out,packed.filename),'-C',out]);
const runtime=path.join(out,'package');
await symlink(path.join(root,'node_modules'),path.join(runtime,'node_modules'),'dir');
const cli=path.join(runtime,'dist/cli.js');
const command=(workspace,...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,'--workspace',workspace,'--json'],{encoding:'utf8',maxBuffer:8*1024*1024}));
const hashes={};
for(const entry of packed.files){if(entry.path.startsWith('.agents/')||entry.path.startsWith('resources/workspace/')||entry.path.startsWith('dist/'))hashes[entry.path]=createHash('sha256').update(await readFile(path.join(runtime,entry.path))).digest('hex');}
await writeFile(path.join(out,'manifest.json'),JSON.stringify({created_at:new Date().toISOString(),node:process.version,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}),package:packed.filename,hashes},null,2));
const cases=JSON.parse(await readFile(path.join(root,'evals/agent-guidance/cases.json'),'utf8')).cases;
for(const item of cases.filter(x=>!x.from)){
 const workspace=path.join(out,'workspaces',item.id);
 command(workspace,'setup','--no-install');
 const pkg=JSON.parse(await readFile(path.join(workspace,'package.json'),'utf8'));
 pkg.scripts.career=`node "${cli}"`;
 await writeFile(path.join(workspace,'package.json'),JSON.stringify(pkg,null,2)+'\n');
 command(workspace,'sync','local');
 if(item.id==='assets')continue;
 const input=item.id==='company'?{title:'算法工程师',company:'澄海数据',location:'杭州（JD）',stage:'inbox',body:'待评估。用户已有四星偏好，尚未投递。'}:{title:'项目经理',company:'远帆软件',location:'杭州',stage:'inbox',body:'关注需求变更管理；暂无正式面试安排。'};
 const inputPath=path.join(workspace,'.local','seed.json');
 await writeFile(inputPath,JSON.stringify(input));
 const added=command(workspace,'opportunity','add','--input',inputPath);
 await writeFile(path.join(out,item.id+'-seed.json'),JSON.stringify(added,null,2));
 const id=added.data.id??added.data.record?.id??added.data.opportunity?.id;
 if(!id)throw new Error('岗位创建结果缺少 ID');
 if(item.id==='company')command(workspace,'opportunity','rate','--id',id,'--stars','4','--if-match',added.data.sha256);
 const jd=item.id==='company'?'# 算法工程师\n\n以下全部为合成测试资料，非真实招聘。\n\n工作地点：杭州；25–35K。负责企业知识助手的检索、工具调用和上线评估，同时参与模型微调实验。岗位有客户交付任务，是否需要驻场面议。要求能独立负责生产质量；训练经验优先。\n\n官网宣传称“行业领先、融资稳定”，未提供审计或融资材料。招聘品牌澄海数据，招聘页面主体澄海数科有限公司，合同主体待确认。\n':'# 项目经理\n\n合成测试JD：面向企业软件交付，澄清需求、评估变更、协调产品/开发/销售、管理验收与风险。要求能说明如何处理范围和交付冲突。没有预算管理或直属团队要求。\n';
 const notes=item.id==='company'?'# 已收集资料\n\n均为合成材料。\n\nHR口述（2026-10-15）：办公地点先按杭州，驻场以后再确认；团队指导安排待确认。\n\n匿名评论截图转述：有人称另一家“澄海科技”加班严重，主体、部门和发布时间均未核对。\n\n用户旧资料：做过一个RAG内部试点，负责文档和检索链路。模型训练、生产运维经历尚未核对。没有企业经营财务原始材料。\n':'# 用户提供的背景\n\n合成材料：用户参与过企业软件需求协调，具体权限和代表性事件尚未展开。没有任何正式面试邀约或已完成轮次。\n';
 for(const [name,body] of [['job.md',jd],['notes.md',notes]]){const file=path.join(workspace,'.local',name);await writeFile(file,body);command(workspace,'opportunity','write','--id',id,'--path',name,'--input',file);}
}
await cp(path.join(root,'evals/agent-guidance/cases.json'),path.join(out,'controller-cases.json'));
console.log(JSON.stringify({out,workspaces:path.join(out,'workspaces'),runtime,manifest:path.join(out,'manifest.json')},null,2));
