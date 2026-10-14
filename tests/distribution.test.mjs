import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,readFile,writeFile,mkdir,rm,stat,symlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setup,installAgent,discoverWorkspace,localOnly,withLock} from '../dist/workspace/setup.js';
import {initHistory,saveHistory,gitStatus,historyList,pull,push,githubRepo,requirePrivateRepository} from '../dist/workspace/git.js';
const exec=promisify(execFile),cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
const git=async(w,...args)=>(await exec('git',args,{cwd:w,env:{...process.env,GIT_CONFIG_NOSYSTEM:'1'}})).stdout.trim();
async function fixture(t){const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-distribution-'));t.after(()=>rm(dir,{recursive:true,force:true}));const workspace=path.join(dir,'我的 career');await setup(workspace,false);return {dir,workspace};}
async function init(w){await initHistory(w,'Career Test','career-test@example.invalid');await saveHistory(w,'初始资料');}
async function execute(cwd,...args){try{const result=await exec(process.execPath,[cli,...args,'--json'],{cwd});return {exit:0,...JSON.parse(result.stdout)};}catch(e){return {exit:e.code,...JSON.parse(e.stderr)};}}
const fails=(code)=>e=>e.code===code;
const currentPackage=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));

test('setup gives complete next reads, local dependency pin and non-destructive retry',async t=>{
 const {workspace}=await fixture(t);const config=JSON.parse(await readFile(path.join(workspace,'career.json')));assert.equal(config.onboarding.sync,'undecided');assert.equal(config.tool.name,'@heyjianhang/career');
 const packageData=JSON.parse(await readFile(path.join(workspace,'package.json')));assert.equal(packageData.private,true);assert.equal(packageData.dependencies[currentPackage.name],currentPackage.version);
 const readme=await readFile(path.join(workspace,'AGENTS.md'),'utf8');assert.match(readme,/大节点|重要更新/);assert.match(readme,/sync overview/);assert.match(readme,/sync update/);
 assert.match(await readFile(path.join(workspace,'.gitignore'),'utf8'),/node_modules/);
 await writeFile(path.join(workspace,'context/state.md'),'# 我的进度\n不丢失');await localOnly(workspace);
 const retry=await setup(workspace,false);assert.equal(retry.next_action,'read_context');assert.equal(retry.handoff,null);assert.deepEqual(retry.questions,[]);assert.equal(retry.agent.conflicts.length,0);assert.equal(JSON.parse(await readFile(path.join(workspace,'career.json'))).onboarding.sync,'local');assert.match(await readFile(path.join(workspace,'context/state.md'),'utf8'),/不丢失/);
 for(const file of retry.next_reads)assert.ok((await stat(file)).isFile());
 for(const file of ['SKILL.md','references/first-sync.md','references/daily-sync.md','references/restore.md'])assert.ok((await stat(path.join(workspace,'.agents/skills/career-git',file))).isFile());
 const status=await execute(workspace,'workspace','status');assert.equal(status.exit,0);assert.equal(status.data.initialized,true);
});

test('repeated setup routes connected workspaces to sync checks without asking again',async t=>{
 const {workspace}=await fixture(t);const file=path.join(workspace,'career.json');const value=JSON.parse(await readFile(file));
 value.onboarding.sync='connected';value.sync={repository:'fixture/private',mode:'ask'};await writeFile(file,JSON.stringify(value));
 const retry=await setup(workspace,false);assert.equal(retry.next_action,'check_sync');assert.deepEqual(retry.questions,[]);
 const diagnosis=await execute(workspace,'doctor');assert.equal(diagnosis.data.next_action,'check_sync');
 await writeFile(path.join(workspace,'AGENTS.md'),'# 用户自定义入口');
 const conflict=await setup(workspace,false);assert.equal(conflict.next_action,'resolve_agent_files');assert.equal(conflict.handoff,null);assert.deepEqual(conflict.questions,[]);assert.ok(conflict.agent.conflicts.includes('AGENTS.md'));
 const retained=JSON.parse(await readFile(file));assert.equal(retained.onboarding.sync,'connected');assert.equal(retained.sync.repository,'fixture/private');
});

test('setup rejects unrelated nonempty directories and preserves edited Agent instructions',async t=>{
 const {workspace,dir}=await fixture(t);const foreign=path.join(dir,'foreign');await mkdir(foreign);await writeFile(path.join(foreign,'valuable.txt'),'keep');
 await assert.rejects(setup(foreign,false),fails('DIRECTORY_NOT_EMPTY'));assert.equal(await readFile(path.join(foreign,'valuable.txt'),'utf8'),'keep');
 const file=path.join(workspace,'AGENTS.md');await writeFile(file,'# 用户自定义指令');const result=await installAgent(workspace);assert.ok(result.conflicts.includes('AGENTS.md'));assert.equal(await readFile(file,'utf8'),'# 用户自定义指令');
});

