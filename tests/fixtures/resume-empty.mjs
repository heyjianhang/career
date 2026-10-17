import {blankPackage,blankExperience} from '../../dist/resumes/model.js';
export function emptyOptionalResume(){
  const b=blankPackage('resume-empty-options','空栏目检查（合成）');b.synthetic=true;
  b.content.profile={name:'林序',headline:'AI 应用工程师',contacts:[{label:'邮箱',value:'linxu@example.com'}]};
  b.content.summary='负责企业 AI 应用的研发和交付。';
  b.content.sections=[
    {id:'project',title:'项目经历',items:[{...blankExperience('project','knowledge-agent'),title:'知识助手',subtitle:'应用研发',description:'为业务团队建立可追溯的知识检索流程。',responsibilities:'接入知识资料并评估检索结果。',achievements:'完成试点交付。'}]},
    {id:'skills',title:'核心技能',items:[]},
    {id:'awards',title:'荣誉与绩效',items:[{...blankExperience('other','empty-award'),title:'　 ',start:' ',end:'\t',description:'\n \n',responsibilities:'- \n• ',links:[{label:'详情',url:''}]}]}
  ];
  b.content.common.sections=[{id:'certificates',title:'资格证书',fields:[{label:'证书名称',value:'　 ',url:''}]}];
  return b;
}
