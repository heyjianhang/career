---
name: career-setup
description: 安装、初始化或修复 career 个人工作区，读取工作区入口并衔接首次协作；用于首次使用、缺少依赖、安装冲突或恢复后的环境准备。Git 建仓、提交与同步交给 career-git。
---

# 准备工作区并开始协作

完成环境和目录准备后，进入用户自己的工作区，读取 `AGENTS.md` 并继续当前任务。完整安装步骤只在需要时读[首次准备](references/onboarding.md)；用户无需再次粘贴 README 中的安装指令。

## 检查与路由

工作区内使用 `npm run career -- <命令> --json`，实际能力以 `--help --json` 为准。安装目录和开发源码仓库不保存个人资料。

1. 读 `career.json`，运行 `doctor` 和 `workspace status`。依赖缺失或版本不匹配先按锁文件恢复；安装返回 `agent.conflicts` 时保留自定义文件并对照合并，不重复覆盖。
2. `onboarding.sync` 缺失或为 undecided：仅询问尚未确定的选择——“资料先只保存在本机，还是同步到你自己的 GitHub 私人仓库？”已有回答直接沿用。
3. 选择仅本机：执行 `sync local` 并继续；不要求注册 GitHub。需要本地版本保存时由 [career-git](../career-git/SKILL.md) 准备 Git。
4. 选择远程同步：读取 [career-git](../career-git/SKILL.md)，按其首次连接流程逐步引导。Git 尚未跟踪当前目录时也由它完成本地初始化、提交身份与首次提交；不要让用户自己拼 Git 命令。
5. 已为 connected：按 career-git 先核对远端，再读取最新上下文；已为 local：直接续接，除非用户主动要求启用同步。
6. 读 `context/INDEX.md`、`context/state.md`、`resume/maintenance.md`，执行用户当前请求。有旧材料先按 [career-intake](../career-intake/SKILL.md) 提取；无材料从一段经历开始。只打开或导出已有成果，直接按 [resume-tailor](../resume-tailor/SKILL.md) 处理，不重走访谈。

首次同步因网络、账号或仓库信息暂未完成时，记录正在等待的事项；用户暂缓同步便继续本地协作，下次按记录续接，不重新要求完整入门流程。

## 完成标准

个人目录和 CLI 可用；受管入口已读取；保存方式已确定或明确待办；Agent 已进入用户的实际任务。报告实际路径和当前进度，不能把 `setup` 成功当作 Git 已初始化、资料已完整或远程已同步。
