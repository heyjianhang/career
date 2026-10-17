// Deterministic aggregation of reviewed annotations. No network or workspace writes.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const modes=['must','preferred','responsibility','condition','negated','unclear'];
const positive=new Set(modes.slice(0,4));
const norm=value=>value.normalize('NFKC').replace(/\s+/gu,' ').trim();
const nonempty=value=>typeof value==='string'&&norm(value).length>0;
function check(ok,message){if(!ok)throw new Error(message);}
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);

export function canonicalUrl(value){
  if(value==null)return null;
  let url;try{url=new URL(value);}catch{throw new Error('source.url must be a valid HTTP(S) URL or null');}
  check(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password,'Source URL must not contain credentials');
  for(const key of [...url.searchParams.keys()]){
    check(!/^(?:access_token|token|cookie|authorization|security_?id|lid)$/i.test(key),'Remove session parameters from source URL before analysis');
    if(/^utm_/i.test(key)||['spm','gclid','fbclid'].includes(key.toLowerCase()))url.searchParams.delete(key);
  }
  // Keep meaningful query parameters and SPA fragments; do not guess platform IDs.
  url.searchParams.sort();return url.href;
}

export function summarizeCorpus(input){
  check(object(input)&&input.schema==='jd-research-corpus/v1','Expected jd-research-corpus/v1');
  check(nonempty(input.scope),'scope is required');
  check(Array.isArray(input.categories)&&input.categories.length>0,'categories must be nonempty');
  const categories=new Map();
  for(const c of input.categories){
    check(object(c)&&nonempty(c.id)&&nonempty(c.label)&&['capability','gate','work_condition'].includes(c.kind),'Invalid category');
    check(!categories.has(c.id),'Duplicate category ID');categories.set(c.id,c);
  }
  check(Array.isArray(input.jobs),'jobs must be an array');
  const ids=new Set(),identities=new Map(),groups=new Map();
  const statusCounts={include:0,exclude:0,review:0},qualityCounts={full:0,partial:0,lead:0};
  for(const [index,j] of input.jobs.entries()){
    const at=`jobs[${index}]`;
    check(object(j)&&nonempty(j.id)&&!ids.has(j.id),`${at}: unique id required`);ids.add(j.id);
    check(nonempty(j.sample_group)&&nonempty(j.group_reason),`${at}: sample_group and group_reason required`);
    check(nonempty(j.title)&&(j.company===null||nonempty(j.company))&&nonempty(j.family),`${at}: title, company (or null) and family required`);
    check(['full','partial','lead'].includes(j.completeness),`${at}: invalid completeness`);
    check(object(j.decision)&&['include','exclude','review'].includes(j.decision.status)&&nonempty(j.decision.reason),`${at}: decision and reason required`);
    check(typeof j.text==='string'&&(j.completeness==='lead'||nonempty(j.text)),`${at}: body missing`);
    const s=j.source;
    check(object(s)&&nonempty(s.platform)&&nonempty(s.locator),`${at}: source platform and locator required`);
    check(typeof s.captured_at==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s.captured_at)&&Number.isFinite(Date.parse(s.captured_at)),`${at}: captured_at needs a timezone`);
    check(s.native_id==null||nonempty(s.native_id),`${at}: invalid native_id`);
    const url=canonicalUrl(s.url),keys=[];
    if(url)keys.push(`url:${url}`);
    if(s.native_id)keys.push(`native:${norm(s.platform).toLowerCase()}:${s.native_id}`);
    for(const key of keys){
      check(!identities.has(key)||identities.get(key)===j.sample_group,`${at}: duplicate source assigned to different sample groups; review deduplication`);
      identities.set(key,j.sample_group);
    }
    check(Array.isArray(j.requirements),`${at}: requirements must be an array`);
    for(const r of j.requirements){
      check(object(r)&&categories.has(r.category)&&modes.includes(r.modality),`${at}: invalid requirement category or modality`);
      check(nonempty(r.quote)&&nonempty(r.locator),`${at}: requirement quote and locator required`);
      check(norm(j.text).includes(norm(r.quote)),`${at}: requirement quote not found in source text`);
    }
    statusCounts[j.decision.status]++;qualityCounts[j.completeness]++;
    if(!groups.has(j.sample_group))groups.set(j.sample_group,[]);
    groups.get(j.sample_group).push(j);
  }
  for(const rows of groups.values()){
    check(new Set(rows.map(j=>j.family)).size===1,'One sample group cannot mix role families');
    check(new Set(rows.filter(j=>j.company!==null).map(j=>norm(j.company))).size<=1,'One sample group cannot mix company labels; verify identity first');
  }
  const core=[...groups].map(([id,rows])=>({id,rows:rows.filter(j=>j.decision.status==='include'&&j.completeness==='full')})).filter(g=>g.rows.length);
  function stats(selected){
    return {denominator:selected.length,categories:[...categories.values()].map(c=>{
      const sets=Object.fromEntries(modes.map(mode=>[mode,new Set()])),present=new Set();
      for(const g of selected)for(const j of g.rows)for(const r of j.requirements)if(r.category===c.id){
        sets[r.modality].add(g.id);if(positive.has(r.modality))present.add(g.id);
      }
      return {id:c.id,label:c.label,kind:c.kind,positive_samples:present.size,
        positive_percent:selected.length?Math.round(present.size/selected.length*10000)/100:null,
        sample_ids:[...present].sort(),by_modality:Object.fromEntries(modes.map(mode=>[mode,{count:sets[mode].size,sample_ids:[...sets[mode]].sort()}]))};
    })};
  }
  const families=[...new Set(core.map(g=>g.rows[0].family))].sort();
  const distribution=valuesForGroup=>{
    const result=new Map();
    for(const g of core)for(const value of new Set(valuesForGroup(g)))result.set(value,(result.get(value)||0)+1);
    return [...result].map(([label,count])=>({label,samples:count})).sort((a,b)=>b.samples-a.samples||String(a.label).localeCompare(String(b.label)));
  };
  return {schema:'jd-research-statistics/v1',scope:input.scope,
    counts:{records:input.jobs.length,body_records:qualityCounts.full+qualityCounts.partial,completeness:qualityCounts,decisions:statusCounts,core_samples:core.length,core_records:core.reduce((n,g)=>n+g.rows.length,0)},
    overall:stats(core),by_family:families.map(family=>({family,...stats(core.filter(g=>g.rows[0].family===family))})),
    company_labels:distribution(g=>[g.rows.find(j=>j.company!==null)?.company??null].map(c=>c===null?null:norm(c))),sources:distribution(g=>g.rows.map(j=>j.source.platform)),
    core_groups:core.map(g=>({sample_group:g.id,record_ids:g.rows.map(j=>j.id)})),
    outside_core:input.jobs.filter(j=>j.completeness!=='full'||j.decision.status!=='include').map(j=>({id:j.id,completeness:j.completeness,status:j.decision.status,reason:j.decision.reason})),
    limitation:'Reviewed targeted samples, not market prevalence or hiring probability. Annotation meaning and source completeness require review; modality and source counts can overlap.'};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length===3&&process.argv[2]==='--help')console.log('Usage: node summarize-corpus.mjs <corpus.json>\nRead reviewed JD annotations; write statistics to stdout. No network or file writes.');
    else{
      check(process.argv.length===3,'Usage: node summarize-corpus.mjs <corpus.json>');
      const input=JSON.parse(await readFile(process.argv[2],'utf8'));
      console.log(JSON.stringify(summarizeCorpus(input),null,2));
    }
  }catch(error){
    console.error(JSON.stringify({error:error instanceof SyntaxError?'Invalid JSON':error.code?'Cannot read corpus input':error.message}));process.exitCode=1;
  }
}
