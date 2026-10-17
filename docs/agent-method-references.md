# 引导与职业资产方法参考

核对日期：2026-10-15。先用 find-skills 搜索目录，再阅读原仓库 Skill／方法文件。这里记录方法取舍，不把安装量或仓库星数当成效果验证。本次未安装第三方 Skills，未引入远程 MCP；career 的指引按自身文件契约重新编写，原文未整体打包。

| 已阅读的来源 | 可借鉴的经验 | 在 career 中的取舍与位置 |
| --- | --- | --- |
| [career-ops-hq：经历访谈](https://github.com/career-ops-hq/career-ops/blob/main/modes/interview.md) | 读取已有背景，逐题深入具体经历 | 保留逐题节奏；不因获得几条可写简历的素材就结束。项目和任职分别由两个专门 Skill 负责 |
| [poferraz/career-ops：职业协作](https://github.com/poferraz/career-ops/blob/main/SKILL.md) | 倾听经历、具体事例与可迁移能力，跨会话保留信息 | 保留真实事例与用户语言；不强制先做情绪或职业方向访谈，也不用统一分数决定完成 |
| [OpenAI：knowledge capture](https://github.com/openai/skills/blob/main/skills/.curated/notion-knowledge-capture/SKILL.md) | 区分记录类型，留下决策理由、来源和关联，更新旧记录 | 用本地 Markdown 与稳定 ID 实现；不引入 Notion。资产正文保存决策上下文，状态文件只保留引用 |
| [phuryn/pm-skills：retro](https://github.com/phuryn/pm-skills/blob/main/pm-execution/skills/retro/SKILL.md) | 从真实过程理解阻碍、协作与改进，回看上次行动 | 在任职／项目正文保留复盘和限制；不强套 Scrum、速度指标或固定回顾表格 |

本地还对照了 resume-bullet-writer 与 resume-version-manager：前者可帮助区分动作与成果，后者强调可复用母版。职业资产层不采用“每条必须有数字”或 Agent 为效果估数的要求；母版也不作为唯一事实来源。

## 本项目采用的组织方式

1. **阶段总账**：`context/progress.md` 记本轮范围、阶段、依据和历史，state 只接续当前一问。不是让用户手工管理流程。
2. **专门方法**：career-intake 盘点与统筹；[career-employment](../.agents/skills/career-employment/SKILL.md) 负责公司任职；[career-project](../.agents/skills/career-project/SKILL.md) 负责项目资产。
3. **资产写作**：[职业资产方法](career-assets.md) 保留背景、角色边界、关键事件、真实选择、行动、交付、来源与局限。可用于后续多种任务，不仅是简历亮点。
4. **按范围转段**：[共同规则](agent-workflow.md) 要求本轮纳入范围核对后再写母版。快速草稿依用户请求例外处理，仍记录没整理完的部分。
5. **表达和使用**：resume-master 提炼表达，resume-tailor 组织成品，career-board 根据已有资产做岗位分析与面试。下游发现新事实先回事实层，不让分析结论伪装成用户经历。

## 本轮领域方法的新增参考

以下在 2026-10-15 阅读原始来源。搜索排名、作者自称专家不作为效果证明。来源中未采纳的要求不成为 career 规则；评分、阈值和案例由 career 自行设计。改动入口见[方法审阅](expert-methods.md)。

| 原始来源 | 借鉴什么 | 改进／不采纳 | 落地 |
| --- | --- | --- | --- |
| [Dean Peters / company-research](https://github.com/deanpeters/product-manager-skills/blob/main/skills/company-research/SKILL.md) | 业务、组织、信息来源分层 | 改为求职决定；不强制产品驱动增长或 AI 转型栏目 | company-research.md |
| [OPM / Job Analysis](https://www.opm.gov/policy-data-oversight/assessment-and-selection/job-analysis/) | 任务与能力对应 | 不凭头衔推定工作，不照搬美国职位分类 | job-evaluation.md、interview-assessment.md |
| [OPM / Structured Interviews](https://www.opm.gov/policy-data-oversight/assessment-and-selection/other-assessment-methods/structured-interviews/) | 行为／情景问题与评价锚点 | 用于训练，不预测录用；未观察保留未知 | interview-assessment.md |
| [OPM / scoring FAQ](https://www.opm.gov/frequently-asked-questions/assessment-policy-faq/structured-interviews/how-do-i-score-a-structured-interview-how-do-i-assign-points-to-the-content-areas-and-rating-scale/) | 评分与权重需要依据 | 自定权重不说成行业标准，面试不强制合成总分 | 评分与面试方法 |
| [philpalmieri / interview-prep](https://github.com/philpalmieri/engineering-manager-skills/blob/main/skills/management/interview-prep/SKILL.md) | 简历主张驱动出题，说明追问目标 | 不硬性要求失败题，不把信息空白当人格问题 | 面试蓝图、追问与角色示例 |
| [qijin-3 / interview-coach](https://github.com/qijin-3/qi_Skills/blob/main/skills/career/interview-coach/SKILL.md)及其 prep 参考 | 先诊断再训练，跨次记录 | 不强制数字成果／录用标签，不建重复状态库 | 诊断、反馈重练、提示程度 |
| [Government Analysis Function / MCDA](https://analysisfunction.civilservice.gov.uk/policy-store/an-introductory-guide-to-mcda/) | 显式目标、权重、敏感性 | 简化辅助；未知另算覆盖，底线不由高分抵消 | 评分 v1、纯计算脚本及案例 |
| [Harvard MCS / Resume guide](https://careerservices.fas.harvard.edu/resources/hes-create-impactful-resumes-and-cover-letters/) | 具体、事实、清晰、目标相关 | 不套美国照片习惯，不强制无依据量化 | 母版写作／复核、定制选材 |

公开资料会变化，未来改方法时核对原文并记录采用／拒绝的部分。它们的权威性不等于对 career 的认证。

2026-10-17 补充研究 [paramchoudhary/resumeskills 的 job-description-analyzer](https://github.com/paramchoudhary/resumeskills/blob/main/skills/job-description-analyzer/SKILL.md)，用于独立 [career-match](../.agents/skills/career-match/SKILL.md)。采用要求分层、差距分类与行动排序；不采用固定 70/30 权重、词频推断硬要求或高匹配等于过度匹配。继续沿用 career 可解释的证据锚点与未知规则，并增加“指定简历版本”和“补充资产不是本版已写内容”的边界。公司方法迁入独立 [career-company](../.agents/skills/career-company/SKILL.md)，原 board 引用保留兼容入口。

## 如何判断是否真的更好

文档连通、模板安装和 CLI 检查只能证明规则可获得。是否真正做到慢慢追问、留下充分事实，需要用 [评估场景](skill-evaluation-cases.md) 的多轮对话核对；不能将文档检查通过当成 Agent 行为已经验证。本轮补充的阶段与深度场景保留人工评估入口。
