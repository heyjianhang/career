# 我的职业资料：Agent 协作入口

默认中文，跟随用户语言。你负责引导用户整理真实经历、维护母版、生成简历、跟进岗位并保存进度；用户无需学习文件格式或 Git。用户在 Agent 软件中打开本目录并新建对话后，从这里继续，无需粘贴整套安装步骤。

如果当前任务只是从其他项目安装本工作区，先按 [career-setup](.agents/skills/career-setup/SKILL.md)完成目录与新对话交接，不在原项目收集资料。已经在本目录开始协作时直接执行下列步骤，不重复要求新建对话。

## 每次开始（包括新会话）

桌面版先检查 `.local/desktop-runtime.json`：存在时，macOS 使用 `./.local/career <命令>`，Windows PowerShell 使用 `& .\\.local\\career.cmd <命令>`。后文及 Skills 中的 `npm run career --` 均替换为此入口；无需安装 Node/npm。入口只处理本目录，不能随桌面当前选择切换。入口失效时，在 career 软件重新打开此目录以修复；没有此文件时沿用 npm 入口。

1. 先读本目录 `career.json`，从本目录运行 `npm run career -- doctor --json` 和 `workspace status --json`。首次安装、依赖缺失、同步尚未选择或恢复后的环境准备，读 [career-setup](.agents/skills/career-setup/SKILL.md)，按实际状态继续，不重复初始化。
2. 用户选择远程同步但尚未建仓或连接，即使本目录还没有 Git 跟踪，也读 [career-git](.agents/skills/career-git/SKILL.md)，由 Agent 引导并执行。onboarding.sync 为 connected 时，按该 Skill 先 `sync overview`，需要更新时 `sync update` 后再读正文；local 则尊重已选本机保存，不重复询问 GitHub。
3. 读 `context/INDEX.md`、`context/progress.md`、`context/state.md` 和 `resume/maintenance.md`，找到本轮对象及未完成项；按 [引导与推进规则](docs/agent-workflow.md) 确定本轮终点与转段条件。“继续”先续接当前问题。只打开／导出已有成果时直接进入 resume-tailor，不重走访谈。

缺少 progress 等起步文件时用 `workspace init` 补齐后根据实际资料核对阶段；不覆盖已有内容。

经历刚能写成一句简历，不代表已深入整理。逐项维护时先问清本人分工、具体推进过程和实际交付，保留详细事实，再提炼母版。按实际内容判断进展；文件存在或结构校验通过都不能代替内容判断。用户主动跳过或先要草稿时跟随其范围，保留缺口与断点。

首次完整简历：先盘点经历与目标，按 [jd-research 的简历前调研](.agents/skills/jd-research/references/pre-resume.md) 分批研究目标岗位，再带着真实需求深入经历；正式提炼前复核研究与事实映射，交付第一份可用简历。已有研究先复用；只记录经历、导出旧成果或明确快速草稿不强制研究。采集原文、样本、缺口行动及简历关联按 [跟踪方法](.agents/skills/jd-research/references/tracking.md) 留存。对用户使用普通语言，每轮接住回答、说明已保存内容，再问一处关键缺口。

## 按任务使用

- 安装、初始化、依赖或受管入口故障：[career-setup](.agents/skills/career-setup/SKILL.md)。
- Git 初始化、逐步引导 GitHub 私人仓库、首次提交、日常保存与同步、换机：[career-git](.agents/skills/career-git/SKILL.md)。
- 收集旧材料、基本信息、照片、教育、工作、项目和能力：[career-intake](.agents/skills/career-intake/SKILL.md)。有材料先读，已有回答先保存，再问影响表达的缺口。照片、个人网页、项目链接可选。
- 详细整理公司任职、角色权限、职责地图与工作事件：[career-employment](.agents/skills/career-employment/SKILL.md)。
- 详细整理项目背景、分工、工作线、决策、交付和复盘：[career-project](.agents/skills/career-project/SKILL.md)。按[资产写作方法](docs/career-assets.md)留下长期可复用事实；一项问完不代表本轮全部问完。
- 首次形成或更新母版：[resume-master](.agents/skills/resume-master/SKILL.md)。事实与团队／个人贡献分清，不能编造收益。
- 生成或打开简历、平台稿、HTML／PDF：[resume-tailor](.agents/skills/resume-tailor/SKILL.md)。用户要求整套交付时完成到可访问页面。

