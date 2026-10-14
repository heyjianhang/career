import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {stringify} from 'yaml';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PDFDocument,StandardFonts} from 'pdf-lib';
// Synthetic facts for local UI review. Existing non-template records are preserved.
export async function prepareProfileDemo(workspace){
 const source='source-demo-profile',sourceDir=`resume/sources/${source}`;
 const record=(type,id,meta,body)=>'---\n'+stringify({schema:'career/v2',type,id,updated:'2026-10-14',source_ids:[source],synthetic:true,...(type==='project'?{organization:null,links:[]}:{}),...meta})+'---\n\n'+body+'\n';
 const docs={
 'resume/facts/profile.md':record('profile','profile-main',{name:'林序',headline:'AI 应用开发工程师',city:'杭州',phone:null,email:'linxu@example.com',career_status:'在职，考虑新机会',links:[{label:'个人主页',url:'https://example.com/linxu'}]},'# 基本资料\n\n## 个人介绍\n具有企业应用开发与 AI 产品落地经验，关注知识检索、Agent 工具集成与复杂业务系统协作。\n\n## 我擅长的事\n- 从业务访谈中梳理真实需求，形成可以验收的方案。\n- 连接工程实现与业务反馈，持续改进使用体验。\n\n## 来源与待确认\n本页人物、单位及经历均为虚构演示，不对应真实个人。'),
 'context/goals.md':'# 求职偏好\n\n> 虚构演示 · 以下为示例偏好。\n\n## 希望寻找的机会\nAI 应用开发、企业智能助手相关岗位。希望能参与从需求分析到交付验证的完整过程。\n\n## 城市与工作方式\n优先考虑杭州，也愿意了解远程协作成熟的团队。是否接受异地搬家，需要结合具体机会讨论。\n\n## 薪资与入职安排\n期望税前月薪 25–35K；年终奖、薪数与总包口径待核对。入职时间以现有工作的交接安排为准。\n\n## 看重什么\n- 产品是否解决明确的业务问题。\n- 团队职责清楚，工程与业务能够有效协作。\n- 能持续积累产品交付与系统设计经验。\n\n## 不接受的条件\n尚未明确，不根据示例自行推断。\n\n## 还需要确认\n出差频率、远程办公要求和具体到岗时间。',
 'resume/facts/employment/employment-demo-yuanshan.md':record('employment','employment-demo-yuanshan',{company:'远山科技（虚构）',department:'企业应用团队',title:'AI 应用开发工程师',employment_type:'全职',city:'杭州',start:'2023-07',end:null,is_current:true},'# 远山科技（虚构）\n\n## 工作职责\n围绕内部知识服务与业务助手，参与需求访谈、技术设计、核心功能开发和效果复核。\n\n## 工作成果\n完成知识助手试点交付，整理部署文档与验收清单。\n\n## 关联项目\n[企业知识助手](../projects/project-demo-knowledge.md) · [业务工作台](../projects/project-demo-workbench.md)\n\n## 来源与待确认\n虚构示例。上线后的使用规模与量化效果未提供。'),
 'resume/facts/projects/project-demo-knowledge.md':record('project','project-demo-knowledge',{name:'企业知识助手',employment_id:'employment-demo-yuanshan',role:'检索链路与应用开发',start:'2025-03',end:'2025-12',is_current:false,links:[{label:'项目演示',url:'https://example.com/knowledge'}]},'# 企业知识助手\n\n## 项目背景\n企业内部制度、产品手册和业务资料分散，员工查找信息需要在多个系统之间切换。项目希望把检索、来源引用与反馈记录放到统一入口。\n\n## 我的职责\n负责资料处理、检索链路和来源展示，与业务同事一起整理评估样例及验收标准。\n\n## 做了什么\n1. 梳理资料分类、更新流程和访问权限。\n2. 开发检索与引用展示，让回答能够追溯到原始资料。\n3. 分析检索失败案例，持续调整文档结构与查询方式。\n\n## 取得的成果\n完成试点交付，形成可复用的部署文档、评估样例和问题反馈流程。尚未提供量化结果。\n\n## 相关材料\n[项目说明 PDF](../../sources/source-demo-profile/项目说明.pdf) · [界面参考](../../sources/source-demo-profile/界面参考.jpg)\n\n## 来源与待确认\n虚构演示；业务规模及上线指标待补充。'),
 'resume/facts/projects/project-demo-workbench.md':record('project','project-demo-workbench',{name:'业务工作台',employment_id:'employment-demo-yuanshan',role:'工具集成与应用开发',start:'2026-01',end:'2026-08',is_current:false},'# 业务工作台\n\n## 项目背景\n为内部工作场景开发 Agent 工具调用模块，把查询、状态跟踪和人工确认步骤组织为统一操作流程。\n\n## 我的职责\n负责工具接口定义、参数校验、异常处理与结果展示。\n\n## 项目成果\n完成重复操作的演示与试点验证，并提供接口文档与集成说明。\n\n## 待确认\n具体使用范围与实际节省时间尚未提供。'),
 'resume/facts/education/education-demo-qingchuan.md':record('education','education-demo-qingchuan',{school:'青川大学（虚构）',major:'计算机科学与技术',qualification:'本科',degree:null,start:'2019-09',end:'2023-06',is_current:false},'# 青川大学（虚构）\n\n## 学习经历\n学习计算机基础、数据库与软件工程，参与团队课程项目。\n\n## 来源与待确认\n虚构演示；学位及在校成果待补充。'),
 'resume/facts/skills/skill-demo-engineering.md':record('skill','skill-demo-engineering',{name:'应用开发与工程实践',category:'工程能力',proficiency:'有项目使用经验',related_ids:['project-demo-knowledge','project-demo-workbench']},'# 应用开发与工程实践\n\n## 使用经历\n使用 Python、TypeScript 和 SQL 参与企业应用开发，结合 RAG 与 Agent 工具调用处理真实业务流程。\n\n## 工程实践\n需求分析、接口设计、评测样例、部署交付和协作文档。'),
 'resume/facts/languages/language-demo-english.md':record('language','language-demo-english',{name:'英语',proficiency:'能够阅读技术文档'},'# 英语\n\n## 使用情况\n在项目中阅读英文技术文档。口语能力和考试成绩尚未提供。'),
 'context/state.md':'# 当前进度\n\n> 虚构演示工作区\n\n## 正在处理\n补充企业知识助手项目的个人负责范围，核对目标岗位需要的表达。\n\n## 已有资料\n工作经历、两个项目、教育、专业技能与语言能力已整理为独立文件。\n\n## 下一步\n与用户核对项目的实际应用范围及可验证成果，再更新相关简历。',
 'resume/questions.md':'---\nschema: career/v2\ntype: questions\nid: questions-main\nupdated: 2026-10-14\n---\n\n# 待补信息\n\n## 企业知识助手\n- 实际应用范围和使用人数是否有可引用记录？\n- 试点验收中由你独立负责哪些部分？\n\n## 求职安排\n- 可以接受的出差频率？\n- 完成交接后，最早什么时候可以到岗？',
 [sourceDir+'/source.md']:'---\nschema: career-source/v2\ntype: source\nid: source-demo-profile\nupdated: 2026-10-14\ncreated_at: 2026-10-14T09:00:00+08:00\nkind: synthetic-interview\nsynthetic: true\n---\n\n# 示例访谈与项目材料\n\n人物林序、远山科技及相关经历均为虚构演示。材料用于展示个人资料阅读、文件关联和 Agent 协作，不作为真实求职经历。\n\n## 附件\n[项目说明](项目说明.pdf) · [界面参考](界面参考.jpg)\n'
 };
 const templates={'resume/facts/profile.md':'.agents/skills/career-intake/templates/facts/profile.md','context/goals.md':'templates/context/goals.md','context/state.md':'templates/context/state.md','resume/questions.md':'.agents/skills/career-intake/templates/questions.md'};
 const normalize=text=>text.replace(/__TODAY__|\d{4}-\d{2}-\d{2}/g,'DATE').trim();
 for(const [relative,content] of Object.entries(docs)){
  const file=path.join(workspace,relative);await mkdir(path.dirname(file),{recursive:true});let old='';try{old=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  const template=templates[relative]?await readFile(new URL('../'+templates[relative],import.meta.url),'utf8'):null;
  if(!old||(template&&normalize(old)===normalize(template)))await writeFile(file,content);
 }
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);for(const title of ['Knowledge assistant / Project brief','Scope and validation']){const page=doc.addPage([595,842]);page.drawText(title,{x:50,y:765,size:22,font});page.drawText('Fictional material for career workspace preview.',{x:50,y:720,size:12,font});}await writeFile(path.join(workspace,sourceDir,'项目说明.pdf'),await doc.save());
 await writeFile(path.join(workspace,sourceDir,'界面参考.jpg'),await readFile(new URL('../docs/assets/workspace.jpg',import.meta.url)));
 return {workspace,synthetic:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await prepareProfileDemo(path.resolve(process.argv[2])));
