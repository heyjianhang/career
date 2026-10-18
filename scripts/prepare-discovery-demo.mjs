// Synthetic end-to-end fixture. Never populate an existing personal workspace.
import {mkdtemp,realpath,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setup} from '../dist/workspace/setup.js';
import * as jobs from '../dist/opportunities/store.js';

export async function prepareDiscoveryDemo(){
 const workspace=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-discovery-demo-'));
 await setup(workspace,false);
 const opportunity=await jobs.add(workspace,{company:'景川工业软件（虚构）',title:'客户成功顾问（合成岗位）',sources:[{platform:'website',url:'https://example.invalid/jobs/customer-success'}]});
 const input=path.join(workspace,'.local/demo-jd.md');
 await writeFile(input,'# 客户成功顾问（合成岗位）\n\n> 全部内容为虚构演示，不是真实招聘。\n\n工作地点：苏州。负责客户上线协调、使用培训和问题跟进。\n\n任职要求：有客户沟通和项目协作经验。');
 await jobs.writeDocument(workspace,opportunity.id,'job.md',input);
 const base='research/companies';
 const docs={
  'context/goals.md':'# 求职偏好\n\n> 合成演示用户。\n\n希望在杭州或苏州从事客户成功、项目运营；有活动执行与供应商协调经历。尚未确定转行，不预设已经具备工业软件经验。',
  [`${base}/INDEX.md`]:`# 目标公司池\n\n> 合成演示：公司、经历和岗位均为虚构，不作为真实投递建议。\n\n从做过的工作出发，先了解公司，再选择具体岗位。\n\n## 本轮发现\n\n[查看研究范围与筛选依据](searches/2026-10-18-customer-operations.md)\n\n| 公司 | 地点核实 | 为什么关注 | 招聘线索 | 我的关注 |\n| --- | --- | --- | --- | --- |\n| [景川工业软件](companies/company-jingchuan.md) | 苏州岗位；总部南京 | 客户培训和上线协调与已有工作相关 | 已收录客户成功岗位 | 未选择 |\n| [远舟会展](companies/company-yuanzhou.md) | 杭州团队待核实 | 活动执行与供应商协作直接相关 | 仅找到招聘入口 | 关注（演示选择） |\n\n## 接下来\n\n先核对岗位工作内容和行业门槛，再选简历做匹配。公司关注不代表已经投递。`,
  [`${base}/companies/company-jingchuan.md`]:`# 景川工业软件（虚构）\n\n> 合成演示材料。\n\n公司 ID：company-jingchuan\n\n用户关注：未选择\n\n最近核实：2026-10-18（演示日期）\n\n## 公司与地点\n\n合成官网材料描述工业软件客户交付业务。总部在南京，苏州地点依据是下面的岗位原文，不能用总部地址代替岗位地点。\n\n## 为什么值得了解\n\n能力可迁移：活动协调、供应商沟通可以为客户上线推进提供相关经验；工业软件业务知识仍待核对。研究建议为进一步了解，不给无简历依据的匹配分。\n\n## 招聘线索\n\n已收录：客户成功顾问，苏州。岗位 ID：${opportunity.id}。\n\n[打开已收录岗位](../../../opportunities/${opportunity.id}/job.md)\n\n## 证据与限制\n\n[原始材料与主体范围](../sources/source-jingchuan.md)。没有实际检索真实企业或招聘网站。\n\n## 用户笔记\n\n尚未选择投递简历，不自动关联、不改变阶段。\n\n[返回公司池](../INDEX.md)`,
  [`${base}/companies/company-yuanzhou.md`]:'# 远舟会展（虚构）\n\n> 合成演示材料。\n\n公司 ID：company-yuanzhou\n\n用户关注：关注（演示选择）\n\n## 为什么值得了解\n\n活动执行与供应商协作直接相关，实际项目规模和工作方式尚未取得证据。\n\n## 招聘线索\n\n仅找到招聘入口，杭州是否有具体团队待核实；暂未取得岗位正文，不创建占位岗位卡片。\n\n## 用户笔记\n\n演示用户希望保留这家公司，先核对出差频率。\n\n[返回公司池](../INDEX.md)',
  [`${base}/searches/2026-10-18-customer-operations.md`]:'# 客户成功与项目运营方向（合成研究）\n\n## 范围与取舍\n\n杭州、苏州；用户已有活动执行、供应商协作经验。当前只使用合成材料，无真实联网研究。\n\n[景川工业软件](../companies/company-jingchuan.md)作为能力迁移候选；[远舟会展](../companies/company-yuanzhou.md)作为直接相关候选。\n\n## 未纳入公司池\n\n“桥港服务”有同名主体，缺少官网与业务信息，暂存待核实，不把不同公司合并。\n\n## 限制\n\n没有根据政策称号推断待遇；没有实际薪资或工作方式证据。公司名单不计入 JD 研究样本。\n\n[返回公司池](../INDEX.md)',
  [`${base}/sources/source-jingchuan.md`]:'# 景川的合成来源材料\n\n来源类型：测试夹具，不是真实网页。\n\n演示日期：2026-10-18。\n\n业务：工业软件客户交付；总部：南京；客户成功岗位：苏州。\n\n这些信息只用于验证引用、跳转和记录归属，不支持对真实企业的判断。'
 };
 for(const [file,content] of Object.entries(docs)){await mkdir(path.dirname(path.join(workspace,file)),{recursive:true});await writeFile(path.join(workspace,file),content);}
 return {workspace,opportunity:opportunity.id,synthetic:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareDiscoveryDemo()));
