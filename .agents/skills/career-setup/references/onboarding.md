# 首次准备与环境恢复

安装前指令见[安装说明](../../../../docs/installation.md)。公开指令只负责安装并进入工作区，后续流程由该目录的 AGENTS 和 Skills 接管。

1. 检查 Node.js 22+ 与 npm。已有可用环境就复用；缺少时按用户系统从 [Node.js 官方站点](https://nodejs.org/) 准备。使用完整包名 `@heyjianhang/career` 和已确定版本，安装失败就报告真实错误，不换成相似名称的包。
2. 和用户确定独立的个人目录，用绝对路径调用 `career setup --workspace "<目录>" --json`。目录不放在程序安装目录或其他 Git 仓库内；有旧资料时先核对，不清空已有目录。
3. 进入返回的工作区，先读 AGENTS.md，再按 `next_reads` 与 `next_action` 继续。默认安装固定依赖、五个 Skills 及完整引用；`--no-install` 只用于开发验收，依赖仍需准备才能开始协作。
4. 执行 doctor 与 workspace status。重试保留已有资料和同步选择；conflicts 中的用户自定义指引需要对照合并。工具版本不同按已记录版本恢复，不覆盖为 latest。
5. 按 [career-setup](../SKILL.md) 选择或恢复保存方式。Git、GitHub 账号、建仓、提交身份、同步与换机操作统一读 [career-git](../../career-git/SKILL.md)，不在这里维护第二套规则。
6. 准备完成后读 context/state，继续用户任务。PDF 缺运行时只安装 `runtime install --component pdf`，不因此重新收集资料。

用户直接给出已有私人资料仓库、要换电脑继续时，先按 career-git 的[换机恢复](../../career-git/references/restore.md)恢复到不存在的新目录，不先创建一个同名新资料库。

维护者提供的本地 `.tgz` 可用 `--package-source "<包文件的绝对路径>"` 验收；此模式会在锁文件记录本机包路径，正式换机需要先核对依赖来源。
