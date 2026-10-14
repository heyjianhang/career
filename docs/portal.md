# 门户页面与托管

门户以桌面安装包为主要入口：下载安装、创建个人工作区，再连接自己的 Agent。npm CLI 的复制指令保留在折叠的「通过 Agent 安装」中。页面不收集履历，不连接个人资料目录，也不提供在线 Agent 会话。

## 本地开发

```sh
npm run preview:site
```

终端输出仅本机访问的 Local URL。静态页面源码在 [site](../site/)，构建脚本在 [scripts/build-site.mjs](../scripts/build-site.mjs)。网页用原生 HTML、CSS 和 JavaScript，没有额外运行依赖；构建只需 Node 22+，不需要安装简历 CLI 的依赖。

开始指令在构建时从 README 的第一个 text 代码块读取，始终指向 GitHub raw 的 `main/install.md`。详细命令集中在根目录 install.md，llms.txt 负责导航；两者与门户托管无关，门户也附带相同文件的静态副本。scripts/bootstrap.mjs 核对固定地址、详细命令中的包名与版本；README、安装说明、独立复制页的短指令保持一致。

安装指南先确认保存位置，默认创建 career-workspace；初始化并验证后，引导用户在 Agent 软件中打开此目录、新建对话并发送本地开始指令。0.2.0 的 CLI 已支持安装，交接由指南指导 Agent 完成；开发版 handoff 输出将在后续 npm 发布后生效。公网文件已随提交 0a14646 推送到 GitHub main，两份固定 raw 地址均返回 HTTP 200，内容与本地一致。以后更新仍须核对实际公网响应，不能只依赖本地构建成功。

```sh
node scripts/build-site.mjs
```

产物固定为 `build/site/` 的十个公开文件：index.html、style.css、app.js、favicon.svg、404.html、robots.txt、install.md、llms.txt，以及两张合成产品截图。构建采用明确文件清单；只把该目录交给托管服务，不能上传仓库根目录、个人 workspace 或本机配置。门户不在 npm 的 files 白名单内。

## 桌面下载入口

首页只展示并排的 macOS（苹果图标）和 Windows 下载入口，点击后下拉选择架构；菜单支持键盘、Esc、点击外部关闭，未发布架构在菜单内标为准备中。图标使用随仓库依赖的 Bootstrap Icons，MIT 声明保留在 HTML 中。

下载入口只读取 [site/downloads.json](../site/downloads.json)，不读取 npm 版本，也不会根据 desktop/package.json 的本地候选版本猜测下载地址。`version`、`tag` 描述已公开的桌面 Release；四个 assets 分别对应 mac-arm64、mac-x64、win-x64、win-arm64，填写该 Release 中已验证的完整 GitHub 下载 URL。未发布的架构保留 null。

全部地址为空时，版本和 tag 也保持 null；页面显示「预览版准备中」，按钮不可下载，发布进度链接指向仓库 Releases。某个架构已发布后，对应按钮才启用；可以分平台开放，不要求四个产物同时可用。alpha/beta 等版本明确标为预览版。门户版本独立于 npm 0.2.0，旧命令行入口仍指向实际已发布的 npm 版本。

更新下载的顺序：

1. 按桌面发布流程构建、安装验收并公开 GitHub Release，记录源码 SHA、版本和 SHA-256。
2. 确认 Release 不是草稿，匿名访问下载 URL 成功；核对文件名、系统、架构和校验值。Actions 的临时 artifact 不作为公众下载地址。
3. 将真实版本、标签与 URL 写入 downloads.json，运行 `node --test tests/portal.test.mjs`、`npm run build:site` 和 `npm run check:docs`。
4. 在本机预览检查启用的下载链接、未发布架构、窄屏及备用复制入口；按授权提交／部署，再核对线上链接。

