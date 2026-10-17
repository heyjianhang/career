import {normalizeClip,sameJob} from './model.js';
const PREFIX='clip:';
export function createStore(storage,{now=()=>new Date().toISOString(),id=()=>crypto.randomUUID()}={}) {
  let queue=Promise.resolve();
  const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  async function list(){const all=await storage.get(null);return Object.entries(all).filter(([k,v])=>k.startsWith(PREFIX)&&v?.id).map(([,v])=>v).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));}
  return {
    list,
    save:(input,expected)=>serial(async()=>{
      const clip=normalizeClip(input),records=await list();
      const previous=expected?.id?records.find(x=>x.id===expected.id):null;
      if(expected?.id&&(!previous||previous.revision!==expected.revision))throw new Error('这条记录已经更新。请重新打开记录，再保存修改。');
      const duplicate=records.find(x=>sameJob(x,clip)&&x.id!==previous?.id);
      if(duplicate)return {duplicate};
      const saved={...clip,id:previous?.id??id(),revision:(previous?.revision??0)+1,
        created_at:previous?.created_at??now(),updated_at:now(),copied_at:null,
        // The first rendered capture survives later manual corrections.
        original:previous?.original??(input.capture_original?.description ? normalizeClip({...clip,...input.capture_original,title:input.capture_original.title||clip.title,company:input.capture_original.company||clip.company}) : {...clip})};
      const key=PREFIX+saved.id;
      const total=new TextEncoder().encode(JSON.stringify({...Object.fromEntries(records.map(r=>[PREFIX+r.id,r])),[key]:saved})).length;
      if(total>8*1024*1024)throw new Error('本机采集空间接近上限，请先导出资料；现有记录保持不变。');
      await storage.set({[key]:saved});return {saved};
    }),
    copied:(recordId,revision)=>serial(async()=>{
      const key=PREFIX+recordId,record=(await storage.get(key))[key];
      if(!record||record.revision!==revision)throw new Error('复制内容与最新记录不同，请重新打开后复制。');
      const saved={...record,copied_at:now()};await storage.set({[key]:saved});return saved;
    })
  };
}