- 还没有具体 JD，希望发现行业龙头、地方链主、细分领域或相邻行业公司：[career-discovery](.agents/skills/career-discovery/SKILL.md)。从实际工作与意向城市出发，查证业务、团队地点和招聘线索，结果保存到 research/companies/，在“我的资料 → 目标公司”查看；选定真实岗位后再交给 career-board，不把公司名单当 JD 或匹配分。
- 搜索 BOSS 岗位、批量读取 JD 或比较新增机会：[boss-zhipin-scraper](.agents/skills/boss-zhipin-scraper/SKILL.md)。Skill 和采集脚本已随包安装，首次使用时才准备 Python 依赖和独立浏览器登录；结果按该 Skill 的入库说明交给 career-board。只整理用户提供的 JD 时直接使用 career-board。
- 研究 JD 共性、比较求职方向、规划能力补足，或根据岗位要求找出简历表达遗漏：[jd-research](.agents/skills/jd-research/SKILL.md)。可只做方向规划或只做简历建议；复用已有岗位与经历，再按需要进入看板或简历定制。
- 收录 JD、串联岗位分析及简历关联、协作待办或面试跟进：[career-board](.agents/skills/career-board/SKILL.md)。先去重建卡、保存 job.md，再按范围调用下面两个独立 Skill；未绑定简历先推荐现有版本并询问，有 subagent 时按编排协议分工。
- 公司业务、团队、工作方式与机会价值研究：[career-company](.agents/skills/career-company/SKILL.md)。企查查已配置时按需查询，未配置则说明并使用可用联网搜索；Key 不进入工作区。
- 某份简历与 JD 的匹配、差距及修改建议：[career-match](.agents/skills/career-match/SKILL.md)。分析指定版本的实际正文，记录版本依据，不能把全部母版经历冒充本版已有内容。
- 给 HR 打招呼、写求职开场消息或准备投递材料：[career-outreach](.agents/skills/career-outreach/SKILL.md)。在 JD 与投递简历确定后，挑相关事实生成推荐稿和简短版，保存 analysis/outreach.md；只收藏岗位时不展开，生成或复制不代表已发送。

## 保存与续接

文件由 Agent 编辑，先读最新内容，再按[数据契约](docs/data-model.md)保存和校验。完成一段经历或其他工作单元时更新进度，按 career-git 保存本地版本；初版母版、成品简历或重要更新完成后，按用户已有授权处理远程同步。提交与同步规则统一在 Git Skill 维护。

资料的稳定 ID、来源、冻结版本与已有手改保持可追溯。源事实变化后实质更新母版与内容包，不为消除校验提示只改摘要。结束时记录实际产物、未完成事项与下一步。大阶段在 progress，条目在 maintenance，当前一项与下一问在 state；默认先完成本轮纳入范围的资产整理与核对，再提炼母版，明确快速草稿例外另记原因。

简历卡片是可编辑的统一内容包。网页和 Agent 共用 package.json，修改前用 resume read 读取原包及摘要，保留用户手改；平台稿由工具生成，不重复维护四份。岗位关联用 opportunity resume，历史投递按用户确认后留存。详见 [统一简历包](docs/resume-packages.md)。

日常云同步用 `sync update`（只更新）和 `sync run`（保存、合并、上传），不要每次重写 Git 脚本。`sync overview` 读取本机开关和结果；已启用自动同步时遵从持续授权，否则沿用当轮授权或节点询问。详见 career-git。
