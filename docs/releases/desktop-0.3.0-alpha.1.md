# career Desktop 0.3.0-alpha.1

发布日期：2026-10-15（北京时间）。[GitHub 预发布](https://github.com/heyjianhang/career/releases/tag/desktop-v0.3.0-alpha.1)已公开；[匿名完整下载验证](https://github.com/heyjianhang/career/actions/runs/38642706713)通过，四个文件均返回 HTTP 200 且 SHA-256、字节数与原产物一致。[门户](https://career.heyjianhang.top/)已同步上线。生产部署 `dplukz44o1uq`，源码 `13a3c223965bea2217de4abc2613b9438b5ed6f6`；线上 HTML 与本地构建逐字节一致，四种下载 URL、架构菜单及 HTTPS 加载通过检查。

career 首个桌面预览版。安装后创建自己的工作区，再把软件里的协作指令发给 Agent。

- 支持 macOS Apple Silicon / Intel、Windows x64 / ARM64，安装包内含运行环境，无需 Node.js 或 npm。
- 新工作区没有预置简历、岗位或演示文件；内含空资料结构、八个用户 Skills 和本地 CLI。
- 统一管理职业资料、简历、岗位看板及面试记录，支持 HTML / PDF 导出。
- 可选 GitHub 私人仓库同步；企查查连接在本机加密保存，使用自己的 API Key。
- 修复 Windows 内置企查查 CLI 的通信失败，使用有大小限制且用后清理的本机交换文件。

**这是未签名预览版。** macOS 尚未公证，Windows 安装包没有代码签名；系统可能提示无法验证开发者。资料保存在用户选择的本地文件夹。此版本不代表正式稳定版；公开 npm 包仍为 0.2.0，本次未更新 npm。

## 验证

源码：`5feeb5b27a721e94e112de59272f1e698b40eb66`。

[四架构原生验收](https://github.com/heyjianhang/career/actions/runs/38640377791)全部通过；测试运行刚打包的应用，未使用开发环境 Electron 替代。

| 平台 | 打包应用验收 |
| --- | --- |
| macOS Apple Silicon | 通过 |
| macOS Intel | 通过 |
| Windows x64 | 通过 |
| Windows ARM64 | 通过 |

每个平台通过 118 项基础测试，并验证新工作区为空、八个 Skills、内置 CLI、工作区隔离、企查查配置与操作系统加密、企查查 CLI 状态及缺少密钥的错误处理、桌面与 CLI PDF 导出。另有[三平台基础 CI](https://github.com/heyjianhang/career/actions/runs/38640376446)，包含实际 npm 归档安装验证。

验收使用合成资料与合成 API Key，没有请求真实企查查付费接口；没有验证真实 GitHub 账号的登录／上传全流程。四架构 CI 检查打包后的应用，并不替代安装向导的人工验收。此前 Windows ARM64 设备上安装与 x64 仿真验收来自旧候选，不能算本次新包的完整人工验收；本次 x64 已有原生 CI 验证。本机 Intel 仿真运行曾超时，原生 Intel CI 已通过。

安装包 SHA-256 见 `SHA256SUMS.txt`；四个安装包均来自同一源码和上述构建任务。旧草稿中的 Windows 包已由本次通过验证的包替换。

## 安装包校验值

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| career-0.3.0-alpha.1-mac-arm64.dmg | 164415276 | `3f6ab4410afbeab1e152b47c7705c7c53b6521e94b962dd14521184425446565` |
| career-0.3.0-alpha.1-mac-x64.dmg | 169020253 | `79d3c8a24115ce423b1fb38bf9eb92ef78de94b9240c11cfc7ca56435c1385ab` |
| career-0.3.0-alpha.1-win-x64.exe | 151166122 | `1a5eb5423208e636a3d88d0fbd9ec2240d1e326d78f7ab2ce4c0189fb0f25919` |
| career-0.3.0-alpha.1-win-arm64.exe | 144980605 | `9fe9b227413225b9983583357c8754276302aaa0f99ebadee4fd77d95e441ff9` |
