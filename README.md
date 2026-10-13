# career

![career — 把经历，写成下一步。](docs/assets/career-hero.png)

**与 Agent 协作的个人求职工作台。**

从经历整理和简历生成出发，逐步连接岗位分析、求职进展跟踪与复盘。资料保存在你自己的目录，协作可以接着上次继续。

[开始使用](#开始使用把这段发给-agent) · [当前能力](#现在可以做什么) · [路线图](docs/roadmap.md) · [参与开发](CONTRIBUTING.md) · [文档](docs/README.md)

## 从简历开始，贯穿一次求职

| 阶段 | 你和 Agent 一起完成的事 | 状态 |
| --- | --- | --- |
| 整理经历 | 从旧材料与对话提取事实，保留来源与待补问题 | 已实现 |
| 准备简历 | 维护母版、选择内容与排版，生成简历和平台填写稿 | 已实现 |
| 分析机会 | 收集岗位，结合目标与经历比较要求、证据和缺口 | 规划中 |
| 跟踪求职 | 关联岗位、所用简历、申请阶段、沟通记录与下一步 | 规划中 |
| 回顾调整 | 根据真实记录观察进展，复盘筛选和表达 | 规划中 |

后续的岗位、申请和分析会沿用同一套个人资料。具体边界与交付顺序见[产品路线图](docs/roadmap.md)。

## 现在可以做什么

把旧简历、项目材料或一段口述交给 Agent。它按 Skills 引导补充信息、整理事实、维护母版，再调用 CLI 保存、校验和生成成果。

![career 简历工作台，使用虚构资料演示](docs/assets/workspace.jpg)

- **持续维护经历**：区分来源、事实、表达与待确认问题，新经历随时补充，中断后接着继续。
- **准备不同版本**：从同一套资料选材，按用途或用户提供的 JD 准备简历，保留对应版本。
- **选择样式与导出**：14 款排版，可选照片、分页预览、HTML/PDF；个人网页和项目链接在 PDF 中可点击。
- **准备平台填写稿**：BOSS 直聘、智联招聘、猎聘、前程无忧的主要经历字段可点击复制。技能、证书、语言等提供通用资料，由用户匹配平台选项。
- **保存与换机继续**：本地 Git 留存，可选连接自己的 GitHub 私人仓库；Agent 执行检查、保存与同步命令。

<details>
<summary>查看排版样式选择器</summary>

![14 款排版样式的选择与预览](docs/assets/styles.jpg)

同一份内容可以切换样式、放大预览并设为默认；照片和链接按用户资料显示。截图使用合成内容，人物为虚构示例。

</details>

CLI 负责确定性的工具操作，写作与判断由用户选择的 Agent 完成。目前不包含招聘平台自动填表、自动投递、求职看板或 Word 导出。

## 开始使用：把这段发给 Agent

需要一个能读写本地文件、运行终端命令的 Agent。复制整个代码块发给它，由它完成安装与后续引导：

```text
请帮我安装 career，并初始化一个独立的个人求职工作区。
先检查 Node.js 22+ 和 npm，缺少时从官方来源安装。和我确定资料目录后，用绝对路径执行：
npx --yes --package @heyjianhang/career@0.2.0 career setup --workspace "<个人目录>" --json

完成后进入这个目录，先读取 AGENTS.md，再按初始化结果的 next_reads 和 next_action 继续引导我。
```

初始化会安装项目级 Skills、协作入口和固定版本的工具依赖。工作区的 `AGENTS.md` 负责后续路由：选择保存方式、需要时使用 Git Skill 准备私人同步，再进入经历与简历流程。之后 Agent 在个人目录内使用 `npm run career -- …`，不用每次重新安装。详细环境要求、恢复方法和本地包试用见[安装说明](docs/installation.md)；也可下载打开[指令复制页](docs/get-started.html)。

## Skills 与 CLI 怎么配合

| Skill | Agent 负责的工作 |
| --- | --- |
| [career-setup](.agents/skills/career-setup/SKILL.md) | 检查环境、初始化工作区，按已有状态衔接后续任务 |
| [career-git](.agents/skills/career-git/SKILL.md) | 引导账号与私人仓库准备、首次提交、日常保存、同步和换机恢复 |
| [career-intake](.agents/skills/career-intake/SKILL.md) | 从材料和对话提取事实，逐步收集工作、项目、教育与能力 |
| [resume-master](.agents/skills/resume-master/SKILL.md) | 把事实整理成可读母版，保留个人贡献、来源与待补项 |
| [resume-tailor](.agents/skills/resume-tailor/SKILL.md) | 按用途选材，生成内容包和平台稿，调用 CLI 交付页面与文件 |

```mermaid
flowchart LR
    U[材料与对话] --> S[Agent 按 Skills 整理]
    S --> M[事实与简历母版]
    M --> P[Agent 写内容包和平台稿]
    P --> C[career CLI 校验与生成]
    C --> H[本地页面：选样式与复制]
    H --> F[HTML / PDF]
```

Skills 随 npm 包安装到个人目录。支持项目级 Skills 的客户端可以发现它们；其他 Agent 可从 `AGENTS.md` 按链接读取。自动发现方式取决于客户端，运行命令需要终端能力。

## 资料在哪里

```text
my-career/
├── AGENTS.md          # Agent 的协作入口
├── .agents/skills/    # 五个 Skills 及其参考资料
├── career.json        # 工作区配置、工具版本、同步选择
├── package.json       # 本目录使用的工具
├── package-lock.json  # 锁定依赖版本
├── context/           # 目标、当前进度、决定与反馈
├── resume/            # 来源、事实、母版、照片、简历内容包
└── build/             # 生成的 HTML、PDF 和构建快照
```

这个开源仓库存放工具源码与通用方法，个人目录保存用户资料。启用远程同步时，资料传到用户自己的私人仓库；生成文件、依赖和缓存默认不进入 Git。是否将材料发送给模型由所使用的 Agent 客户端及其设置决定。

GitHub 同步可跳过，之后仍可启用。启用后每次开始核对远端资料，重要节点询问上传；已有本轮或持续授权时直接同步。遇到未保存修改或历史分叉时保留内容并停止同步。工具版本由锁文件固定，不随资料拉取自动升级。

## 参与开发

欢迎改进 Skills、命令、中文排版及后续求职模块。先看[贡献指南](CONTRIBUTING.md)，了解[架构](docs/architecture.md)与[路线图](docs/roadmap.md)。统一的产品表达见[品牌定位](docs/brand.md)。

```bash
npm ci --ignore-scripts
npm test
npm run check:docs
npm run check:example
npm run test:package
```

CI 在 macOS、Windows、Linux / Node 22 上安装依赖、运行测试，并从实际安装包检查初始化和简历生成。[工作流](.github/workflows/check.yml)只做检查；npm 首次发布另行执行。具体检查与发布流程见[开发说明](docs/development.md)。

## 许可证与致谢

采用 [MIT License](LICENSE)，允许使用、修改、分发和商用，分发时保留版权与许可声明。

字体、图标及依赖保留各自许可。见[素材说明](docs/assets.md)与[方法和设计参考](docs/references.md)。