test('CLI never falls back to program cache for unlocated data and setup alias works',async t=>{
 const dir=await mkdtemp(path.join(await realpath(os.tmpdir()),'career-cwd-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const absent=await execute(dir,'workspace','status');assert.equal(absent.errors[0].code,'WORKSPACE_REQUIRED');
 const initialized=await execute(dir,'setup','--workspace',path.join(dir,'data'),'--no-install');assert.equal(initialized.exit,0);assert.equal(initialized.data.next_action,'choose_sync');assert.equal(initialized.data.handoff,null);
 const help=await execute(dir,'--help');assert.ok(help.data.commands.some(c=>c.command==='career sync push'));
});

test('initialization is main only, ignores build/secrets, refuses nested repositories, and makes no empty commits',async t=>{
 const {workspace,dir}=await fixture(t);await init(workspace);assert.equal(await git(workspace,'branch','--show-current'),'main');
 await writeFile(path.join(workspace,'context/state.md'),'# 更新');await mkdir(path.join(workspace,'build'));await writeFile(path.join(workspace,'build','output.html'),'output');await writeFile(path.join(workspace,'.env'),'SECRET=fixture');await writeFile(path.join(workspace,'unrelated.txt'),'do not add');
 const saved=await saveHistory(workspace,'整理资料');assert.equal(saved.saved,true);const tracked=await git(workspace,'ls-files');assert.doesNotMatch(tracked,/output.html|\.env|unrelated.txt|operation.lock/);
 assert.equal((await saveHistory(workspace,'无变化')).saved,false);assert.equal((await historyList(workspace)).entries.length,2);
 const nested=path.join(workspace,'nested');await setup(nested,false);await assert.rejects(init(nested),fails('FOREIGN_REPOSITORY'));
});

test('invalid facts, an existing operation lock, and tracked unmanaged files stop a checkpoint',async t=>{
 const {workspace}=await fixture(t);await init(workspace);await writeFile(path.join(workspace,'resume/facts/profile.md'),'not a valid fact');await assert.rejects(saveHistory(workspace,'不应保存'),fails('WORKSPACE_INVALID'));
 await withLock(workspace,async()=>{await assert.rejects(saveHistory(workspace,'并发'),fails('WORKSPACE_BUSY'));});
 await git(workspace,'restore','resume/facts/profile.md');await writeFile(path.join(workspace,'foreign.txt'),'keep');await git(workspace,'add','foreign.txt');await assert.rejects(saveHistory(workspace,'范围检查'),fails('UNMANAGED_TRACKED_FILES'));
});

test('private target validation rejects public, read-only and credential-bearing URLs',()=>{
 assert.equal(githubRepo('https://github.com/me/data.git'),'me/data');assert.equal(githubRepo('git@github.com:me/data.git'),'me/data');assert.equal(githubRepo('me/data'),'me/data');
 for(const url of ['https://token@github.com/me/data','file:///tmp/repo','--exec/x','https://evil.invalid/me/data'])assert.throws(()=>githubRepo(url));
 assert.throws(()=>requirePrivateRepository({private:false,permissions:{push:true}}));assert.throws(()=>requirePrivateRepository({private:true,permissions:{push:false}}));assert.equal(requirePrivateRepository({private:true,permissions:{push:true}}).private,true);
});

test('two-device Git flow handles fast-forward, dirty files and divergence without overwriting',async t=>{
 const {workspace,dir}=await fixture(t);await init(workspace);const remote=path.join(dir,'remote.git');await git(dir,'init','--bare','--initial-branch=main',remote);await git(workspace,'remote','add','origin',remote);await git(workspace,'push','-u','origin','main');
 // Transport fixture uses a local bare repository; production always verifies GitHub privacy.
 const verified=async()=> 'fixture/private';const other=path.join(dir,'other');await git(dir,'clone',remote,other);await initHistory(other,'Career Other','other@example.invalid');
 await writeFile(path.join(other,'context/state.md'),'# 另一台设备');await saveHistory(other,'远端更新');await git(other,'push','origin','main');
 const pulled=await pull(workspace,verified);assert.equal(pulled.updated,true);assert.equal(await readFile(path.join(workspace,'context/state.md'),'utf8'),'# 另一台设备');
 await writeFile(path.join(workspace,'context/goals.md'),'# 本机目标');await assert.rejects(pull(workspace,verified),fails('LOCAL_CHANGES'));await saveHistory(workspace,'本地更新');
 await writeFile(path.join(other,'context/state.md'),'# 第二次远端更新');await saveHistory(other,'第二次远端更新');await git(other,'push','origin','main');
 const head=await git(workspace,'rev-parse','HEAD');await assert.rejects(pull(workspace,verified),fails('SYNC_DIVERGED'));await assert.rejects(push(workspace,verified),fails('SYNC_DIVERGED'));assert.equal(await git(workspace,'rev-parse','HEAD'),head);assert.equal(await readFile(path.join(workspace,'context/goals.md'),'utf8'),'# 本机目标');
 assert.equal((await gitStatus(workspace)).diverged,true);
});

test('push requires a saved clean tree and never uploads automatically when saving',async t=>{
 const {workspace,dir}=await fixture(t);await init(workspace);const remote=path.join(dir,'remote.git');await git(dir,'init','--bare','--initial-branch=main',remote);await git(workspace,'remote','add','origin',remote);
 // A connected config is only metadata for this isolated transport fixture.
 const file=path.join(workspace,'career.json'),value=JSON.parse(await readFile(file));value.sync={repository:'fixture/private',mode:'ask'};await writeFile(file,JSON.stringify(value));await assert.rejects(push(workspace,async()=>''),fails('LOCAL_CHANGES'));
 await saveHistory(workspace,'准备同步');assert.equal(await git(dir,'--git-dir',remote,'show-ref').catch(()=>''),'');
 const result=await push(workspace,async()=>'');assert.equal(result.synced,true);assert.equal(await git(dir,'--git-dir',remote,'rev-parse','main'),result.commit);
});
