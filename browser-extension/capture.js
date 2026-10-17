// Self-contained: Chrome serializes this function into an isolated current-tab world.
// Read rendered DOM only. No cookies, account state, API requests or page scripts.
export function captureCurrentJob() {
  const clean=s=>(s??'').replace(/\u00a0/g,' ').replace(/[\t ]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const visible=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
  const find=(selectors,root=document)=>{for(const selector of selectors.split(',')){const e=Array.from(root.querySelectorAll(selector.trim())).find(visible);if(e)return e;}return null;};
  const text=(selectors,root=document)=>clean(find(selectors,root)?.innerText);
  const allText=(selector,root=document)=>Array.from(root.querySelectorAll(selector)).filter(visible).map(e=>clean(e.innerText)).filter(Boolean);
  const heading=names=>Array.from(document.querySelectorAll('h2,h3,h4,dt')).find(e=>visible(e)&&names.some(name=>e.innerText.replace(/\s/g,'').startsWith(name)));
  const section=names=>{
    const h=heading(names);if(!h)return '';
    let p=h;
    for(let i=0;i<4&&p?.parentElement&&p.parentElement!==document.body;i++,p=p.parentElement){
      const siblings=Array.from(p.parentElement.children);const following=siblings.slice(siblings.indexOf(p)+1);
      const parts=[];
      for(const el of following){if(/^H[1-4]$/.test(el.tagName)||el.querySelector('h2,h3,h4,dt'))break;if(visible(el))parts.push(clean(el.innerText));}
      const value=clean(parts.join('\n\n'));if(value)return value;
    }
    return '';
  };
  const host=location.hostname.toLowerCase();
  const platform=host==='zhipin.com'||host.endsWith('.zhipin.com')?'boss':host==='liepin.com'||host.endsWith('.liepin.com')?'liepin':host==='51job.com'||host.endsWith('.51job.com')?'job51':host==='zhaopin.com'||host.endsWith('.zhaopin.com')?'zhaopin':'website';
  const out={title:'',company:'',location:'',salary:'',experience:'',education:'',description:'',company_intro:'',benefits:'',url:location.href,platform,captured_at:new Date().toISOString(),warnings:[],method:'page'};
  const selected=clean(window.getSelection()?.toString());
  let details='',meta=[];
  if(platform==='boss'){
    const body=find('.job-sec-text');
    if(body){
      out.description=clean(body.innerText);
      out.title=text('.info-primary h1,.job-detail-header .job-name,.job-detail-box .job-name,.job-detail .job-name');
      out.salary=text('.info-primary .salary,.job-detail-header .salary,.job-detail-box .job-salary');
      out.company=text('.info-primary .brand-name,.job-detail .company-name,.job-detail-box .company-name,.sider-company .company-info a');
      out.location=text('.info-primary .text-city,.job-detail-header .job-location');
      out.experience=text('.info-primary .text-experiece');out.education=text('.info-primary .text-degree');
      out.company=out.company.replace(/^客户公司[：:]\s*/,'');
      const detailLink=Array.from(document.querySelectorAll('a[href]')).find(a=>visible(a)&&/查看更多信息/.test(a.innerText)&&/\/job_detail\//.test(a.getAttribute('href')));
      if(detailLink)out.url=detailLink.href;
      if(!out.company&&/\/job_detail\//.test(location.pathname))out.company=document.title.match(/」_(.+?)招聘[-_]/)?.[1]??'';
      if(!out.title){const header=body.closest('.job-detail')?.querySelector('.job-name');out.title=clean(header?.innerText);}
      out.company_intro=section(['公司介绍','公司简介']);
    }
  } else if(platform==='zhaopin'){
    const body=find('.describtion-card,.job-detail .job-desc,.job-detail .describtion');
    if(body||heading(['职位描述'])){
      out.title=text('.summary-planes__title');out.salary=text('.summary-planes__salary');
      if(!out.title){const h=find('h1');out.title=clean(h?.innerText);}
      out.company=text('.company-info__name,.company-summary__name-link');
      meta=allText('.summary-planes__left li');
      out.description=section(['职位描述']);out.company_intro=text('.company-info__intro');
      const link=Array.from(document.querySelectorAll('a[href]')).find(a=>visible(a)&&/查看更多职位信息/.test(a.innerText)&&/\/jobdetail\//.test(a.getAttribute('href')));
      if(link)out.url=link.href;
    }
  } else if(platform==='liepin'){
    if(/\/job\/\d+\.shtml/.test(location.pathname)){
      out.title=text('.name-box .job-title,.job-title');out.salary=text('.name-box .salary');
      out.company=text('.company-card .name');
      if(!out.company){const recruiter=Array.from(document.querySelectorAll('main a[href]')).find(a=>visible(a)&&/^·/.test(a.innerText)&&/\/company\//.test(a.href));out.company=clean(recruiter?.innerText).replace(/^·\s*/,'');}
      out.description=section(['职位介绍']);out.company_intro=section(['公司简介']);
      const properties=find('.job-apply-content .job-properties');
      meta=properties?Array.from(properties.children).filter(visible).map(e=>clean(e.innerText)).filter(Boolean):[];
      if(!meta.length)meta=clean(properties?.innerText).split(/\s{2,}|\n/).map(clean).filter(Boolean);
    }
  } else if(platform==='job51'){
    if(host==='jobs.51job.com'&&/\/\d+\.html/.test(location.pathname)){
      out.title=text('h1');const h=find('h1');const root=h?.closest('.cn')??h?.parentElement;
      out.salary=root?text('strong',root):'';
      details=clean(root?.innerText);meta=root?allText('p span',root):[];
      const company=Array.from(document.querySelectorAll('a[href]')).find(a=>visible(a)&&/\/all\/co/.test(a.href)&&!a.innerText.includes('查看所有职位'));
      out.company=clean(company?.innerText);
      out.description=text('.job_msg,.job-detail-content,.bmsg.job_msg');
      if(!out.description){const h=Array.from(document.querySelectorAll('h2')).find(e=>visible(e)&&e.innerText.includes('职位描述'));const parent=h?.parentElement;out.description=parent?text('.bmsg,.job-msg',parent):'';}
      if(!out.description)out.description=section(['职位描述竞争力分析微信分享','职位描述']);
      out.company_intro=section(['公司信息']);out.benefits=text('.job-detail .tags')||allText('.t1 span').join(' · ');
    }
  } else {
    const headings=Array.from(document.querySelectorAll('main h1,article h1')).filter(visible);
    if(headings.length===1){
      out.title=clean(headings[0].innerText);
      out.description=section(['职位描述','Jobdescription']);
      if(!out.description){
        const responsibilities=section(['岗位职责','工作职责','Responsibilities']);
        const requirements=section(['任职要求','岗位要求','Requirements','Qualifications']);
        out.description=[responsibilities&&'岗位职责\n'+responsibilities,requirements&&'任职要求\n'+requirements].filter(Boolean).join('\n\n');
      }
    }
  }
  if(meta.length){out.location=meta[0]??'';out.experience=meta.find(x=>/(经验|年|应届)/.test(x))??out.experience;out.education=meta.find(x=>/(本科|硕士|博士|大专|学历|高中|中专)/.test(x))??out.education;}
  if(details){const lines=details.split('\n').map(clean).filter(Boolean);out.location=out.location||lines.find((s,i)=>i>0&&!/k|万|元|千|薪|经验|年|本科|硕士|博士|大专|收藏|沟通|投递|招\d|更新/i.test(s))||'';out.experience=out.experience||lines.find(s=>/^(\d+[-–]\d+年|\d+年(以上|及以上)|经验不限|应届生)$/.test(s))||'';out.education=out.education||lines.find(s=>/^(统招)?(本科|硕士|博士|大专|学历不限)$/.test(s))||'';}
  if(selected){out.description=selected;out.method='selection';out.warnings.push('本次只采集你选中的文字，请确认包含完整岗位内容。');}
  if(!out.description)out.warnings.push('未识别到岗位正文。请打开具体岗位详情，或选中正文后重新采集，也可手动粘贴。');
  if(!out.title)out.warnings.push('未识别到职位名称，请核对填写。');
  if(!out.company)out.warnings.push('未识别到招聘公司，请核对填写；猎头公司不等于用人公司。');
  for(const key of ['title','company','location','salary','experience','education'])if(/[\uE000-\uF8FF]/u.test(out[key])){out[key]='';out.warnings.push(`${{title:'职位',company:'公司',location:'地点',salary:'薪资',experience:'经验',education:'学历'}[key]}使用特殊字体，无法可靠读取，请按页面填写或留空。`);}
  if(/[\uE000-\uF8FF]/u.test(out.description))out.warnings.push('正文中含特殊字体字符，请核对原页面。');
  if(out.description.length>100000){out.description=out.description.slice(0,100000);out.warnings.push('正文超过采集长度上限，本次内容已截断。');}
  if(out.company_intro.length>30000){out.company_intro=out.company_intro.slice(0,30000);out.warnings.push('公司介绍过长，已截断。');}
  if(out.description&&out.description.length<80)out.warnings.push('页面正文较短，请确认已展开全部内容。');
  if(platform==='website')out.warnings.push('通用网页采集，请核对公司、职位和正文范围。');
  return out;
}
