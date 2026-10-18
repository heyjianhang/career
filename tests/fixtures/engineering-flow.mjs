import {blankPackage,blankExperience} from '../../dist/resumes/model.js';
// Deliberately fictional text, with unique boundary markers for extraction checks.
export function engineeringFlow(mode='flow'){
 const b=blankPackage('resume-engineering-'+mode,'分页回归 · 虚构资料');b.synthetic=true;
 const fill=(label,n)=>label+'：'+('围绕企业知识查询与任务处理，组织业务资料、工具接口和权限，完成需求分析、系统设计及交付。'.repeat(60)).slice(0,n);
 b.content.profile={name:'林知远',english_name:'Test User',headline:'AI 应用工程师',contacts:[]};
 b.content.summary=fill('个人简介',90);
 b.content.sections=[{id:'projects',title:'项目经历',items:Array.from({length:mode==='tail'?5:7},(_,i)=>({...blankExperience('project','project-'+i),
  title:['企业智能中台与桌面 Agent','业务系统中的数字员工','企业知识库与检索应用','智能招聘与业务协作','CAD 智能设计系统','工业时序预测','其他研发经历'][i],
  subtitle:'项目负责人 / 核心研发',technologies:'Python、LangChain、PostgreSQL、MCP、Skill',description:fill('项目背景'+i,i===4?135:90),
  responsibilities:[fill('系统架构'+i,100),fill('关键实现'+i,140)].join('\n'),achievements:fill('应用效果'+i,75),
  page_break_before:mode==='manual'&&i===4
 }))}];
 if(mode==='compact')b.content.layout={density:'compact'};
 if(mode==='custom')b.content.layout={fontSize:11,lineHeight:1.7};
 return b;
}
