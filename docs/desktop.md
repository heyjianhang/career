# career 桌面版

桌面壳在 `desktop/`，复用现有看板、简历、资料页面和文件业务层。`0.3.0-alpha.1` 已作为未签名预览版公开，支持 macOS 与 Windows 的 ARM64／x64；下载、校验值与验收边界见[发布记录](releases/desktop-0.3.0-alpha.1.md)。公开 npm 仍为 0.2.0。

## 使用流程

1. 安装并启动 career，创建工作区：填写显示名称、选择保存位置。软件会在该位置新建同名普通文件夹；也可以打开已有 career 工作区。
2. 新工作区没有预置简历、岗位或演示文件；只具备空的资料结构、引导文档及工具。工作区已具备 AGENTS.md、八个用户 Skills、资料结构和 CLI 入口。点击「复制给 Agent」，在 Agent 软件中打开该文件夹并新建对话。
3. Agent 读取指引、检查状态，继续选择本地保存／私人仓库同步，然后收集经历或接着已有进度。无需重新安装 Node、npm 或 career 包。
4. 平时直接打开 career。设置里可以切换工作区、重命名显示名称，再次复制 Agent 指令；工作区菜单也可回到启动页。

启动页为居中的紧凑面板，只显示最近工作区与新建／打开入口。新建时单独显示名称和保存位置，创建完成后显示 Agent 引导，详细指令默认折叠；打开已有工作区直接进入工作台。首次进入桌面工作区默认展开侧栏；手动收起后在同一工作区页面间保留该选择，窄窗口自动收起。

macOS 使用应用／Dock 图标和自适应深浅色的单色菜单栏图标；Windows 使用多尺寸 ICO 覆盖安装、卸载、快捷方式和托盘。托盘可显示／隐藏窗口、回到工作区列表及退出。隐藏窗口保留当前编辑内容；关闭窗口仍退出程序，未保存简历会阻止关闭。Windows 隐藏原生菜单栏（Alt 也不展开），保留 Ctrl+Shift+O 打开工作区列表、Ctrl+加减／0 缩放和 F11 全屏；macOS 保留系统菜单。

桌面程序没有内置模型。用户选择自己的 Agent 客户端；支持项目 Skills 的客户端可以自动发现，其他客户端通过 AGENTS.md 读取。Git 和 GitHub CLI 仅在所选保存／同步流程需要时另外准备。

## 随包内容与工作区绑定

Electron 提供 Chromium 和 Node，安装包包含构建后的 CLI、锁文件对应的生产依赖、字体、PDF 阅读资源、Skills 和模板。创建工作区与简历 PDF 导出使用随包运行环境；首次使用无需再下载 Chromium。升级软件不会替换个人经历或简历，受管指引中有用户修改时保留原文。

每个工作区提供本机入口：

```sh
# macOS，在工作区目录运行
./.local/career doctor --json
./.local/career workspace status --json
```

```powershell
# Windows PowerShell，在工作区目录运行
& .\.local\career.cmd doctor --json
& .\.local\career.cmd workspace status --json
```

入口按自身位置绑定工作区，拒绝额外传入 `--workspace` 改写目标。切换桌面里的工作区不会改变已有 Agent 的目标；软件窗口关闭后 CLI 仍可运行。`.local` 属于本机配置、不进入 Git；换机、移动或重装软件后，在桌面里重新打开资料目录即可恢复入口。创建／恢复其他工作区应通过软件完成。

每个打开的目录使用独立的 127.0.0.1 服务与写入 token。渲染进程关闭 Node 集成、开启隔离和沙箱，只暴露选目录、工作区和剪贴板等明确操作；外部链接在系统浏览器打开。CLI 通过 Electron 的 Node 模式运行，打包时必须保留 `ELECTRON_RUN_AS_NODE` 能力。

## 本地开发

构建机器需要 Node.js 22+、npm 和网络访问官方依赖；使用者不需要这些环境。先运行：

```sh
npm ci --ignore-scripts
npm run desktop:dev
```

`desktop:dev` 首次下载已锁定版本的 Electron，组装 `.cache/desktop-app/` 后启动；生产依赖按 package-lock.json 安装。源码、个人资料、测试报告和开发依赖不进入应用运行资源。不要同时运行两个桌面构建命令，它们共用组装目录。

`npm run desktop:icons` 从同一「c.」字标重建 PNG、ICNS、ICO 与菜单栏模板图标；用实际字形边界计算整体中心，避免字体基线导致偏下。已生成资源随源码保存，正常构建直接使用这些文件，无需目标机器安装品牌字体。品牌字形调整建议在 macOS 上生成并检查后提交资源。

## 构建安装包

在目标操作系统上构建，架构由参数选择：

