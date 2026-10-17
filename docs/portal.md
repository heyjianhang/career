# 门户页面与托管

门户以桌面安装包为主要入口：下载安装、创建个人工作区，再连接自己的 Agent。npm CLI 的复制指令保留在折叠的「通过 Agent 安装」中。页面不收集履历，不连接个人资料目录，也不提供在线 Agent 会话。

## 本地开发

```sh
npm run preview:site
```

终端输出仅本机访问的首页与 `/admin/` 地址。预览服务同时提供真实 API 和本地文件存储，重启后数据仍在 `.cache/portal/data`；默认没有模拟数据。首次启动生成本机管理凭据 `.cache/portal/admin-key.json`，取 `key` 字段登录，不要发送到聊天或提交 Git。静态页面源码在 [site](../site/)，构建脚本在 [scripts/build-site.mjs](../scripts/build-site.mjs)。网页用原生 HTML、CSS 和 JavaScript，没有额外运行依赖；构建只需 Node 22+，不需要安装简历 CLI 的依赖。

开始指令在构建时从 README 的第一个 text 代码块读取，始终指向 GitHub raw 的 `main/install.md`。详细命令集中在根目录 install.md，llms.txt 负责导航；两者与门户托管无关，门户也附带相同文件的静态副本。scripts/bootstrap.mjs 核对固定地址、详细命令中的包名与版本；README、安装说明、独立复制页的短指令保持一致。

安装指南先确认保存位置，默认创建 career-workspace；初始化并验证后，引导用户在 Agent 软件中打开此目录、新建对话并发送本地开始指令。0.2.0 的 CLI 已支持安装，交接由指南指导 Agent 完成；开发版 handoff 输出将在后续 npm 发布后生效。公网文件已随提交 0a14646 推送到 GitHub main，两份固定 raw 地址均返回 HTTP 200，内容与本地一致。以后更新仍须核对实际公网响应，不能只依赖本地构建成功。

```sh
node scripts/build-site.mjs
```

静态产物固定为 `build/site/` 的十三个公开文件：index.html、style.css、app.js、favicon.svg、404.html、robots.txt、install.md、llms.txt、两张合成产品截图，以及 admin 的 HTML／CSS／JS。构建采用明确文件清单；静态托管只能上传该目录，不能把仓库根目录当成公开目录。服务端源码由 EdgeOne 的 Git 构建流程单独打包部署，不属于公开静态产物。门户、后台与本机管理凭据均不在 npm 的 files 白名单内。

## 桌面下载入口

首页只展示并排的 macOS（苹果图标）和 Windows 下载入口，点击后下拉选择架构；菜单支持键盘、Esc、点击外部关闭，未发布架构在菜单内标为准备中。图标使用随仓库依赖的 Bootstrap Icons，MIT 声明保留在 HTML 中。

静态下载快照读取 [site/downloads.json](../site/downloads.json)。页面打开后请求同域 `/api/downloads`，管理后台已发布版本优先；接口不可用、未配置或浏览器禁用脚本时仍可下载静态快照中的版本。两条路径都不读取 npm 版本，也不会根据 desktop/package.json 的本地候选版本猜测下载地址。`version`、`tag` 描述已公开的桌面 Release；四个 assets 分别对应 mac-arm64、mac-x64、win-x64、win-arm64，填写该 Release 中已验证的完整 GitHub 下载 URL。未发布的架构保留 null。

全部地址为空时，版本和 tag 也保持 null；页面显示「预览版准备中」，按钮不可下载，发布进度链接指向仓库 Releases。某个架构已发布后，对应按钮才启用；可以分平台开放，不要求四个产物同时可用。alpha/beta 等版本明确标为预览版。门户版本独立于 npm 0.2.0，旧命令行入口仍指向实际已发布的 npm 版本。

维护静态快照的顺序（后台上线前也使用此流程）：

1. 按桌面发布流程构建、安装验收并公开 GitHub Release，记录源码 SHA、版本和 SHA-256。
2. 确认 Release 不是草稿，匿名访问下载 URL 成功；核对文件名、系统、架构和校验值。Actions 的临时 artifact 不作为公众下载地址。
3. 将真实版本、标签与 URL 写入 downloads.json，运行 `node --test tests/portal.test.mjs`、`npm run build:site` 和 `npm run check:docs`。
4. 在本机预览检查启用的下载链接、未发布架构、窄屏及备用复制入口；按授权提交／部署，再核对线上链接。

