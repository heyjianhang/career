import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {setup} from '../dist/workspace/setup.js';
import * as board from '../dist/opportunities/store.js';
import {prepareDemo} from './prepare-presentation-demo.mjs';

// Synthetic fixture only. The destination must not already exist.
export async function prepareBoardDemo(workspace){
 await mkdir(path.dirname(workspace),{recursive:true});await mkdir(workspace);await setup(workspace,false);await prepareDemo(workspace);
 const entries=[
 ['北辰网络（虚构）','产品运营','北京','20–30K','inbox','liepin',4,'了解业务和团队'],
 ['青禾科技（虚构）','解决方案顾问','上海','25–40K','inbox','website',3,'收集更多信息'],
 ['远山科技（虚构）','AI 产品经理','杭州','25–35K','preparing','boss',4,'补充跨部门项目案例'],
 ['星野科技（虚构）','产品经理','深圳','20–30K','preparing','zhaopin',3,'准备投递材料'],
 ['云启智能（虚构）','产品设计师','杭州','20–30K','interviewing','boss',4,'准备一面'],
 ['沐言科技（虚构）','策略产品经理','上海','30–45K','interviewing','referral',5,'整理面试复盘'],
 ['竹川科技（虚构）','AI 应用工程师','南京','22–35K','applied','job51',4,'等待招聘方反馈'],
 ['云帆软件（虚构）','数据产品经理','远程','面议','applied','other',3,'确认岗位职责'],
 ['知秋科技（虚构）','产品负责人','杭州','35–45K','offer','website',5,'核对 offer 条款']];
 const ids=[];
 for(const [company,title,location,salary,stage,platform,rating,next] of entries){
 const op=await board.add(workspace,{company,title,location,salary,stage,sources:[{platform,url:'https://example.com/jobs/'+ids.length,...(platform==='other'?{label:'线下交流'}:{})}],next_action:{title:next,owner:'user',due:'2026-10-16'},body:`# 岗位概况\n\n> 这是虚构演示岗位，所有信息仅用于展示。\n\n## 当前进展\n已收集岗位描述，正在整理适合这个机会的项目经历。\n\n## 已有判断\n岗位关注企业应用落地与跨部门协作。先确认团队配置、产品阶段，再决定如何调整简历。\n\n## 下一步\n${next}。\n\n## 待确认\n- 产品目前处于哪个阶段？\n- 这个岗位的决策范围是什么？\n- 如何衡量试用期的工作成果？\n\n## 相关资料\n[招聘原文](job.md) · [公司分析](analysis/company.md) · [岗位匹配](analysis/match.md)\n`});await board.rate(workspace,op.id,String(rating),op.sha256);ids.push(op.id);
 }
 const id=ids[2],input=path.join(workspace,'.local','demo-input.md');
 const documents={
 'job.md':'# 招聘原文\n\n> 虚构招聘信息，仅用于演示。\n\n## AI 产品经理\n\n负责企业知识助手的产品规划和交付，与研发、业务和运营共同推进项目。\n\n## 工作职责\n- 访谈业务团队，明确需求和使用场景。\n- 协作完成产品方案、评估样例与验收标准。\n- 跟进使用反馈，持续改善产品体验。\n\n## 招聘附件\n[岗位说明 PDF](attachments/岗位说明.pdf)\n',
 'analysis/company.md':'# 公司分析\n\n> 虚构演示分析 · 资料尚待核实\n\n## 结论\n公司业务与企业 AI 应用经验较契合，建议继续了解团队分工和产品阶段。\n\n## 业务与产品\n面向企业知识管理场景，提供知识检索与业务助手。以下内容来自演示岗位描述，尚待官网资料核实。\n\n## 岗位与团队\n- 负责需求分析、产品设计及落地推进。\n- 重点了解研发配置、数据来源与验收方式。\n\n## 待确认的问题\n- 产品目前处于哪个阶段？\n- 这个岗位的决策范围是什么？\n- 如何衡量试用期的工作成果？\n\n## 下一步\n面试前补充官网资料，并准备一个跨部门推进的项目案例。\n\n## 资料来源\n[招聘原文](../job.md) · [岗位说明](../attachments/岗位说明.pdf)\n',
 'analysis/match.md':'# 岗位匹配\n\n## 值得突出\n- 企业知识助手从需求到上线的完整经历。\n- 协调业务与研发推进交付的项目案例。\n\n## 还需要补充\n确认个人负责范围和可验证的交付成果。\n\n## 简历调整建议\n优先呈现相关项目，保留事实与来源，避免把模拟案例写成真实成果。\n',
 'interviews/一面准备.md':'# 一面准备\n\n## 自我介绍\n围绕岗位需求说明最相关的一段经历。\n\n## 可能的问题\n1. 如何把模糊需求变成可验收的方案？\n2. 如何处理业务与研发的意见分歧？\n\n## 我要问的问题\n了解产品阶段、团队分工与岗位预期。\n',
 'notes.md':'# 我的笔记\n\n当前更关注团队沟通方式与岗位的发展空间。\n'};
 for(const [p,text] of Object.entries(documents)){await writeFile(input,text);await board.writeDocument(workspace,id,p,input);}
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 for(const [index,title] of ['Career / Role overview','Career / Interview notes'].entries()){const page=pdf.addPage([595,842]);page.drawText(title,{x:54,y:762,size:24,font,color:rgb(.18,.32,.24)});page.drawText('Fictional example - no real vacancy',{x:54,y:724,size:12,font});page.drawText('AI Product Manager',{x:54,y:656,size:18,font});page.drawText('Enterprise knowledge services and AI applications.',{x:54,y:615,size:12,font});page.drawText(String(index+1),{x:290,y:35,size:11,font});}
 const pdfFile=path.join(workspace,'.local','岗位说明.pdf');await writeFile(pdfFile,await pdf.save());await board.attach(workspace,id,pdfFile);
 const img=path.join(workspace,'.local','资料示例.jpg');await writeFile(img,await readFile(new URL('../docs/assets/workspace.jpg',import.meta.url)));await board.attach(workspace,id,img);
 await prepareInterviewDemo(workspace,id);
 return {workspace,selected:id,ids,synthetic:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareBoardDemo(path.resolve(process.argv[2]??path.join(os.tmpdir(),'career-board-demo-'+Date.now())))));

