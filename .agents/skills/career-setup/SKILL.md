---
name: career-setup
description: 安装、初始化或修复 career 个人工作区，完成客户端工作区交接或按本地入口继续协作；用于首次使用、缺少依赖、安装冲突或恢复后的环境准备。Git 建仓、提交与同步交给 career-git。
---

# 准备工作区并开始协作

先区分当前任务：从其他对话安装时，按[首次准备](references/onboarding.md)确认保存位置、完成初始化验证，再交给用户工作区路径与新对话开始指令；不在安装阶段收集姓名或简历。用户已在个人工作区中开始／继续时，读取 `AGENTS.md` 并执行下面的检查，不再次要求切换对话。

## 检查与路由

工作区内使用 `npm run career -- <命令> --json`，实际能力以 `--help --json` 为准。安装目录和开发源码仓库不保存个人资料。

桌面创建的工作区已准备 CLI 和 Skills。若有 `.local/desktop-runtime.json`，按 AGENTS.md 使用绑定本目录的 `.local/career`（macOS）或 `.local/career.cmd`（Windows）代替上述 npm 前缀，先检查状态再继续，不重新安装 npm 包。入口失效时让用户在软件中重新打开这个工作区；Git/gh 仅在所选同步流程确实需要时准备。

1. 读 `career.json`，运行 `doctor` 和 `workspace status`。依赖缺失或版本不匹配先按锁文件恢复；安装返回 `agent.conflicts` 时保留自定义文件并对照合并，不重复覆盖。
2. `onboarding.sync` 缺失或为 undecided：仅询问尚未确定的选择——“资料先只保存在本机，还是同步到你自己的 GitHub 私人仓库？”已有回答直接沿用。
3. 选择仅本机：执行 `sync local` 并继续；不要求注册 GitHub。需要本地版本保存时由 [career-git](../career-git/SKILL.md) 准备 Git。
4. 选择远程同步：读取 [career-git](../career-git/SKILL.md)，按其首次连接流程逐步引导。Git 尚未跟踪当前目录时也由它完成本地初始化、提交身份与首次提交；不要让用户自己拼 Git 命令。
5. 已为 connected：按 career-git 先核对远端，再读取最新上下文；已为 local：直接续接，除非用户主动要求启用同步。
6. 读 `context/INDEX.md`、`context/state.md`、`resume/maintenance.md`，执行用户当前请求。有旧材料先按 [career-intake](../career-intake/SKILL.md) 提取；无材料从一段经历开始。只打开或导出已有成果，直接按 [resume-tailor](../resume-tailor/SKILL.md) 处理，不重走访谈。

首次同步因网络、账号或仓库信息暂未完成时，记录正在等待的事项；用户暂缓同步便继续本地协作，下次按记录续接，不重新要求完整入门流程。

## 完成标准

安装对话：个人目录、依赖和入口已验证；用户收到真实路径、打开工作区的方法与简短开始指令，安装交接完成。

工作区协作：按已有状态确定保存方式或记录待办，再进入用户实际任务。报告实际进度，不能把 setup 成功当作客户端工作区已打开、Git 已初始化、资料已完整或远程已同步。
