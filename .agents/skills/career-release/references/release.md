# 发布操作

所有命令从开发仓库运行；示例中的 `<版本>`、`<候选SHA>`、`<PR号>`、`<归档绝对路径>` 等由本次实测值替换。临时安装、缓存和归档放仓库外，不读个人求职工作区。默认发布正式版到 `latest`；预发布用独立标签，不能覆盖稳定入口。

## 1. 查明当前阶段

```sh
git status --short
git branch --show-current
git remote -v
git fetch origin --tags
git log -5 --oneline
npm view @heyjianhang/career dist-tags --json --registry=https://registry.npmjs.org/
npm view @heyjianhang/career@<版本> version dist.integrity --json --registry=https://registry.npmjs.org/
```

核对 origin 是 `heyjianhang/career`，不要对同名用户资料库操作。registry 查询失败时区分版本不存在、网络、认证故障；不要把任何错误都当成“未发布”。版本已存在则转到该阶段的验证和补齐，不能再次发布相同版本。

先看上一个正式标签与当前差异，选版本：兼容修复通常 patch，新增兼容能力通常 minor；破坏性改动先说明迁移影响并和维护者确定版本。当前 0.x 阶段也应明确写出兼容性，不用“尚未 1.0”省略说明。

工作树有改动时确认本次包含哪些；不要自动 stash、reset 或 `git add -A`。已有合适的开发分支就沿用或整理成发布分支，不重复搬动工作。干净且无分叉时可在 main 使用 `git pull --ff-only`，再 `git switch -c release/v<版本>`；不能快进则先解决分叉。

## 2. 更新与检查

```sh
npm version <版本> --no-git-tag-version
```

按 Skill 的版本表修改源码和面向新用户的安装说明。`npm version` 不修改 install.md；缺失时 `check:docs`／门户构建会失败。候选分支的发布记录标注“待发布”，不预填成功时间或验证回执。

基础检查与三平台 CI 保持一致：

```sh
npm ci --ignore-scripts
npm test
npm run check:docs
npm run build:site
npm run check:example
npm run test:package
git diff --check
```

`test:package` 会安装真实 tgz，检查初始化、重复 setup、安装后的五个用户 Skills、引用、HTML 和本地 Git 保存；它会清理测试归档。开发 Skill `career-release` 必须既不在 npm 包，也不在用户工作区。`package.json.files` 和 `scripts/package-resources.mjs` 都显式列出五个用户 Skills；新增用户 Skill 时两处和验证一起维护。

按改动补跑专项测试：成果页／分页用 `test:browser`、`test:layout`；链接用 `test:links`；样式用 `test:templates`。需要 Chromium 时执行 `npx playwright install chromium`。这些不在当前 CI 基础矩阵内，不能用 CI 绿灯代替 PDF 检查。门户改动还要打开本机预览，核对复制内容、徽标和窄屏布局。

## 3. 提交和 PR

逐个暂存相关路径，检查 `git diff --cached` 后提交。不要提交 dist、resources、build、tgz、真实简历、凭据或本机路径。发布说明先写具体变化和用户影响，再写验证及兼容性；不要只写“优化若干问题”。

```sh
git commit -m "chore(release): 准备 v<版本>"
git push -u origin release/v<版本>
gh pr create --base main --head release/v<版本> --title "release: v<版本>" --body-file <PR说明文件>
gh pr checks <PR号> --watch
```

正文通过文件或结构化参数传递，避免 shell 展开。创建 PR 后在支持的宿主中附到当前任务。记录 `git rev-parse HEAD` 为候选 SHA；必要时用 `gh api repos/heyjianhang/career/commits/<候选SHA>/check-runs` 验证三个 Node 22 检查属于同一提交。不要引用上一轮通过的结果。

此时保持 PR 未合并。GitHub main 的安装指南是公开入口，提前合并会让用户请求尚不存在的 npm 版本。发布准备应尽量保持 main 不再变化；若基线变化或有冲突，先合并最新 main、重新检查候选，再发布。

## 4. 固定并发布归档

从干净的候选提交执行；`npm pack` 的 prepack 会构建资源：

```sh
npm pack --json --pack-destination <仓库外归档目录>
npm whoami --registry=https://registry.npmjs.org/
```

保存 pack 返回的文件名、文件清单、size、integrity 和候选 SHA。包名应为 `@heyjianhang/career`，当前维护账号为 `heyjianhang`；如账号改变，确认权限和维护意图再继续。核对清单仅包含许可的运行资源，避免把源码目录或门户根目录发布出去。