export async function prepareInterviewDemo(workspace,id){
 const input=path.join(workspace,'.local','interview-demo.md');
 const a=await board.saveInterview(workspace,id,{title:'技术一面',status:'completed',scheduled_at:'2026-10-12T14:00:00+08:00',body:'# 一面记录\n\n> 虚构示例，用于演示。\n\n## 这轮聊了什么\n围绕知识助手项目，讨论检索效果、来源引用和业务反馈。\n\n## 我想改进的表达\n把技术方案与业务问题联系得更具体，下一轮准备讲一次跨团队推进的案例。\n\n## 招聘方反馈\n演示设定：已安排业务二面。'});
 await writeFile(input,'# 本轮准备\n\n从最熟悉的项目出发，讲清楚为什么做、自己做了什么、如何验证结果。');
 await board.writeDocument(workspace,id,`interviews/${a.id}/preparation.md`,input);
 for(const n of [1,2]){await writeFile(input,`# 模拟 ${n}\n\n> 模拟练习，非真实面试。\n\n问题：如何评估知识助手是否有用？\n\n反馈：先讲用户场景，再说明验证方法；数字只引用真实证据。`);await board.writeDocument(workspace,id,`interviews/${a.id}/simulations/practice-${n}.md`,input);}
 const b=await board.saveInterview(workspace,id,{title:'业务二面',status:'planned',scheduled_at:'2026-10-16T15:00:00+08:00'});return {first:a.id,second:b.id};
}