`scripts/site-downloads.mjs` 校验官方仓库、Release 标签、文件版本和架构；构建只输出链接，不把 JSON、本地安装包或凭据复制到门户。无需让访客浏览器调用 GitHub API，页面不受匿名 API 限额影响。当前已公开 desktop-v0.3.0-alpha.13，四种架构的匿名完整下载和 SHA-256 均已验证；[发布记录](releases/desktop-0.3.0-alpha.13.md)包含安装包来源和验收边界。门户本次部署状态见下方生产记录。

## 腾讯 EdgeOne Pages / Makers

腾讯的部分入口已将 Pages 命名为 Makers。首页可独立静态托管；管理后台使用同项目的 Node Cloud Functions 与 Blob 对象存储，部署配置详见下节。无需维护常驻服务器。

在腾讯云控制台导入 `heyjianhang/career` 的 main 分支，仓库根目录选择 `/`，框架选择其他／静态站。根目录 [edgeone.json](../edgeone.json) 配置：

| 项目 | 值 |
| --- | --- |
| 安装命令 | `npm ci --prefix portal --ignore-scripts --no-audit --no-fund`（仅安装门户 SDK） |
| 构建命令 | `node scripts/build-site.mjs` |
| 输出目录 | `build/site` |
| Node.js | `22.11.0` |
| 加速区域 | 全球可用区（不含中国大陆） |

`heyjianhang.top` 未备案，因此使用不含中国大陆的区域。该选项分配境外边缘节点，不代表固定部署到一台香港服务器。具体区域与套餐以控制台确认为准。

部署后在域名管理中添加 `career.heyjianhang.top`。根据控制台实际返回的记录，在 DNSPod 添加域名归属验证记录及主机记录 `career` 的 CNAME；CNAME 的目标由本次项目生成，不使用示例值。已有记录先检查，不能覆盖其他业务。申请 HTTPS 证书，等待域名和证书生效后，从自定义域名验收页面、复制按钮与资源加载。

绑定仓库后，生产分支更新可以触发重新构建。公开 npm 包的发布仍为独立步骤；发布前核对门户命令指定版本已在 registry 可安装。只部署静态产物即可展示 portal，不需要 npm token。

## 生产部署记录

