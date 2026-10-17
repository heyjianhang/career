import {mkdtemp,realpath,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {initializeWorkspace} from '../../dist/agent-api.js';
import {blankPackage} from '../../dist/resumes/model.js';
import * as resumes from '../../dist/resumes/store.js';
import * as jobs from '../../dist/opportunities/store.js';
import {encode} from '../../dist/opportunities/files.js';
export const message='您好，我参与过知识助手的检索与工单接口接入，完成试点。想进一步了解岗位的业务场景，方便聊聊吗？';
export const short='您好，我做过知识助手业务集成，想了解这个岗位。';
export async function outreachFixture(){
 const w=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-outreach-'));await initializeWorkspace(w);
 const p=blankPackage('resume-outreach','Agent 应用 · 合成简历');p.synthetic=true;p.content.profile.name='林序（虚构）';p.content.profile.headline='AI 应用工程师';p.content.summary='参与知识助手开发，负责检索与工单接口接入，完成试点。';
 const r=await resumes.savePackage(w,p),op=await jobs.add(w,{company:'星原科技（虚构）',title:'Agent 应用工程师',sources:[{platform:'boss'}]});
 await resumes.selectResume(w,op.id,r.id,op.sha256);
 const write=async(file,body)=>{const input=path.join(w,'candidate.md');await writeFile(input,body);const old=await jobs.readDocument(w,op.id,file).catch(e=>{if(e.code!=='NOT_FOUND')throw e;return null;});return jobs.writeDocument(w,op.id,file,input,old?.sha256);};
 const jd=await write('job.md','# JD\n负责 Agent 与业务系统的接口集成。');
 const meta={schema:'career-outreach/v1',opportunity_id:op.id,resume_id:r.id,resume_sha256:r.sha256,jd_sha256:jd.sha256,generated_at:'2026-10-18T08:00:00Z',channel:'BOSS 直聘'};
 const body=`# 打招呼草稿\n\n## 推荐稿\n\n${message}\n\n## 简短版\n\n${short}\n\n## 选材依据\n\n内部依据：JD 业务集成对应简历试点项目，不能夸成独立主导。\n`;
 return {w,op,r,meta,body,write,save:(m=meta,b=body)=>write('analysis/outreach.md',encode(m,b)),close:()=>rm(w,{recursive:true,force:true})};
}
