# 开发与维护

先读 [项目上下文](context.md)，按任务进入 [架构](architecture.md)、[共享数据契约](data-model.md) 或 [成果页与 CLI](presentation.md)。首次贡献从 [CONTRIBUTING](../CONTRIBUTING.md) 开始。开发代码和模板时使用合成数据，不扫描个人履历。

## 环境与检查

使用 Node.js 22+。在仓库根目录运行：

```bash
npm ci --ignore-scripts
npm test
npm run check:docs
npm run check:example
# 修改成果页／PDF 时，再运行：
npx playwright install chromium
npm run test:browser
npm run test:layout
# 修改网页／项目链接时：
npm run test:links
# 修改简历排版模板时：
npm run test:templates
```

测试使用临时工作区，覆盖初始化、数据引用和冻结等行为。`tests/agent-cli.test.mjs` 通过子进程调用真实 CLI，覆盖能力发现、只读状态、JSON 错误、文件摘要、保存冲突／历史副本和带照片的保存到本地服务流程；测试不会扫描私人工作区。工作区操作从当前目录向上查找 career.json，开发时必须显式传 `--workspace <合成目录>`；不能假定开发仓库内存在默认私人工作区。

## 文件归属

- 访谈、母版写作、JD 匹配与平台填写方法：修改对应 `.agents/skills/<skill>/`。
- 求职任务模板：修改该 Skill 的 `templates/`，不要在根目录或 workspace 另建公共副本。
- 跨模块 ID、字段和更新关系：修改 `docs/data-model.md`，同步相关模板、脚本与合成示例。
- 成果页、主题、CLI 与本地预览：修改 `src/`；公共机器契约在 `schemas/`，实际平台字段规则仍在 resume-tailor Skill。详见 [成果页实现](presentation.md)。
- 初始化、v2 校验、摘要和冻结：底层工具在 `scripts/`；统一 Agent 命令与成品保存入口在 `src/agent-api.ts` / `src/cli.ts`。CLI 复用底层工具，避免维护两种工作区格式。单一 Skill 专用的新辅助脚本放该 Skill 内。
- 初始化引导由 career-setup 维护；个人 Git 建仓、提交与同步方法统一在 career-git，工作区 AGENTS 负责路由。
- npm 初始化、受管指引和 Git 同步：`src/workspace/`。用户入口在 `templates/workspace/`，构建脚本 `scripts/package-resources.mjs` 组装可安装资源；根 AGENTS 只服务项目开发。
- 项目当前状态与下一步：更新 `docs/context.md`；架构决定写入 `docs/decisions/`。
- 私人上下文机制：协议在 `docs/context-protocol.md`，起步模板在 `templates/context/`，实例在 workspace/context/。

模板路径变化需要检查 init、validate 和 freeze 的读取路径，以及 README、AGENTS、Skill 和文档中的链接。平台模板的路径移动不改变其修订号；字段和约束变更才更新 revision。不要修改冻结版本来消除模板迁移的提示。

## 验证与交接

运行与变更有关的既有检查；脚本和数据格式变更运行完整测试与虚构样例校验。Skill 变更检查 frontmatter、随包资源链接、任务边界和独立模式说明。单纯目录迁移不代表写作能力已通过模型评测，行为评测范围见 [验证说明](validation.md)。

保留已有未提交改动、未知字段和个人文件。交接说明实际修改、实际检查结果及尚未实现内容；只更新已完成的开发状态。提交与推送遵循用户授权。

## CI：每次代码改动的自动检查

[GitHub Actions 工作流](../.github/workflows/check.yml) 在 push 和 pull request 时运行，在 macOS、Windows、Linux 上使用 Node 22 分别检查：

| 检查 | 要发现的问题 |
| --- | --- |
| `npm ci --ignore-scripts` | 锁文件与依赖安装不一致 |
| `npm test` | TypeScript 构建失败，或 CLI、数据保护、同步逻辑回归 |
| `npm run check:docs` | Skills、文档或安装后的引用缺失，三处初始化指令不一致 |
| `npm run check:example` | 当前规则无法处理仓库中的合成资料 |
| `npm run test:package` | 打包漏资源，或实际安装后无法初始化、生成 HTML、保存版本 |

检查只读仓库代码，测试数据放在临时目录，不需要 npm 发布令牌或用户的 GitHub 登录。这里没有 PDF 浏览器矩阵或独立 Agent 行为评测；相关改动仍按上面的专项命令验证。

2026-10-13 的[首次通过的 CI](https://github.com/heyjianhang/career/actions/runs/38360490634)已在三种系统上成功运行。后续推送仍应核对对应提交的实际结果。npm 0.2.0 已单独发布并通过公开安装验证，见[发布记录](releases/0.2.0.md)。当前没有自动发布工作流，也不会随 main 更新自动上传 npm。

## 打包与发布

```sh
npm test
npm run check:example
npm run test:package
npm pack
```

`test:package` 会从真实 tgz 安装到临时目录，再检查 setup／重试、五个 Skills、`.gitignore`、HTML 生成及本地 Git 保存。缓存不完整时会从 npm registry 获取依赖或元数据，不能假定 npm ci 已预热全部安装元数据；临时资料均为合成内容，结束清理，不使用 GitHub。`.gitignore` 在包中使用 gitignore.template 文件名，安装时还原，避免 npm 丢弃忽略文件。

包采用 files 白名单；运行所需的合成内容包保留，私人 workspace、构建产物、测试、研究截图和源码不进入 npm。发布前检查 npm pack 的文件清单，核对账号和版本，核对开发仓库地址，按用户授权以公开 scoped 包发布（publishConfig 固定官方 registry 与 public 访问）；凭据只通过 npm 官方认证流程处理。成功发布后还需从 registry 在新目录安装验证，最后核对 README／安装页中的版本和命令。公开说明采用正式使用文案；真实发布记录只根据成功回执更新。

当前 macOS / Node 26 本地验证覆盖 60 项 Node 测试与真实安装包流程，已从包内资源成功导出合成简历 PDF。Git 双设备同步使用本地 bare 仓库测试快进、未保存和分叉；GitHub 隐私／权限拒绝逻辑有测试，但尚未在真实私人仓库执行完整注册、建仓、恢复流程。macOS／Windows／Linux 的 Node 22 CI 已实际通过，包含每个平台 60 项测试与安装包验证；浏览器／PDF 不在这套 CI 矩阵内。

## 新样式演示与检查

```bash
npm run build
# 必须是尚不存在的目录；父目录需要已存在
node scripts/prepare-template-demo.mjs .cache/template-demo
node dist/cli.js resume preview --workspace .cache/template-demo --open
```

该脚本创建独立的合成演示：通用版带虚构插画头像、精简版不带头像。不会把示例头像写入用户内容包，也不会覆盖已有演示目录。样式列表由 `resume themes --json` 返回，Agent 仍按统一内容契约写作。新增样式的验收用例在 `tests/templates.test.mjs` 与 `tests/templates-browser.mjs`，验证边界见[验证说明](validation.md)。
