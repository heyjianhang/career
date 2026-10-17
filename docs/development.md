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
# 修改看板与岗位抽屉时：
npm run test:board
# 修改总体匹配、证据覆盖或分析版本校验时：
npm run test:match
# 修改打招呼稿读取、复制或 Agent 交接时：
npm run test:outreach
# 修改简历库、编辑与岗位关联时：
npm run test:resumes
# 修改个人资料阅读器时：
npm run test:profile
# 修改网页／项目链接时：
npm run test:links
# 修改简历排版模板时：
npm run test:templates
```

测试使用临时工作区，覆盖初始化、数据引用和冻结等行为。`tests/agent-cli.test.mjs` 通过子进程调用真实 CLI，覆盖能力发现、只读状态、JSON 错误、文件摘要、保存冲突／历史副本和带照片的保存到本地服务流程；测试不会扫描私人工作区。工作区操作从当前目录向上查找 career.json，开发时必须显式传 `--workspace <合成目录>`；不能假定开发仓库内存在默认私人工作区。

## 门户页面

公开入口源码位于 `site/`。`npm run preview:site` 构建并启动本机预览，`npm run build:site` 只输出批准的静态文件到 `build/site/`，无须加载私人工作区。桌面下载从 site/downloads.json 读取已公开的安装包地址，未发布的架构保持不可下载；备用开始指令从 README 提取；详细命令由根目录 install.md 维护，llms.txt 导航。scripts/bootstrap.mjs 校验短入口和安装版本。腾讯配置、域名接入和验收记录见[门户与托管](portal.md)。

## 浏览器扩展

源码在 browser-extension，`npm run build:extension` 通过白名单构建加载目录与 ZIP，不包含样例、采集历史或凭据；构建产物沿用 build 忽略规则。`npm run test:extension` 使用临时 Chromium 配置及合成岗位验收，不读取当前浏览器。业务测试随 npm test 运行。扩展版本独立于 npm 和桌面版，未加入其安装资源，详见[扩展使用与验证](browser-extension.md)。

## BOSS 采集 Skill

`.agents/skills/boss-zhipin-scraper/` 是随包的上游固定快照，来源和逐文件哈希在其 upstream.json；只调整 career 引导时不要顺手更改采集代码。上游 MIT LICENSE 必须随资源分发。构建不联网取上游代码，不包含浏览器资料、采集结果或 venv。

`tests/boss-skill.test.mjs` 检查新建／补装、自定义内容保护和固定资源；存在 Python 3.10+ 时从安装后目录执行离线帮助与合成摘要。可用 CAREER_TEST_PYTHON 指定测试解释器。`test:package` 从实际 tgz 再验相同运行资源。以上不访问 BOSS；真实采集需另做账号与页面验收。

## Agent 路线图

`npm run build:agent-roadmap` 从当前仓库 Markdown 和十三个用户 Skills 构建 `build/agent-roadmap/index.html`，浏览器直接打开即可离线阅读。页面源码与场景导航在 `docs/agent-roadmap/`，共同推进规则在 `docs/agent-workflow.md`，不在 HTML 里维护另一份 Skill 正文。更改方法后重新构建，使用 `npm run test:agent-roadmap` 验证导航、原文读取和窄屏。详见 [路线图维护](agent-roadmap.md)。

## 文件归属

- 访谈、母版写作、JD 匹配与平台填写方法：修改对应 `.agents/skills/<skill>/`。
- 求职任务模板：修改该 Skill 的 `templates/`，不要在根目录或 workspace 另建公共副本。
- 跨模块 ID、字段和更新关系：修改 `docs/data-model.md`，同步相关模板、脚本与合成示例。
- 成果页、主题、CLI 与本地预览：修改 `src/`；公共机器契约在 `schemas/`，实际平台字段规则仍在 resume-tailor Skill。详见 [成果页实现](presentation.md)。
- 初始化、v2 校验、摘要和冻结：底层工具在 `scripts/`；统一 Agent 命令与成品保存入口在 `src/agent-api.ts` / `src/cli.ts`。CLI 复用底层工具，避免维护两种工作区格式。单一 Skill 专用的新辅助脚本放该 Skill 内。
- 安装前引导由根目录 install.md 维护，安装后 career-setup 区分目录交接与工作区续接；个人 Git 建仓、提交与同步方法统一在 career-git，工作区 AGENTS 负责路由。
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
| `npm run build:site` | 门户缺少资源、指令版本不一致或包含非公开文件 |
| `npm run check:example` | 当前规则无法处理仓库中的合成资料 |
| `npm run test:package` | 打包漏资源，或实际安装后无法初始化、生成 HTML、保存版本 |

检查只读仓库代码，测试数据放在临时目录，不需要 npm 发布令牌或用户的 GitHub 登录。这里没有 PDF 浏览器矩阵或独立 Agent 行为评测；相关改动仍按上面的专项命令验证。

2026-10-13 的[首次通过的 CI](https://github.com/heyjianhang/career/actions/runs/38360490634)已在三种系统上成功运行。后续推送仍应核对对应提交的实际结果。npm 0.2.0 已单独发布并通过公开安装验证，见[发布记录](releases/0.2.0.md)。当前没有自动发布工作流，也不会随 main 更新自动上传 npm。

## 打包与发布

维护者先读 [career-release](../.agents/skills/career-release/SKILL.md)，按其中的版本清单和发布顺序操作。npm 发布分支验证后先发布并验证 npm，再合并 main 更新公网安装入口；桌面版本独立维护，门户下载信息从 site/downloads.json 生成。主分支保护的查询与推荐配置也在该 Skill 中。

```sh
npm test
npm run check:example
npm run test:package
npm pack
```

`test:package` 会从真实 tgz 安装到临时目录，再检查 setup／重试、十三个用户 Skills、`.gitignore`、HTML 生成及本地 Git 保存。缓存不完整时会从 npm registry 获取依赖或元数据，不能假定 npm ci 已预热全部安装元数据；临时资料均为合成内容，结束清理，不使用 GitHub。`.gitignore` 在包中使用 gitignore.template 文件名，安装时还原，避免 npm 丢弃忽略文件。

包采用 files 白名单；package.json 与资源构建脚本都只包含十三个用户 Skills。维护者 career-release、私人 workspace、构建示例、测试、研究截图和源码不进入 npm。合成内容包只留在开发仓库，测试时显式导入，不安装到用户目录；`test:package` 同时校验包内和用户工作区的 Skill 边界。实际归档清单、版本与发布回执按发布 Skill 核验。

2026-10-15 的 macOS / Node 26 本地验证覆盖 114 项 Node 测试与真实安装包流程，已从包内资源成功导出合成简历 PDF。Git 双设备同步使用本地 bare 仓库测试快进、安全合并、冲突保留、离线保存及自动同步时机；GitHub 隐私／权限拒绝逻辑有测试，但尚未在真实私人仓库执行完整注册、建仓、恢复流程。此前三平台 Node 22 CI 已通过 60 项测试；新提交的矩阵以对应 Actions 结果为准。浏览器／PDF 不在这套 CI 矩阵内。

## 新样式演示与检查

```bash
npm run build
# 必须是尚不存在的目录；父目录需要已存在
node scripts/prepare-template-demo.mjs .cache/template-demo
node dist/cli.js resume preview --workspace .cache/template-demo --open
```

该脚本创建独立的合成演示：通用版带虚构插画头像、精简版不带头像。不会把示例头像写入用户内容包，也不会覆盖已有演示目录。样式列表由 `resume themes --json` 返回，Agent 仍按统一内容契约写作。新增样式的验收用例在 `tests/templates.test.mjs` 与 `tests/templates-browser.mjs`，验证边界见[验证说明](validation.md)。

## 岗位模块（开发源码）

`src/opportunities/store.ts` 保留统一业务入口，`types.ts`、`validation.ts`、`files.ts`、`transactions.ts` 分别维护类型、Schema 校验、受限文件读写与事务恢复；`src/cli.ts` 暴露统一命令。外部输入先作为 `unknown` 校验，再进入业务层；修改 Schema 时同步类型中的必填／可选字段，保留旧记录与未知扩展字段。契约与交接规则见[岗位工作区](opportunities.md)。修改时运行 `tests/opportunities.test.mjs`，覆盖多 Agent 续接、冲突、依赖、坏记录、附件与恢复；完整测试与真实安装包仍按上面执行。src/board 提供本地看板和文件阅读器，复用简历服务及侧栏；tests/board-ui.test.mjs 覆盖读取、写回冲突和文件边界。PDF.js 资源由构建脚本复制到 dist/board/pdf，发布前验证安装包具备资源。

运行 npm run build，然后 node scripts/prepare-board-demo.mjs 创建源码仓库外的临时合成工作区，最后 node dist/cli.js board preview --workspace <脚本返回的目录> --open --json。也可向演示脚本传入仓库外尚不存在的绝对路径。

页面用合成岗位、两页 PDF 和示例图片验收；只在资料 Tab 展示文件树。`npm run test:board` 用独立合成工作区验证两层面试导航、可选准备和多次模拟、轮次添加／编辑、复制协作指令、阶段与结果／归档分离、键盘操作、抽屉调宽与重载记忆、慢请求返回、PDF／图片和 390px 窄屏；截图在 `.cache/board-review/`。源码外人工演示使用相同入口。

## 本机多工作区

工作区管理在 src/workspace/local.ts 与 local-api.ts；共享侧栏和设置在 presentation 的 render／shell／styles。每个目录绑定独立 localhost 服务，startPreview 的 close 会关闭同组会话。测试必须传入独立 registryFile 或 CAREER_LOCAL_SETTINGS，不能改开发者主目录的最近列表。行为和运行时恢复见[工作区说明](workspaces.md)。

修改共享侧栏时，验证看板、简历、个人资料在相同视口下的几何尺寸；导航样式只能在共享层维护，不要再增加页面专属间距。 页面顶栏共用 workspace-header；桌面基础高度 64px、控件 36px，展开侧栏使用 224–248px 的有界宽度。尺寸与水平留白统一维护在 src/presentation/styles.css 的 --shell-*／--sidebar-width 变量，页面样式只处理自身控件布局；窄窗口允许顶栏换行，不固定高度裁切内容。变更渲染代码后重启预览并刷新页面，避免旧 Node 模块与新读取的 CSS 混用。

## 桌面端

桌面壳在 desktop，构建脚本在 scripts/desktop；复用 src 文件层和 localhost 服务。`npm run desktop:dev` 启动，`npm run desktop:test` 用合成目录验证。构建矩阵、安装包输出、签名和版本规则见[桌面开发与构建](desktop.md)。新增桌面功能需要检查真正打包后的应用，不能仅验证开发 Electron；构建资源在 .cache 与 release 下，不提交这些产物。

云同步变更另外运行 `npm run test:sync`。tests/sync.test.mjs 用临时 bare 远端覆盖双设备更新／合并、冲突保留、离线保存、异常远端、恢复和自动同步时机；sync-browser 用模拟依赖状态检查界面、设置落盘与窄屏，不操作真实私人仓库。


## 桌面更新入口

更新服务在 desktop/updates.cjs；共享界面在 src/presentation/updates.ts 和 updates.css。构建时 copy-presentation-assets.mjs 将界面拼入各工作台共用 shell.js／styles.css；启动页通过受限 career-app 协议加载同一份界面。修改后先 npm run build，运行 tests/desktop-updates.test.mjs，再从本机打包应用执行 desktop:test。测试使用合成 Release 和独立 userData，不修改个人更新偏好。当前仅检查版本并打开官方安装包链接；发布流程或自动安装改造需另行验收。

## 模型与 JD 导入

`src/ai` 提供受限输入、结构化提取及本机校验；`desktop/ai.cjs` 管理加密连接和请求取消，`src/presentation/models.ts` 为统一设置页，`src/board/jd-import.ts` 为资料／核对两步流程。`opportunities/import.ts` 原子写入卡片、正文和原始附件。修改后运行 `npm run test:ai`，并从打包应用执行 `desktop:test`；真实供应商单独验收，不能用合成服务结果声称所有模型兼容。详细边界见 [设计说明](plans/ai-models-jd-import.md)。