| 构建机器 | 命令 | 安装包 |
| --- | --- | --- |
| macOS | `npm run desktop:mac:arm64` | Apple Silicon DMG、ZIP |
| macOS | `npm run desktop:mac:x64` | Intel DMG、ZIP |
| Windows | `npm run desktop:win:x64` | x64 NSIS 安装程序 |
| Windows | `npm run desktop:win:arm64` | ARM64 NSIS 安装程序 |

通用入口支持在对应系统一次构建两种架构：

```sh
npm run desktop:build -- --platform mac --arch all
npm run desktop:build -- --platform win --arch all
# 只生成可运行应用目录，便于调试
npm run desktop:build -- --platform mac --arch arm64 --dir
```

产物在 `release/desktop/`，文件名含桌面版本、系统与架构；同目录生成 SHA-256 校验文件。该目录已 Git 忽略。Mac 安装时把 career.app 拖到应用程序；Windows 安装程序允许选择位置，并创建桌面和开始菜单快捷方式。移除软件不会删除用户自己的工作区目录。

[Desktop installers 工作流](../.github/workflows/desktop.yml)可在 GitHub Actions 手动触发，四个矩阵分别构建 macOS ARM64／x64、Windows x64／ARM64，然后把安装包作为 Actions artifact 保存 14 天。工作流不发布 npm、GitHub Release 或门户；需先将工作流合并到默认分支才能从 Actions 正常手动触发。

## 验证与发布

```sh
npm test
npm run check:docs
npm run desktop:test
# 验证真实打包应用（把路径换成生成的可执行文件）
npm run desktop:test -- --app "release/desktop/mac-arm64/career.app/Contents/MacOS/career"
# Windows 示例：release/desktop/win-unpacked/career.exe
```

桌面测试用独立合成目录，覆盖 CLI 在缺少系统 Node/npm 的 PATH 下执行、目录绑定、两个工作区隔离、随包 Skills、页面沙箱、Agent 交接、原生和 CLI 的 PDF 导出。证据和截图在 `.cache/desktop-test-*/`。CI 的四个任务使用 macOS ARM64／Intel、Windows ARM64／x64 原生 runner，通过 --app 检查刚构建出的应用并保留合成报告；不以开发 Electron 代替产物。安装器交互与系统拦截提示仍需人工安装验收，不能把构建成功当成已完成安装测试。

默认生成未签名预览包。当前 alpha.1 经维护者确认以未签名预览版发布，下载说明明确标注；正式版发布前应完成签名、公证及安装验收：macOS 使用 Developer ID Application 证书与 Apple 公证凭据，Windows 使用代码签名证书。不要把证书或口令提交进仓库。macOS 设置 `CAREER_DESKTOP_SIGN=1`，并通过 electron-builder 支持的 `CSC_LINK`／`CSC_KEY_PASSWORD` 和 `APPLE_API_KEY`／`APPLE_API_KEY_ID`／`APPLE_API_ISSUER` 环境变量提供凭据；签名构建应失败而非退回未签名产物。Windows 使用 `CSC_LINK`／`CSC_KEY_PASSWORD` 并同样开启签名要求。手动 CI 目前不注入签名凭据。未经验证与单独公开的 Actions 产物只用于测试；公开预览版以发布记录为准。

桌面版本以 desktop/package.json 为准，与 npm 包独立编号；发布时记录包含的核心源码版本。已公开的 alpha.1 没有应用内更新检查。当前开发源码增加版本检查和安装包下载入口，尚未发布；不含自动安装、重启升级或开机启动。开发源码已接入企查查，招聘平台 CLI 尚未内置。软件升级采用下载安装包覆盖升级，资料继续保存在原文件夹。

## 转存已验证的安装包

[Desktop release assets](../.github/workflows/desktop-release.yml) 是发布辅助任务，与打包任务分开。它接收成功的 Desktop installers run ID、准确源码 SHA、桌面预发布 tag 和模式。先确认四种架构的打包任务均成功，并创建指向同一 SHA 的 GitHub Release 草稿。

- `stage-draft`：检查构建来源、四份原生运行报告及安装包校验值，直接把该次构建的四个安装包和 SHA256SUMS.txt 转存到草稿，再检查远端文件大小和 SHA-256。不会重新打包、发布 Release 或创建 tag。
- `verify-public`：维护者按授权公开预发布后，匿名完整下载四个地址并核对 SHA-256；不把 GitHub token 传给下载请求。验证通过才更新门户的 downloads.json。

两种模式都保留 verification.json 证据。只接受本仓库 main 的成功桌面构建，且 Release 的目标 SHA 必须与产物一致；校验失败立即停止，不能把旧包或上一轮报告混入发布。公网发布仍由维护者按本轮授权单独执行；这条流程不发布 npm。

