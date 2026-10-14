# 首次准备与环境恢复

## 从安装对话建立工作区

1. 安装阶段只确认资料保存位置，不询问姓名。默认在用户选定位置新建 `career-workspace`；展示最终绝对路径，已有明确完整路径直接使用，不再嵌套同名目录。使用空目录，或检查后续用已有 career 工作区；不放进程序目录或其他项目的 Git 仓库，不覆盖其他文件。
2. 检查 Node.js 22+ 与 npm。复用可用环境，缺少时从 [Node.js 官方站点](https://nodejs.org/)安装。用[安装说明](../../../../docs/installation.md)指定的完整包名与版本，找不到就报告，不换成相似包。
3. 按确认的绝对路径执行 `career setup --workspace "<目录>" --json`。读取返回的入口与 next_reads，进入目录运行 doctor 和 workspace status。依赖、版本、入口冲突先修复；`--no-install` 仅用于开发验证，不作为安装完成。
4. 确认成功后展示目录路径，引导在 Agent 软件中“打开文件夹／添加现有项目”，选中此目录，再新建对话。终端 cd 不代表客户端已切换项目。已知客户端直接给对应指引，不明确才问软件名称。
5. 将下面一句交给用户，供新对话发送；新版 setup 可直接使用 handoff.prompt。此时完成安装交接，保存方式与资料收集留到新工作区。

```text
请读取当前工作区的 AGENTS.md，按已有进度引导我开始使用 career。
```

公网的[安装指南](https://raw.githubusercontent.com/heyjianhang/career/main/install.md)面向尚未安装的 Agent，详细步骤与这里保持一致；工作区建立后从本地入口协作，无需每次联网读指南。0.2.0 未返回 handoff 时也按上述方式完成交接。

## 已在工作区中继续或修复

当前对话已经以目标目录为工作区且用户要求开始／继续时，直接按 [career-setup](../SKILL.md)读取状态，不重复安装、选目录或要求新建对话。用户已回答的保存方式沿用 career.json；上下文按 context/state 续接。

依赖缺失按锁文件恢复，工具版本不匹配按工作区记录处理，不覆盖为 latest。agent.conflicts 中的自定义指引对照合并，不重复覆盖。PDF 缺运行时只安装 `runtime install --component pdf`，不因此重新收集资料。

用户要换电脑继续时，先按 [Git 换机恢复](../../career-git/references/restore.md)恢复到不存在的新目录，不先建同名空库。Git 初始化、提交身份、GitHub 私人仓库和同步统一由 [career-git](../../career-git/SKILL.md)引导，发生在工作区协作阶段。

维护者提供的本地 `.tgz` 可用 `--package-source "<包文件的绝对路径>"` 验收；此模式会在锁文件记录本机包路径，正式换机先核对依赖来源。