`scripts/site-downloads.mjs` 校验官方仓库、Release 标签、文件版本和架构；构建只输出链接，不把 JSON、本地安装包或凭据复制到门户。无需让访客浏览器调用 GitHub API，页面不受匿名 API 限额影响。当前已公开 desktop-v0.3.0-alpha.1，四种架构的匿名完整下载和 SHA-256 均已验证；[发布记录](releases/desktop-0.3.0-alpha.1.md)包含安装包来源和验收边界。门户本次部署状态见下方生产记录。

## 腾讯 EdgeOne Pages / Makers

腾讯的部分入口已将 Pages 命名为 Makers。这个门户只使用静态托管；无须服务器、数据库或云函数。

在腾讯云控制台导入 `heyjianhang/career` 的 main 分支，仓库根目录选择 `/`，框架选择其他／静态站。根目录 [edgeone.json](../edgeone.json) 配置：

| 项目 | 值 |
| --- | --- |
| 安装命令 | `node --version`（无需 npm install） |
| 构建命令 | `node scripts/build-site.mjs` |
| 输出目录 | `build/site` |
| Node.js | `22.11.0` |
| 加速区域 | 全球可用区（不含中国大陆） |

`heyjianhang.top` 未备案，因此使用不含中国大陆的区域。该选项分配境外边缘节点，不代表固定部署到一台香港服务器。具体区域与套餐以控制台确认为准。

部署后在域名管理中添加 `career.heyjianhang.top`。根据控制台实际返回的记录，在 DNSPod 添加域名归属验证记录及主机记录 `career` 的 CNAME；CNAME 的目标由本次项目生成，不使用示例值。已有记录先检查，不能覆盖其他业务。申请 HTTPS 证书，等待域名和证书生效后，从自定义域名验收页面、复制按钮与资源加载。

绑定仓库后，生产分支更新可以触发重新构建。公开 npm 包的发布仍为独立步骤；发布前核对门户命令指定版本已在 registry 可安装。只部署静态产物即可展示 portal，不需要 npm token。

## 生产部署记录

2026-10-13 门户已上线：[career.heyjianhang.top](https://career.heyjianhang.top/)。

- 腾讯项目：career（makers-od1hhnbtxjpx）；生产部署 dp5vuzqo1c7p，状态成功。
- 源码：[PR #1](https://github.com/heyjianhang/career/pull/1)，main 提交 517a18d；修复提交三平台 CI 通过。
- DNSPod：主机记录 career，类型 CNAME，默认线路，记录值 career.heyjianhang.top.pages.dnsoe4.com，TTL 保持默认。
- 腾讯域名管理显示“已生效”，HTTPS 显示“已部署”；实际 HTTPS 页面和开始指令复制已验收。
- 首次部署 dpkptbf2lv3z 因远端提交缺少 scripts/build-site.mjs 失败，补齐门户源码后已恢复。本次从控制台新建 main 部署完成，尚未单独验证后续推送自动触发。

部署成功不代表 npm 版本更新；本次仅发布门户，npm 仍为 0.2.0。

## 其他静态托管

同一份 `build/site/` 也可部署到其他支持 HTTPS 与自定义域名的静态站服务，无需改动页面代码。当前针对腾讯准备配置，未为其他服务创建部署或收费资源。

## 验收与来源

2026-10-13 本地浏览器检查：1440、1024、768、390 像素宽度无横向溢出；复制内容与 README 一致；剪贴板被拒绝时选择完整文本并提示快捷键；截图切换、放大与 Escape 返回正常；FAQ 可展开；无 JavaScript 页面错误。预览服务请求 `.git/config`、`workspace/career.json` 均返回 404。截图是项目已有的合成演示，来源见[素材说明](assets/README.md)。

腾讯官方资料（核对于 2026-10-13）：[区域与域名](https://edgeone.cloud.tencent.com/pages/document/175191784523485184)、[项目管理](https://cloud.tencent.com/document/product/1552/127388)、[构建配置](https://cloud.tencent.com/document/product/1552/127389)、[自定义域名](https://pages.edgeone.ai/document/custom-domain)。