## 企查查连接

工作区页面「设置 → 外部服务 → 企查查」支持填写 API Key、保存并测试、测试已存连接与移除。保存前调用官方 company 服务的 tools/list；失败保留原连接。企业查询可能消耗企查查积分，测试连接不调用业务工具。官方说明：<https://agent.qcc.com/guide>。

API Key 通过 Electron safeStorage 加密，密文保存于本机 userData/integrations/qcc.json，权限 0600；不进入工作区、Git、导出或安装资源。macOS 使用系统钥匙串、Windows 使用系统加密；系统安全存储不可用时拒绝保存，不降级明文。移除只清除本机连接，不撤销企查查账号的 Key；换机需重新配置。

桌面绑定 CLI 使用 company status/check/search/inspect/tools，精确参数以 --help 为准。runner 通过独立临时目录与无窗口 Electron helper 交换有大小限制的请求／结果，结束或失败后清理；不依赖 Windows GUI 进程的标准输入输出。runner 启动 helper，由 helper 解锁凭据并调用官方固定 HTTPS 地址；Key 不传给 Agent 或 Node 模式 runner，不进入临时交换文件或进程参数。应用主窗口关闭后仍可运行，无需系统 Node/npm。npm 版 CLI 使用 QCC_API_KEY 环境变量，不读取桌面密文，也不提供明文保存命令。

连接器在 src/integrations/qcc.ts，桌面凭据与桥接在 desktop/company*.cjs。只支持 company 域中列出的查询；不声称覆盖风险／司法／招聘平台。结果保留查询时间、来源和上游正文，Agent 按 career-board 的 references/company.md 衔接已有分析与附件能力。网络失败不自动重试。

测试使用合成凭据和模拟服务响应；npm test 覆盖流式／JSON、认证、额度、限流、超时、协议异常、凭据加密与失败换 Key 保留旧连接。npm run test:company 验证设置页保存／失败换 Key／移除与 320–1180px 布局；desktop:test 验证真实 Electron safeStorage、设置页面和随包 CLI；不会使用开发者的真实账号或工作区。

Windows 构建在当前锁定的 electron-builder 26.15.3 中默认使用 BCJ 压缩过滤器，避免 ARM64 过滤器与 NSIS 解码器不兼容；可通过 ELECTRON_BUILDER_7Z_FILTER 显式覆盖。来源：[上游问题 #9983](https://github.com/electron-userland/electron-builder/issues/9983)。

## 关于与更新（当前开发源码）

[实施与验收记录](plans/desktop-updates.md)。

工作台左下角「设置 → 关于与更新」与启动页「关于与更新」共用一个界面，显示桌面版本、系统／架构、上次检查、更新说明与下载入口。有新版本时设置按钮显示圆点，点击直接进入更新页；同一新版本自动轻提示只显示一次，「稍后」关闭提示但保留圆点。编辑未保存、输入中或对话框打开时延后轻提示。浏览器预览及离线导出不显示桌面更新入口。

默认启动 15 秒后检查，上次成功检查不足 6 小时则跳过；运行期间每 6 小时检查。自动检查可关闭，手动检查仍可使用。预览构建默认接收预览版，正式构建默认仅正式版，可在此切换。关闭预览版后仅选择更新的正式版，不降级到更早版本。

desktop/updates.cjs 使用 GitHub 官方 API 匿名读取本仓库最近 100 个公开 Release，过滤 desktop-v 标签、草稿、渠道和版本，精确匹配当前系统／架构的已上传 DMG／EXE；没有该架构安装包的版本不显示为可下载更新。请求设置超时和大小上限；失败不会把已知更新清除，也不声称已是最新版。更新说明按纯文本显示，不执行远程 HTML。连接沿用 Electron 网络设置，不发送工作区内容、账号或 API Key。

自动检查、预览渠道、缓存及已提示版本保存在本机 Electron userData/updates.json，不进入求职工作区、Git 或安装资源。IPC 只接受主窗口，并由主进程选择官方固定仓库的下载链接；页面不能提供任意下载地址。

「下载安装包」在系统浏览器打开对应架构的公开安装包链接，不显示虚假的下载进度，不自动执行或重启。下载后由用户退出应用并运行安装包覆盖升级。当前尚未实现签名／公证、更新元数据及自动安装链路；此前安装包需手动升级到包含此功能的新版本，才会出现上述入口。

离线回归：node --test tests/desktop-updates.test.mjs 覆盖版本、四架构、渠道、失败／并发、持久化和通知；desktop:test 在合成工作区验证真实包的启动页、工作台、更新设置保存与原生事件传递，不下载或安装外部软件。