使用刚生成的归档再做一次独立安装，`--package-source` 确保工作区装到的是同一个候选包：

```sh
npm exec --yes --cache <临时缓存目录> --package <归档绝对路径> -- career setup --workspace <临时工作区绝对路径> --package-source <归档绝对路径> --json
npm --prefix <临时工作区绝对路径> run career -- doctor --json
npm --prefix <临时工作区绝对路径> run career -- workspace check --json
```

命令实参含空格时加双引号。核对真实 AGENTS、五个用户 Skills、next_reads 和 next_action；只在当前版本确实实现时检查 handoff。相关成品变动从包内合成示例继续验证 HTML／PDF。测试后再次检查源码未变、归档未被替换；发布经验证的路径，不直接 `npm publish` 当前目录重新打包。

有该版本的发布授权后：

```sh
npm publish <归档绝对路径> --access public --tag latest --registry=https://registry.npmjs.org/
```

认证、2FA 在 npm 官方流程完成；不要把密码、OTP 或令牌写入命令记录、文档或 CI。若发布命令返回结果不确定，先查 registry 再决定是否重试。

## 5. 公开安装与公共入口

查询新版本的 `dist.integrity` 和 dist-tags，比较本地归档。使用新的空缓存、全新临时目录，从官方 registry 执行 install.md 中的**固定新版本** npx setup 命令，再运行 doctor、workspace check 和合成 HTML 流程。缓存验证与本地 tgz 安装不是一回事。

索引传播延迟可有限重试，例如最多三次、逐次延长但每次不超过 60 秒。仍不能安装时保留候选归档和证据，报告“npm 已接受、公开安装待验证”，不要先合并公共入口。

安装通过后，确认 PR 仍可合并且 CI 通过。优先 merge commit 合并以保留已发布候选 SHA，随后建立标签：

```sh
gh pr merge <PR号> --merge
git fetch origin --tags
git merge-base --is-ancestor <候选SHA> origin/main
git tag -a v<版本> <候选SHA> -m "career v<版本>"
git push origin v<版本>
```

标签准确指向发布归档的来源提交；不要为了让它等于 main 最新 SHA 而重写已有标签。若仓库仅允许 squash／rebase，先明确合并后的树与已发布候选树一致，并在记录中保留两者 SHA；发现额外功能变化就不能把新树冒充包源码。不要启用绕过保护的管理员合并；主分支变更造成冲突时先协调，不强推。

通过后续文档 PR 补齐 `docs/releases/<版本>.md` 与 docs/context.md，仍遵守 main 的保护规则。发布记录至少包含：

- 用户可感知的新增／修复、兼容性与升级要求。
- 发布日期、包名、版本、标签、实际发布源码 SHA。
- 归档 integrity、文件数和字节数。
- CI 链接、本地专项验证、公开安装结果及未覆盖事项。

用这些已核实的内容编写中文 GitHub Release 正文：

```sh
gh release create v<版本> --verify-tag --title "career v<版本>" --notes-file <发布说明文件>
```

Release 已存在则核对后更新说明，不创建重复条目。PR／Release 文案面向没看过对话的使用者，不记录逐轮讨论。

从合并后的源码重新 `npm run build:site`，依[门户与托管](../../../../docs/portal.md)完成已授权的部署。main 的 raw install.md、llms.txt 应可访问；核对实际线上徽标、复制指令及指南版本。门户仍未配置托管时明确待办，不把本地 URL 当成官网。

## 6. 中断与失败续接

| 实际状态 | 下一步 |
| --- | --- |
| CI 或 tgz 验证失败 | 修复候选，再检查；不发布、不合并新版本入口 |
| npm 未收到包／版本不存在 | 修复认证或网络后重试同一已验证归档；先排除结果不确定 |
| npm 已存在，安装／后续 Git 或部署失败 | 从失败步骤继续，不重新 publish；保留原归档和 SHA |
| 已发布包有功能缺陷 | 新发修复版本；必要时按维护者授权调整 dist-tag 或 deprecate，不能默认 unpublish |
| 标签已存在 | 比较 SHA，一致则复用；不一致停止标签操作并说明，不强制移动 |

已发布的 npm 名称与版本不能重复使用，即使删除也不能复用，见 [npm publish](https://docs.npmjs.com/cli/commands/npm-publish/)。普通“写 Skill／检查发布”任务不要改变 npm dist-tag、仓库设置或公开服务。
