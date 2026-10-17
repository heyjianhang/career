// Synthetic short sections for testing dense lists and page-boundary grouping.
export function detailSections(){
 return [
  {id:'skills',title:'专业技能',items:[
   ['智能应用','检索增强、工具调用、提示评估、上下文管理、文档处理、应用监控'],
   ['服务与存储','Python、FastAPI、PostgreSQL、Redis、消息队列、缓存与接口设计'],
   ['数据处理','数据分析、指标设计、质量校验、离线任务、报表开发与问题排查'],
   ['工程协作','TypeScript、React、自动化测试、容器部署、版本管理与交付文档']
  ].map(([title,details],i)=>({id:'skill-'+i,title,paragraphs:[details],bullets:[]}))},
  {id:'awards',title:'荣誉奖励',items:[
   ['优秀协作奖（虚构）','2023—2025'],['年度项目奖（虚构）','2024—2025'],
   ['优秀贡献奖（虚构）','2025'],['技术改进奖（虚构）','2025']
  ].map(([title,year],i)=>({id:'award-'+i,title,paragraphs:[year],bullets:[]}))}
 ];
}
