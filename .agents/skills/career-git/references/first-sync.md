# 首次连接：一步一步引导

按当前进度只处理下一处缺口。用户已给账号或仓库地址就复用；不要把整份 Git 表格交给用户填。以下命令在个人工作区执行，career 命令加 `--json`。

## 先确定现有状态

读取 career.json 的 onboarding/sync，运行 doctor；需要同步时用 `sync environment` 检查 Git、GitHub CLI 与登录，读取官方安装入口。已有 Git 时 `sync status`，GIT_NOT_INITIALIZED 才进入本地初始化。已有可用跟踪与远程则转[日常流程](daily-sync.md)。FOREIGN_REPOSITORY 表示目录属于另一个仓库，先选择独立目录并保留现有文件。

仅本机使用不需要 GitHub 账号和 gh。希望远程同步时，向用户简要说明：这会把职业资料保存到他自己的私人仓库；还没有账号或仓库，可以一步一步准备。已有当轮同步授权沿用，不再逐个请求命令批准。

桌面入口是侧栏「云同步」：检查环境 → 登录 GitHub → 填写空私人仓库地址 → 连接 → 同步。Git 缺失不阻塞简历和看板；Windows 与 macOS 均提供官方安装入口和重新检测。系统安装器由用户完成，Agent 可执行已授权的准备工作。

这条路线只作 Agent 导航，不一次性全发给用户。首次可说：“这会在你自己的 GitHub 账号下保存一份私人备份，方便换电脑继续；还没准备账号也没关系，我们一步步来。”每次只给当前需要点击／填写的操作，完成后检查真实状态再进入下一项。用户暂不备份就回到简历任务，不要求先安装 Git。

## 准备账号与登录

1. doctor 缺 Git 或 gh 时，按当前系统从 [Git](https://git-scm.com/downloads) 或 [GitHub CLI](https://cli.github.com/) 官方来源准备，复用已有环境。用户无需抄安装命令，Agent 执行可执行部分。
2. 先运行 `gh auth status --hostname github.com` 检查现有登录；已登录就复用匹配的账号。未登录时问“你有 GitHub 账号吗？”
3. 没有账号：引导打开 [GitHub 注册](https://github.com/signup)，由用户完成注册和验证，再继续。不索取密码或验证码。
4. 有账号：运行 `gh auth login --hostname github.com --web --git-protocol https`，让用户在官方网页完成设备登录。浏览器登录和 CLI 登录分开；完成后重新核对 auth status，不仅凭一句“好了”推断终端已登录。

## 取得私人仓库地址

用户已有仓库，直接取得地址并检查归属与内容。没有仓库时，默认引导用户打开 [新建私人仓库](https://github.com/new?visibility=private)：

1. Owner 选择自己的账号；Repository name 可用 `my-career`，也可自行命名。
2. Visibility 选 **Private**。这是个人资料库，开源的是工具源码。
3. 创建空仓库：不添加 README、.gitignore、License 或模板内容；本地工作区已有起步文件。
4. 点击 Create repository 后，把仓库页面地址发给 Agent，例如 `https://github.com/<用户名>/<仓库名>`。地址不是密码，可以直接提供。

示例引导：“建好后把仓库页面的网址发给我，后面的连接和首次保存由我完成。”不要让用户复制密码、访问令牌或 GitHub 页面中的整组 Git 命令。

若用户明确要求 Agent 代建，先确定账号和仓库名，再用 `sync connect --repository "<owner/repo>" --create`；它依赖已建立本地 Git，按下一节准备后执行。用户已在网页建好时不传 `--create`。创建结果未知或名称已存在时先查询，不反复创建。

拿到地址后核对当前账号可写、仓库为 private、远端是否有内容。可用 `gh api repos/<owner>/<repo>` 及 branches 查询；正式连接时 CLI 还会校验。含已有资料的仓库走[恢复](restore.md)，不向现有历史强推；用户误勾 README 也保留远端内容，先核对如何整合。

## 建立本地版本

doctor 显示缺 Git 时，先按当前系统从 Git 官方来源安装；仅本机保存不安装 gh，也无需 GitHub 账号。已初始化且身份可用时跳过重复配置。否则运行：

```sh
npm run career -- history init --json
```

返回 `identity_ready:false` 才询问“版本记录使用什么名字和邮箱？”可以提醒用户从 [GitHub 邮箱设置](https://github.com/settings/emails) 复制自己的隐私邮箱；不得自行拼接账号或数字 ID。拿到信息后运行：

```sh
npm run career -- history init --name "<用户提供的名字>" --email "<用户提供的邮箱>" --json
```

只设置当前仓库。若用户选择仅本机，在检查待保存范围后执行首次 `history save`，返回当前任务；不继续账号和建仓步骤。用户暂不提供身份时保留文件，记录本地提交待完成，不阻塞已可进行的资料整理。

## 连接、首次提交与上传

已明确私人目标与同步范围后，由 Agent 顺序执行：

```sh
npm run career -- sync connect --repository "<owner/repo 或 GitHub 仓库地址>" --json
npm run career -- workspace check --json
npm run career -- history save --message "初始化：建立职业资料库" --json
npm run career -- sync run --json
npm run career -- sync status --refresh --json
```

连接不等于上传。连接会写入 career.json，因此首次提交放在连接之后，让本地配置和资料一起保存。检查实际修改与 .gitignore，包含资料、可选照片及 research/jd 下的岗位样本／原文／分析／计划，排除 node_modules、build、.local、.cache 和凭据；用户要求仅本地的材料先安排排除。新建空仓库后无需用户建立 main，首次上传推送本地 main。

`history save` 的 `saved:false` 表示没有新变化，不是上传完成；已有提交可继续按授权上传。`sync run` 返回 `synced:true` 后才能报告首次同步成功。最终给出实际个人目录、仓库链接和保存结果，然后按 AGENTS.md 继续经历与简历任务。

参考：[GitHub 新建仓库说明](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)、[gh 网页登录](https://cli.github.com/manual/gh_auth_login)、[提交邮箱](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)。界面变化时以实际页面和官方说明为准。
