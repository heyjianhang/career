export function matchMetadata(f){
 const {channel,generated_at,...source}=f.meta;
 return {...source,schema:'career-match/v1',assessed_at:generated_at,
  summary:'业务集成方向有直接经历，可以进一步了解。模型评测经验尚未体现，建议补充后再判断。',
  criteria:[
   {id:'业务接口集成',weight:70,score:3,evidence:['简历：知识助手／本人负责检索和工单接口；JD：业务集成'],reason:'有相同任务的实际试点交付。'},
   {id:'模型评测与质量验证',weight:30,score:null,evidence:['简历：未描述评测方法'],reason:'现有资料不足以判断，不当作没有能力。'}
  ],hard_conditions:[{label:'工作地点',status:'unknown',reason:'尚需确认是否接受岗位所在地。'}]};
}
