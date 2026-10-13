# 我的职业资料：Agent 协作入口

默认中文，跟随用户语言。你负责引导用户整理真实经历、维护母版、生成简历并保存进度；用户无需学习文件格式或 Git。初始化完成后从这里继续，无需用户再次粘贴整套步骤。

## 每次开始（包括新会话）

1. 先读本目录 `career.json`，从本目录运行 `npm run career -- doctor --json` 和 `workspace status --json`。首次安装、依赖缺失、同步尚未选择或恢复后的环境准备，读 [career-setup](.agents/skills/career-setup/SKILL.md)，按实际状态继续，不重复初始化。
2. 用户选择远程同步但尚未建仓或连接，即使本目录还没有 Git 跟踪，也读 [career-git](.agents/skills/career-git/SKILL.md)，由 Agent 引导并执行。onboarding.sync 为 connected 时，按该 Skill 先 `sync status --refresh`，必要时快进 pull 后再读正文；local 则尊重已选本机保存，不重复询问 GitHub。
3. 读 `context/INDEX.md`、`context/state.md` 和 `resume/maintenance.md`，找到本轮对象；只打开／导出已有成果时直接进入 resume-tailor，不重走访谈。

## 按任务使用

- 安装、初始化、依赖或受管入口故障：[career-setup](.agents/skills/career-setup/SKILL.md)。
- Git 初始化、逐步引导 GitHub 私人仓库、首次提交、日常保存与同步、换机：[career-git](.agents/skills/career-git/SKILL.md)。
- 收集旧材料、基本信息、照片、教育、工作、项目和能力：[career-intake](.agents/skills/career-intake/SKILL.md)。有材料先读，已有回答先保存，再问影响表达的缺口。照片、个人网页、项目链接可选。
- 首次形成或更新母版：[resume-master](.agents/skills/resume-master/SKILL.md)。事实与团队／个人贡献分清，不能编造收益。
- 生成或打开简历、平台稿、HTML／PDF：[resume-tailor](.agents/skills/resume-tailor/SKILL.md)。用户要求整套交付时完成到可访问页面。

## 保存与续接

文件由 Agent 编辑，先读最新内容，再按[数据契约](docs/data-model.md)保存和校验。完成一段经历或其他工作单元时更新进度，按 career-git 保存本地版本；初版母版、成品简历或重要更新完成后，按用户已有授权处理远程同步。提交与同步规则统一在 Git Skill 维护。

资料的稳定 ID、来源、冻结版本与已有手改保持可追溯。源事实变化后实质更新母版与内容包，不为消除校验提示只改摘要。结束时记录实际产物、未完成事项与下一步。
