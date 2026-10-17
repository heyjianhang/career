# 安装与首次协作

包名：`@heyjianhang/career`。初始化会安装固定版本的 CLI、项目级 Skills 和工作区协作指引。

## 复制给 Agent

```text
请读取 https://raw.githubusercontent.com/heyjianhang/career/main/install.md，按指引帮我安装并初始化 career。
```

详细安装流程由[公网安装指南](https://raw.githubusercontent.com/heyjianhang/career/main/install.md)维护，独立于门户。安装阶段只确认位置：默认在用户选定位置创建 `career-workspace`，不询问姓名。初始化后引导用户在 Agent 软件中打开该目录，并在新对话发送本地开始指令。

## 安装命令

Mac、Windows 使用同一 CLI；目录路径按系统调整。需要 Node.js 22+（https://nodejs.org），Git 用于本地版本（https://git-scm.com），GitHub CLI 仅在远程同步时需要（https://cli.github.com）。安装环境可能需要系统权限，由 Agent 引导用户完成。

```sh
npx --yes --package @heyjianhang/career@0.2.0 career setup --workspace "<个人目录的绝对路径>" --json
```

进入个人目录后，用 `npm run career -- doctor --json` 和 `workspace status --json` 验证。setup 安装固定版本，生成项目级 Skills 和资料骨架，输出 next_reads / next_action；当前开发版还返回 handoff（路径与新对话指令），0.2.0 则由 Agent 按公网指南完成相同交接。next_action 留给新工作区中的协作，不自动注册账号或创建客户端会话。

## 初始化之后

在 Agent 软件中打开创建的个人目录，新建对话并发送：

```text
请读取当前工作区的 AGENTS.md，按已有进度引导我开始使用 career。
```

安装对话展示真实路径与这句指令后完成交接。新对话读取 `AGENTS.md`，检查现有状态、询问尚未选择的保存方式，再按任务读取 Skill：

- [career-setup](../.agents/skills/career-setup/SKILL.md)：环境与工作区准备，衔接首次使用或继续已有任务。
- [career-git](../.agents/skills/career-git/SKILL.md)：本地版本、GitHub 私人仓库建仓引导、首次提交、后续同步和换机恢复。
- 经历收集、母版维护和简历生成按工作区入口路由，不需要把这些步骤反复粘贴给 Agent。

支持项目级 Skills 的客户端可自动发现；其他具备文件与终端能力的 Agent 按 `AGENTS.md` 链接读取。账号验证在官方页面完成。GitHub 同步可以跳过，个人资料始终使用独立目录。

首次 PDF 需要 `npm run career -- runtime install --component pdf --json`，由 Agent 按任务准备浏览器运行时。

## BOSS 岗位采集（当前开发源码）

从当前源码构建的 npm／桌面包会将 [boss-zhipin-scraper](../.agents/skills/boss-zhipin-scraper/SKILL.md)、Python 脚本、城市码表和 MIT 许可安装到个人目录的 `.agents/skills/boss-zhipin-scraper/`。已发布 npm 0.2.0 和桌面 alpha.1 不含此 Skill；需要包含该改动的新包，不会在初始化时从上游临时下载最新版本。

安装 career 本身无需 Python。用户第一次要求搜索 BOSS 岗位时，Agent 按 [环境与命令](../.agents/skills/boss-zhipin-scraper/references/usage.md) 准备 Python 3.10+、工作区 `.local` 内的独立依赖环境及 Chrome／Edge 登录。首次通常需要用户扫码；登录配置留在本机，不同步或打包。采集脚本不内置在 Electron 的 Node 运行时中。

新版本的桌面应用打开旧工作区时会补装受管 Skills。npm 用户先按既有流程升级工具版本，再执行 `npm run career -- agent install --json`；用旧版 CLI 执行不会获得新版资源。安装会保留用户修改并报告 conflicts，不能静默覆盖。新增 Skill 不导入演示简历、岗位或采集记录。

可以直接告诉工作区 Agent：“帮我在 BOSS 找杭州的 Agent 开发岗位，先看一页，筛选合适的再放进看板。”采集与分析由两个 Skill 协作，未授权时不会自动投递或联系招聘方。

## 使用维护者提供的本地安装包

维护者可提供经过核对的 `.tgz` 安装包。由 Agent 在独立测试目录执行下面的命令；将两个路径替换为当前系统的绝对路径：

```sh
npx --yes --package "<安装包.tgz 的绝对路径>" career setup --workspace "<个人目录的绝对路径>" --package-source "<安装包.tgz 的绝对路径>" --json
```

这种方式会在依赖锁中记录本机包路径，用于发布前验收，不作为正式换机安装方式。仅使用来源已核对的安装包，不安装相似名称的包。

## 换电脑继续

需要已有私人资料仓库，并在新电脑准备 Node/npm、Git 和 GitHub CLI。让 Agent 核对登录状态，再用已验证版本执行：

```sh
npx --yes --package @heyjianhang/career@0.2.0 career workspace restore --repository "<用户名>/<私人仓库名>" --workspace "<不存在的新目录绝对路径>" --json
```

此命令恢复资料，不执行仓库中的安装脚本。Agent 核对恢复出的工具依赖与锁文件后，在新目录 `npm ci --ignore-scripts`，运行 `npm run career -- doctor --json`，读取 AGENTS 和 context 继续。使用当前工作区记录的版本，不因恢复而替换成 latest；已存在的目录不自动清空。

## JD 需求研究 Skill（当前开发源码）

[jd-research](../.agents/skills/jd-research/SKILL.md) 随当前源码构建的安装资源提供，可分析单份或多份 JD，用于求职方向与能力补足规划、简历表达优化。只阅读方法无需额外依赖；可选统计脚本使用 Node.js 22+，不联网或调用模型。整个 Skill 文件夹也能单独复制使用，招聘采集工具为可选入口，不依赖 BOSS 登录。已发布 npm 0.2.0／桌面 alpha.1 不含此 Skill，本次未更新已安装应用。

用户可以对工作区 Agent 说：“分析这些 JD，按实际职责区分方向，对照我的经历，指出哪些该改简历、哪些需要补证据或学习；把我选中的机会加入看板。” Agent 按已授权范围读取该 Skill，并衔接现有岗位、经历或简历方法。研究报告按需保存在工作区 `research/jd/`，下一步记入 context；安装 Skill 不会自动开启桌面后台研究或批量采集。
