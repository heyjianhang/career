#!/usr/bin/env node
import path from 'node:path';
import {spawn} from 'node:child_process';
import {templateMetadata} from './presentation/templates/registry.js';
import {check,root,themes,readDefaultTheme,readPreference,savePreference,json,rules,platforms} from './presentation/io.js';
import {buildCollection,listPresentations} from './presentation/collection.js';
import {build,loadBuild} from './presentation/build.js';
import {startPreview} from './presentation/server.js';
import {exportPdf} from './presentation/pdf.js';
import {CommandError,initializeWorkspace,inspectWorkspace,workspaceStatus,hashWorkspaceFile,savePresentation} from './agent-api.js';
import {discoverWorkspace,setup,doctor,installAgent,localOnly} from './workspace/setup.js';
import {initHistory,saveHistory,historyList,syncStatus,connect,pull,push,restore} from './workspace/git.js';
import {SetupError,installPdf} from './workspace/process.js';
import type {Theme,Platform} from './presentation/types.js';

const commands = {
  'workspace.setup':{args:'--workspace <dir> [--no-install] [--package-source <tgz>]',description:'准备独立个人工作区、锁定工具和 Agent 指引；别名 setup',options:['workspace','no-install','package-source']},
  'workspace.doctor':{args:'[--workspace <dir>]',description:'检查环境和首次引导状态；别名 doctor',options:['workspace']},
  'workspace.restore':{args:'--workspace <new-dir> --repository <owner/repo>',description:'从 GitHub 私人仓库恢复到新目录',options:['workspace','repository']},
  'agent.install':{args:'[--workspace <dir>]',description:'安装或更新项目 Skills；保留用户修改',options:['workspace']},
  'runtime.install':{args:'--component pdf',description:'准备当前工具版本对应的 PDF 浏览器',options:['component']},
  'history.init':{args:'[--name <name>] [--email <email>] [--workspace <dir>]',description:'建立独立 main 仓库；提交身份只设置在当前仓库',options:['workspace','name','email']},
  'history.save':{args:'--message <text> [--workspace <dir>]',description:'校验后创建本地版本，不上传',options:['workspace','message']},
  'history.list':{args:'[--workspace <dir>]',description:'列出最近的本地保存版本',options:['workspace']},
  'sync.local':{args:'[--workspace <dir>]',description:'记录暂不启用远程同步的选择',options:['workspace']},
  'sync.connect':{args:'--repository <owner/repo> [--create] [--workspace <dir>]',description:'创建或连接有写权限的 GitHub 私人仓库，不推送',options:['workspace','repository','create']},
  'sync.status':{args:'[--refresh] [--workspace <dir>]',description:'检查本地同步状态；refresh 时获取远端',options:['workspace','refresh']},
  'sync.pull':{args:'[--workspace <dir>]',description:'仅快进更新；未保存或分叉时保留内容并停止',options:['workspace']},
  'sync.push':{args:'[--workspace <dir>]',description:'用户同意后上传已保存版本，验证私人目标并拒绝强推',options:['workspace']},
  'workspace.init':{args:'[--workspace <dir>]',description:'初始化或补缺；保留已有资料',options:['workspace']},
  'workspace.status':{args:'[--workspace <dir>]',description:'只读盘点文件、结构和内容包；不判断语义完成',options:['workspace']},
  'workspace.check':{args:'[--workspace <dir>]',description:'检查 v2 事实、来源和母版引用',options:['workspace']},
  'workspace.hash':{args:'--path <relative-file> [--workspace <dir>]',description:'读取工作区文件并返回来源／照片摘要',options:['workspace','path']},
  'resume.freeze':{args:'--version <id> [--workspace <dir>]',description:'留存既有 v2 完整版本，不投递',options:['workspace','version']},
  'resume.schema':{args:'',description:'返回实际使用的内容包 JSON Schema',options:[]},
  'resume.platforms':{args:'[--platform <id>]',description:'返回平台字段、限制与核对范围',options:['platform']},
  'resume.save':{args:'--input <candidate.json> [--workspace <dir>] [--if-match <sha256>]',description:'校验并保存 Agent 写的内容包；更新保留旧副本',options:['input','workspace','if-match']},
  'resume.validate':{args:'--input <package.json> [--workspace <dir>]',description:'检查内容包、照片和来源摘要',options:['input','workspace']},
  'resume.build':{args:'(--input <package.json> | --collection) [--workspace <dir>] [--out <new-dir>] [--theme <id>] [--platform all]',description:'生成新的 HTML 快照',options:['input','collection','workspace','out','theme','platform']},
  'resume.preview':{args:'[--input <package.json> | --build <dir>] [--workspace <dir>] [--port <port>] [--open]',description:'启动本机工作台；进程持续运行',options:['input','build','workspace','port','open']},
  'resume.export':{args:'--build <dir> --format pdf --out <new.pdf> [--theme <id>]',description:'从已保存快照导出 PDF',options:['build','format','theme','out']},
  'resume.list':{args:'[--workspace <dir>]',description:'列出可用内容包及目录问题',options:['workspace']},
  'resume.themes':{args:'',description:'列出已实现的排版样式',options:[]},
  'resume.preferences':{args:'[--workspace <dir>] [--theme <id> | --clear]',description:'查看、保存或清除工作区默认样式',options:['workspace','theme','clear']}
} satisfies Record<string,{args:string;description:string;options:string[]}>;
const argv=process.argv.slice(2);
if(['setup','doctor'].includes(argv[0]??''))argv.unshift('workspace');
const jsonMode=argv.includes('--json');
let operation='cli.help';
function output(data:unknown,warnings:unknown[]=[],errors:unknown[]=[]) {
  const status=errors.length?'error':'success';
  const value=JSON.stringify({schema_version:'career-cli/v1',operation,status,data,warnings,errors},null,jsonMode?undefined:2);
  if(errors.length){console.error(value);process.exitCode=1;}else console.log(value);
}
function help() {
  const topic=argv.filter(arg=>arg!=='--json'&&arg!=='--help');
  if(topic.length>2 || (topic.length&&!Object.keys(commands).some(key=>key===topic.join('.')||key.startsWith(topic.join('.')+'.'))))throw new CommandError('INVALID_ARGUMENT','未知帮助主题');
  const entries=Object.entries(commands).filter(([key])=>!topic.length||key===topic.join('.')||key.startsWith(topic.join('.')+'.')).map(([key,value])=>({command:'career '+key.replace('.',' '),...value,options:[...value.options,'json']}));
  if(jsonMode)output({commands:entries,default_workspace:'从当前目录向上查找 career.json，或显式 --workspace',content_author:'agent',bootstrap:'career setup --workspace <独立个人目录>'});
  else console.log('career — 与 Agent 协作的个人求职工作台\n\n'+entries.map(entry=>'  '+entry.command+' '+entry.args+' [--json]\n    '+entry.description).join('\n')+'\n\n默认工作区：当前目录向上查找 career.json。所有正文由 Agent 写作，CLI 不改写经历。\nPDF 首次使用运行 career runtime install --component pdf。');
}
try {
  if(!argv.length||argv.includes('--help')||argv.every(arg=>arg==='--json')) {help();}
  else {
    operation=argv[0]+'.'+(argv[1]??'');
    if(!Object.hasOwn(commands,operation))throw new CommandError('INVALID_ARGUMENT','未知子命令，使用 --help 查看实际能力');
    const spec=commands[operation as keyof typeof commands];
    const options:Record<string,string|boolean>={};
    const allowed:string[]=[...spec.options,'json'];
    for(let i=2;i<argv.length;i++) {
      const token=argv[i]!,key=token.replace(/^--/,'');
      if(!token.startsWith('--')||!allowed.includes(key)||options[key]!==undefined)throw new CommandError('INVALID_ARGUMENT','参数无效或重复：'+token);
      if(['json','open','collection','clear','no-install','refresh','create'].includes(key))options[key]=true;
      else {const value=argv[++i];if(!value||value.startsWith('--'))throw new CommandError('INVALID_ARGUMENT','参数缺值：'+key);options[key]=value;}
    }
    const need=(key:string)=>{if(typeof options[key]!=='string')throw new CommandError('INVALID_ARGUMENT','请提供 --'+key);return options[key] as string;};
    const required:Record<string,string[]>={'workspace.setup':['workspace'],'workspace.restore':['workspace','repository'],'workspace.hash':['path'],'resume.save':['input'],'resume.validate':['input'],'resume.freeze':['version'],'resume.export':['build','format','out'],'runtime.install':['component'],'history.save':['message'],'sync.connect':['repository']};
    for(const key of required[operation]??[])need(key);
    const workspaceFree=['workspace.doctor','resume.schema','resume.platforms','resume.themes','resume.export','runtime.install'].includes(operation);
    if(['workspace.setup','workspace.restore'].includes(operation))need('workspace');
    const workspace=workspaceFree?(options.workspace?path.resolve(String(options.workspace)):process.cwd()):await discoverWorkspace(options.workspace as string|undefined);
    const theme=options.theme as Theme|undefined;
    if(theme&&operation!=='resume.export'&&!themes.includes(theme))throw new CommandError('INVALID_ARGUMENT','未知样式：'+theme);
    switch(operation) {
      case 'workspace.setup':output(await setup(workspace,!options['no-install'],options['package-source'] as string|undefined));break;
      case 'workspace.doctor':output(await doctor(workspace));break;
      case 'workspace.restore':output(await restore(workspace,need('repository')));break;
      case 'agent.install':output(await installAgent(workspace));break;
      case 'runtime.install':if(need('component')!=='pdf')throw new CommandError('INVALID_ARGUMENT','当前仅支持 pdf');output(await installPdf());break;
      case 'history.init':output(await initHistory(workspace,options.name as string|undefined,options.email as string|undefined));break;
      case 'history.save':output(await saveHistory(workspace,need('message')));break;
      case 'history.list':output(await historyList(workspace));break;
      case 'sync.local':output(await localOnly(workspace));break;
      case 'sync.connect':output(await connect(workspace,need('repository'),Boolean(options.create)));break;
      case 'sync.status':output(await syncStatus(workspace,Boolean(options.refresh)));break;
      case 'sync.pull':output(await pull(workspace));break;
      case 'sync.push':output(await push(workspace));break;
      case 'workspace.init':output(await initializeWorkspace(workspace));break;
      case 'workspace.status':{
        const result=await workspaceStatus(workspace);
        output(result,[...(result.validation?.warnings??[]),...(result.presentations?.warnings??[])]);break;
      }
      case 'workspace.check':{
        const {errors,warnings,...result}=await inspectWorkspace(workspace);
        output(result,warnings,errors.map(message=>({code:'WORKSPACE_INVALID',message})));break;
      }
      case 'workspace.hash':output(await hashWorkspaceFile(workspace,need('path')));break;
      case 'resume.freeze':{const {freeze}=await import(new URL('../scripts/freeze.mjs',import.meta.url).href);output(await freeze(workspace,need('version')));break;}
      case 'resume.schema':output({json_schema:await json(path.join(root,'schemas/presentation.v1.schema.json')),example_path:path.join(root,'examples/presentation/package.json')});break;
      case 'resume.platforms':{
        const id=options.platform as Platform|undefined;
        if(id&&!platforms.includes(id))throw new CommandError('INVALID_ARGUMENT','未知平台：'+id);
        const registry=await rules();output({
          input_contract:{
            rule_lookup:'<section.kind>.<field.key>',
            guidance:'规则表中的 project.name 是查找地址；内容包中拆为 kind: project 和 key: name，field.key 不带前缀。每个 section 还需要独立 id、title 与 fields。',
            section_example:{id:'project-example',kind:'project',title:'示例项目',fields:[{key:'name',value:'示例项目'}]},
          },
          platforms:(id?[id]:platforms).map(key=>({id:key,...registry[key]})),
        });break;
      }
      case 'resume.save':{const {warnings,...result}=await savePresentation(need('input'),workspace,options['if-match'] as string|undefined);output(result,warnings);break;}
      case 'resume.themes':output(templateMetadata);break;
      case 'resume.preferences':{
        if(options.clear&&theme)throw new CommandError('INVALID_ARGUMENT','--theme 与 --clear 不能同时指定');
        if(options.clear)await savePreference(workspace,null);else if(theme)await savePreference(workspace,theme);
        output({saved_theme:await readDefaultTheme(workspace),effective_theme:await readPreference(workspace)});break;
      }
      case 'resume.list':{const listed=await listPresentations(workspace);output(listed,listed.warnings);break;}
      case 'resume.validate':{const c=await check(need('input'),workspace);output({id:c.input.id,valid:true},c.warnings);break;}
      case 'resume.build':{
        if(options.platform&&options.platform!=='all')throw new CommandError('INVALID_ARGUMENT','当前 --platform 仅支持 all；缺少的稿件明确提示。');
        if(Boolean(options.input)===Boolean(options.collection))throw new CommandError('INVALID_ARGUMENT','请提供 --input 或 --collection，二选一');
        const result=options.collection?await buildCollection(workspace,options.out as string|undefined,theme):await build(need('input'),workspace,options.out as string|undefined,theme);
        output(result,result.warnings);break;
      }
      case 'resume.export':{
        if(need('format')!=='pdf')throw new CommandError('INVALID_ARGUMENT','当前 export 支持 pdf；HTML 由 build 生成。');
        const dir=need('build'),out=need('out'),selected=theme??(await loadBuild(dir)).manifest.theme;
        output(await exportPdf(dir,selected,out));break;
      }
      case 'resume.preview':{
        if(options.input&&options.build)throw new CommandError('INVALID_ARGUMENT','--input 与 --build 不能同时指定');
        const port=options.port===undefined?0:Number(options.port);
        if(!Number.isInteger(port)||port<0||port>65535)throw new CommandError('INVALID_ARGUMENT','无效端口');
        const directory=options.build as string??(options.input?(await build(need('input'),workspace)).directory:(await buildCollection(workspace)).directory);
        const preview=await startPreview(directory,workspace,port);output({url:preview.url,directory});
        if(options.open){const command=process.platform==='darwin'?'open':process.platform==='win32'?'explorer.exe':'xdg-open';const child=spawn(command,[preview.url],{stdio:'ignore'});child.on('error',()=>console.error('请手动打开 '+preview.url));child.unref();}
        const stop=()=>{preview.server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1500).unref();};process.once('SIGINT',stop);process.once('SIGTERM',stop);break;
      }
    }
  }
}catch(error){const e=error as Error;output(null,[],[{code:error instanceof CommandError||error instanceof SetupError?error.code:operation.startsWith('workspace.')?'WORKSPACE_ERROR':'PRESENTATION_ERROR',message:e.message,...((error instanceof CommandError||error instanceof SetupError)&&error.details?{details:error.details}:{})}]);}