2026-10-18 01:21，使用管理 CLI 保存 alpha.13 草稿并切换门户版本。服务端独立验证四个公开附件后返回成功，公开入口回查 publicFeedConfirmed:true；当前 revision 为 `b0758180c2d8411cb510c17046c14adc`。本机的额外匿名 GitHub 查询曾限流；[CI 匿名完整下载](https://github.com/heyjianhang/career/actions/runs/39053230622)与服务端发布验证均通过。静态回退清单已同步，等待这次部署回执。

2026-10-18 00:17 门户后台已通过真实云端验收，生产部署 `dpv68cdrtuyh`，源码 `b2810022bd30bf33ade9ed9649a00f6f3a446ebc`，构建用时 49 秒。此前 KV 审批阻塞已通过项目 Blob 存储解决。

- `career-portal-production` 已由 SDK 创建并出现在腾讯云 Blob 控制台；生产 API 已改为 Node Cloud Functions，同域入口保持不变。管理员使用现有密码成功登录，刷新页面能恢复会话。
- 真实官网访问、一次下载点击及架构／版本分布已写入存储，7／30 天汇总与刷新后保留通过；验收时显示 2 次访问、1 个浏览器访客、1 次 macOS Apple Silicon 下载点击，没有注入模拟统计。浏览器下载被客户端拦截，因此该点击不代表安装包下载完成。
- 现有 `0.3.0-alpha.1` 四架构版本保存后重开仍保留，随后从后台验证公开 Release 和四个安装包匿名范围下载并设为首页版本。公开 `/api/downloads` 返回 `source:managed`、`tracking:true`，四个文件的大小与 GitHub 摘要均与[原发布记录](releases/desktop-0.3.0-alpha.1.md)一致；本次没有重新打包或安装。
- 修复 EdgeOne 请求体兼容：支持边缘 ArrayBuffer、标准 Web 流、Node 流及 Node 运行时按 Content-Type 预解析的对象／预加载 Promise；保留 24,000 字节限额。密码与签名显式使用 Node 原生加密；故障日志只记录阶段、错误类型和受限错误码，不记录请求内容、密码或会话。
- 最终 28 项门户 API 测试、320／390／768／1024／1440px 浏览器回归、文档与十三文件静态白名单构建通过。151 项完整基础回归与[三平台 CI](https://github.com/heyjianhang/career/actions/runs/39048745698)全部通过。
- main 推送仍需在控制台手动触发部署。后台发布仅维护门户下载版本，安装包与 npm 版本没有随这次门户部署改变。生产／预览命名空间分开，预览不配置生产管理凭据。

2026-10-17 23:38 自定义管理密码支持已部署，生产部署 `dp6shahkchfq`，源码 `abdcb88bc43062ba88246bf26c342a95577e4085`，构建用时 24 秒。

- 维护者已更新两个生产凭据变量，逐项核对与本机准备配置一致；服务端保存带盐密码摘要，当前本机配置不保存自定义密码明文。原有生成式密钥仍兼容。
- 142 项隔离基础测试、19 项门户测试、320–1440px 浏览器登录／管理回归、文档与静态构建通过；[三平台 CI](https://github.com/heyjianhang/career/actions/runs/39045329244) 全部通过。
- KV 服务仍为“审批中”，尚不能完成云端登录验收。首页下载正常，管理 API 继续返回 503；不把凭据已部署等同于后台已经可用。

2026-10-17 首页与管理后台代码已部署：[career.heyjianhang.top](https://career.heyjianhang.top/)，后台入口 [/admin/](https://career.heyjianhang.top/admin/)。

- 生产部署 `dpj7al6z4oj6`，构建用时 22 秒，源码 `f24a46f25318c7120af358420e417bcdde02af0a`；控制台显示成功，Edge Functions 编译成功。仍需手动从 main 新建部署，本次推送没有自动触发。
- 自定义域名首页与本次干净候选构建逐字节一致；后台资源返回 200，带 noindex 和 CSP；`/api/downloads` 返回 200 与 alpha.1 四架构快照。错误来源写入返回 403，服务端源码与凭据路径返回 404。
- 四个安装包匿名范围下载均返回 206 与正确文件大小；本次只验证可下载性，没有重新安装／全量计算哈希。GitHub 匿名元数据接口当前限流，真实后台发布链路仍须在存储开通后复验。
- 已设置生产环境的 `PORTAL_ADMIN_KEY_HASH`、`PORTAL_SESSION_SECRET`、`PORTAL_ORIGIN`；登录凭据只保留在本机 `.cache/portal-production/admin-key.json`，不提交、不上传静态目录。
- KV 服务申请仍在审批中，尚未绑定 `CAREER_PORTAL`。首页保持可下载，统计关闭，管理 API 明确返回 503。审核后继续绑定并完成云端验收，不应将本次部署等同于后台已完全可用。
- 隔离候选的 140 项基础测试（含 17 项门户测试）、320–1440px 浏览器检查、文档检查和公开文件白名单构建通过；远程 CI 见[本次检查](https://github.com/heyjianhang/career/actions/runs/39044334232)。

2026-10-15 桌面下载门户已上线：[career.heyjianhang.top](https://career.heyjianhang.top/)。

- 生产部署 `dplukz44o1uq`，从 main 的 `13a3c223965bea2217de4abc2613b9438b5ed6f6` 手动发起，22 秒构建部署成功；仍使用全球可用区（不含中国大陆）。
- macOS／Windows 两个下载入口下拉选择 ARM64／x64，展示 `0.3.0-alpha.1 · 预览版`。四个安装包匿名完整下载校验通过，见[发布记录](releases/desktop-0.3.0-alpha.1.md)。
- 自定义域名 HTTPS 页面与本地构建 index.html 逐字节一致；四个下载 URL、架构菜单、窄屏布局与备用 Agent 安装入口已检查。安装包未签名，发布说明明确限制；npm 仍为 0.2.0。
- 推送自动部署本次未触发，采用控制台「新建部署」选择最新 main。后续发版需核对实际线上版本，不能以 push 成功代替门户已更新。

2026-10-13 门户已上线：[career.heyjianhang.top](https://career.heyjianhang.top/)。

- 腾讯项目：career（makers-od1hhnbtxjpx）；生产部署 dp5vuzqo1c7p，状态成功。
- 源码：[PR #1](https://github.com/heyjianhang/career/pull/1)，main 提交 517a18d；修复提交三平台 CI 通过。
- DNSPod：主机记录 career，类型 CNAME，默认线路，记录值 career.heyjianhang.top.pages.dnsoe4.com，TTL 保持默认。
- 腾讯域名管理显示“已生效”，HTTPS 显示“已部署”；实际 HTTPS 页面和开始指令复制已验收。
- 首次部署 dpkptbf2lv3z 因远端提交缺少 scripts/build-site.mjs 失败，补齐门户源码后已恢复。本次从控制台新建 main 部署完成，尚未单独验证后续推送自动触发。

部署成功不代表 npm 版本更新；本次仅发布门户，npm 仍为 0.2.0。

## 其他静态托管

同一份 `build/site/` 可部署到其他静态站服务，首页与快照下载可正常使用。统计和后台需要部署兼容 API；仅上传静态文件不会自动获得管理服务。当前针对腾讯准备适配，未为其他服务创建部署或收费资源。

## 管理后台（2026-10-17）

入口为 `/admin/`，普通官网导航不展示管理入口。包含近 7／30 天访问、独立访客估算、每日趋势、下载点击、架构／版本／来源分布，以及版本草稿编辑和首页版本切换。首次打开没有数据时显示真实空状态。

### 云端一次性配置

1. 使用现有项目的 Blob 对象存储，无需等待 KV 审批、手动绑定命名空间或另填存储 Key。官方 SDK 首次写入自动创建命名空间；生产使用 `career-portal-production`，预览使用 `career-portal-preview`。仅在生产范围配置下述正式 `PORTAL_ORIGIN` 与管理凭据，避免预览写入生产数据。部署安装命令从独立 `portal/package-lock.json` 安装固定版本 SDK，不安装简历 CLI 依赖。
2. 本机运行 `npm run portal:config`，生成 `.cache/portal-production/admin-key.json`（权限 0600，重复运行不轮换）。将 `PORTAL_ADMIN_KEY_HASH` 和 `PORTAL_SESSION_SECRET` 两个字段作为服务端环境变量设置；`key` 是本人的登录密钥，不能放在前端或 URL 中。自定义密码可通过标准输入运行 `npm run portal:config -- --password-stdin`（12–128 个字符，不要把密码写入命令行参数或脚本）。该选项重新生成带随机盐的密码摘要并轮换会话密钥；本机仅保存两个服务端字段，不保存自定义密码。更新两个云端变量后重新部署，旧会话即失效。
3. 生产环境设置 `PORTAL_ORIGIN=https://career.heyjianhang.top`。预览环境使用自己的域名或不设置，由请求 URL 确定同源检查。全程 HTTPS。
4. 经授权提交和部署根目录的 `cloud-functions`、`portal`、`site`、构建脚本与 edgeone.json。Git 构建应同时生成静态资源和 `/api/*` 函数；仅上传 build/site 不会部署后台。生产凭据文件和本地数据不部署。
5. 验收无登录访问后台 API 返回 401、错误来源写入返回 403；登录后空统计可加载。真实访问一次首页、点击一次安装包，在后台核对数据与架构。退出并重启后核对会话和版本持久化；匿名读取 `/api/downloads` 不含密钥。完成一次真实公开 Release 的验证和切换后，才标记云端验收通过。

服务端实现位于 [portal/server.mjs](../portal/server.mjs)，对象存储适配位于 [portal/blob.mjs](../portal/blob.mjs)，平台入口位于 [cloud-functions/api/[[path]].js](../cloud-functions/api/[[path]].js)。SDK 仅在函数服务端使用，沿用平台部署身份；不向浏览器发放存储凭据。后端使用标准 Node 云函数执行密码派生，避免边缘运行时密码校验兼容问题；保留 PBKDF2 600,000 次校验与已有密码摘要。管理登录支持自定义密码（随机 128 位盐、PBKDF2-SHA256 600,000 次迭代），兼容已有高熵随机密钥的 SHA-256 摘要。使用 8 小时 HttpOnly／SameSite Cookie 会话、HMAC 签名、同源及 CSRF 校验；轮换会话密钥可撤销旧会话。不提供注册或多管理员；低于 12 个字符的密码不接受，普通密码不能沿用直接 SHA-256 摘要。高流量部署还应使用托管平台的请求限速，公开统计并非防刷计费依据。

### 版本操作

- 新建版本，勾选已上传的架构，填写更新说明，保存草稿。地址按官方仓库命名约定生成；生成地址不等于安装包已存在。
- 完成各架构安装验收后，点击「设为首页版本」。确认后服务端查询公开 Release 元数据，并对每个安装包做匿名范围请求；失败、限流、草稿、缺文件或草稿版本变化时保留当前入口。
- 成功后保存发布快照和前后版本记录，再更新首页指向。可选旧版本再次验证和发布，回退下载入口；修改已发布版本的草稿不影响其快照。
- 这是单维护者后台。Blob 读取与列表显式使用强一致模式，写入后立即读取最新值；但它不提供数据库级并发事务或条件写锁。草稿修订检查可防常规陈旧覆盖，不要同时在多个会话发布。
- 后台发布只影响门户运行时入口；不替用户构建、签名、上传 GitHub Release、更新 npm 或应用内检查源。发布后仍应维护 downloads.json 作为无脚本与故障回退快照，再按正常流程提交部署。当前静态快照为 alpha.13，后续更新仍需同步维护。

### 管理 CLI（维护者与 Agent）

在开发仓库中使用 Node.js 22+，无需额外安装依赖。CLI 复用线上后台 API，与网页共用草稿、统计和发布记录；不需要腾讯云账号、存储密钥或浏览器 Cookie。管理命令和会话不进入用户安装包。

```sh
npm run portal -- login
npm run --silent portal -- status --json
npm run --silent portal -- current --json
npm run --silent portal -- stats --days 30 --json
npm run --silent portal -- release list --json
npm run portal -- --help
```

`login` 在终端隐藏密码输入，使用与 `/admin/` 相同的管理密码。非交互环境支持 `login --password-stdin`，只由可信凭据工具通过标准输入传入；不要把明文密码放在命令参数、`echo`、Shell 历史、脚本、Skill 或工作区文件中。Agent 日常只需调用 `status`，已登录时复用会话，失效时请维护者重新登录。

默认服务为 `https://career.heyjianhang.top`，可用 `--origin <HTTPS 源地址>` 指定其他部署；只允许本机 `localhost`／回环地址使用 HTTP。会话按 origin 隔离，请求不跟随重定向，避免将凭据转发到其他地址。

登录只保存有效期 8 小时的会话令牌，不保存密码或服务端会话密钥。macOS／Linux 位于 `~/.config/career-portal/`，目录／文件权限为 0700／0600；Windows 位于当前用户 `%LOCALAPPDATA%/career-portal/`，依赖用户目录 ACL。可用 `CAREER_PORTAL_CONFIG_DIR` 指定本机专用目录，不能指向 Git 仓库或共享目录。`logout` 删除本机会话；网络失败时仍会清除，并返回错误而非假报服务端退出成功。当前签名会话没有逐令牌撤销功能，已复制的令牌需等待过期，或由维护者轮换服务端会话密钥使全部旧会话失效。

版本操作使用 [downloads.json](../site/downloads.json) 同样的清单格式：`version`、`tag`、四个架构的 `assets`。只填写此次实际已上传且完成验收的架构，其余值为 `null`。准备单独候选 JSON 与简短 Markdown 发布说明，先保存草稿，不必提前更改静态首页版本。

```sh
# 使用实际文件路径；保存返回 id 和 revision
npm run --silent portal -- release save --manifest <候选清单.json> --notes-file <发布说明.md> --json
npm run --silent portal -- release show --id <草稿ID> --json
# 修改已有草稿时必须带上读取到的修订号
npm run --silent portal -- release save --manifest <候选清单.json> --notes-file <发布说明.md> --id <草稿ID> --revision <草稿修订号> --json
# 只读检查公开 Release 及匿名下载；不代表真实安装验收
npm run --silent portal -- release verify --id <草稿ID> --revision <草稿修订号> --json
npm run --silent portal -- current --json
# 已获发布授权且所选安装包验收完成后，使用上一步实际读取的首页 revision
npm run --silent portal -- release publish --id <草稿ID> --revision <草稿修订号> --current-revision <首页修订号> --acceptance-confirmed --json
npm run portal -- logout
```

所有命令输出 JSON；成功写标准输出，失败写标准错误并返回非零退出码。`--json` 输出单行，`npm run --silent` 去掉 npm 自身提示，便于 Agent 读取。版本 ID 与修订号必须使用真实响应值，不能猜测；第一次使用静态回退时首页 revision 为 `baseline`。发布在服务端重新验证，并回查公开 `/api/downloads` 的 ID、修订号和清单一致后才返回 `publicFeedConfirmed:true`。

错误码 `CONFLICT` 表示内容已变更，应重新查看；`RESULT_UNKNOWN` 或 `PUBLISH_NOT_CONFIRMED` 表示写入结果或公开入口尚未确认，先查看 `release list`／`current`，不要自动重复发布。HTTP／鉴权失败不返回成功。下载验证结果的 `installed:not-checked` 明确表示仍需安装验收。

此 CLI 管理门户下载入口与统计；构建、签名、上传／公开 GitHub Release、npm 发版仍使用原有工具。发布后维护静态 `site/downloads.json` 并部署回退快照。具体 Agent 工作顺序见 [career-release](../.agents/skills/career-release/SKILL.md) 与[门户 CLI 指引](../.agents/skills/career-release/references/portal-cli.md)。

离线合成验收：`node --test tests/portal-cli.test.mjs`。测试启动临时本机后台，真实子进程验证登录、跨命令会话、草稿冲突、发布回查、失败保护及退出；GitHub 响应为明确的合成数据，不修改生产版本。

### 统计口径和容量

- 页面访问：官网首页加载且同源 API 可用、浏览器允许统计时记一次；不会采集后台访问。
- 访客：随机浏览器标识，30 天轮换；清理存储、换浏览器会被视作新访客，不等于人数。服务端只保存其摘要。
- 下载点击：前端发出的点击事件，安装包链接直接指向 GitHub。即使统计接口失败仍可以下载；不是成功下载、安装或活跃用户数。
- 只保存时间（日）、类型、架构、版本和粗粒度来源分类；不保存 IP、完整来源 URL、简历或岗位资料。用户可在官网页脚关闭，DNT／GPC 信号也会关闭统计。
- 每个事件独立写入，重试复用 ID，避免并发计数覆盖。当前统计面向小规模门户，按日翻页，单日最多读取 1,024 条；达到限制明确提示数据不完整，不把部分结果当完整总量。版本草稿最多 100 条，可复用旧草稿。
- 当前事件持续保留在专用 Blob 命名空间，无自动过期策略。Blob 控制台仅支持浏览；清理历史数据须通过 SDK 执行并明确授权删除范围。增长到上述范围前迁移到聚合或分析数据库，不能直接增加前端展示数字掩盖容量限制。

### 本地验证与上线边界

```sh
npm run test:portal
npm run build:site
npm run check:docs
```

API 测试覆盖鉴权、会话过期、CSRF、重复事件、并发写入、分页、时区、草稿持久化、公开安装包验证失败保护、版本快照和静态回退。浏览器使用独立临时存储与明确的合成 GitHub 响应，不查询／发布真实新版本；覆盖 320–1440px、登录、保存、失败后重试、首页切换、统计关闭和无脚本下载。截图留在 `.cache/portal-review`，不对外发布。

原有 KV 方案因账号审批未完成而阻塞；现改用项目 Blob 和 Node 云函数。云端真实验收与部署回执记录在上方生产部署记录中，未取得回执前不把本地测试视为上线成功。存储不可用时公开下载仍返回静态快照和 `tracking:false`，管理登录不产生假成功；密码缺失与存储故障分别提示。SDK 原始错误可能带有签名请求信息，因此只返回脱敏的业务错误。

Cloud Functions 请求体格式以官方 `@edgeone/types@1.0.2` 的 `EdgeoneRequest` 定义核对：body 会按 Content-Type 预解析，预加载完成前可为 Promise；不能假定总是标准 ReadableStream。

依据腾讯官方 [Blob 文档](https://pages.edgeone.ai/zh/document/blob-storage)、[Node 云函数](https://pages.edgeone.ai/zh/document/node-functions)、[Web Crypto API](https://edgeone.ai/document/52693)（2026-10-17 核对）。固定 SDK `@edgeone/pages-blob@0.0.18` 的类型和实现支持 `limit`；适配使用每页 256 条、关闭自动全量翻页，保留 `cursor` 并映射 `blobs[].key`，避免统计超过读取预算。SDK 依赖与锁文件位于 portal，门户私有包不发布 npm。

## 验收与来源

2026-10-13 本地浏览器检查：1440、1024、768、390 像素宽度无横向溢出；复制内容与 README 一致；剪贴板被拒绝时选择完整文本并提示快捷键；截图切换、放大与 Escape 返回正常；FAQ 可展开；无 JavaScript 页面错误。预览服务请求 `.git/config`、`workspace/career.json` 均返回 404。截图是项目已有的合成演示，来源见[素材说明](assets/README.md)。

腾讯官方资料（核对于 2026-10-13）：[区域与域名](https://edgeone.cloud.tencent.com/pages/document/175191784523485184)、[项目管理](https://cloud.tencent.com/document/product/1552/127388)、[构建配置](https://cloud.tencent.com/document/product/1552/127389)、[自定义域名](https://pages.edgeone.ai/document/custom-domain)。
