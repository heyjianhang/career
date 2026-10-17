# Skill 专业方法审阅

更新：2026-10-15。流程负责“现在做哪一步”，专门方法负责“这一件事怎样判断和做好”。不能用文件存在、篇幅增加或工具运行成功证明 Agent 已具备专家水平。

| 环节 | 专门方法 | 现在可检查的判断依据 |
| --- | --- | --- |
| 任职与项目资产 | [任职](../.agents/skills/career-employment/references/deep-interview.md)、[项目](../.agents/skills/career-project/references/deep-interview.md) | 主张—依据—权限边界，真实过程与事后复盘分开，未问部分可续接 |
| 母版写作 | [表达方法](../.agents/skills/resume-master/references/writing.md)、[质量复核](../.agents/skills/resume-master/references/review.md) | 贡献选材、动作到价值的依据、交付／使用／业务结果分层，具体改写和错误分级 |
| 岗位定制 | [选材](../.agents/skills/resume-tailor/references/matching.md) | 真实任务、核心主张、互补证据、双向核对；不靠换词制造能力 |
| 公司研究 | [career-company](../.agents/skills/career-company/SKILL.md) | 八类候选因素、证据渠道分工、反证、用户影响、可改变决定的下一问；企查查未配置时使用可用公开资料 |
| 具体简历与 JD 匹配 | [career-match](../.agents/skills/career-match/SKILL.md) | 绑定版本、要求与本版证据、表达遗漏／事实未知／能力差距，补充资产不冒充简历内容 |
| 岗位评价 | [评分 v1](../.agents/skills/career-board/references/job-evaluation.md) | 条件门槛、能力与机会价值分开、0–4 锚点、权重理由、覆盖与未知、敏感性、推荐条件 |
| 考前诊断 | [面试考核](../.agents/skills/career-board/references/interview-assessment.md) | 区分素材、表达、判断依据和能力差距，再选练习 |
| 出题与评价 | [面试考核](../.agents/skills/career-board/references/interview-assessment.md) | 任务—能力—问题—可观察行为，条件式追问、四维锚点、专业正确性单独核验 |
| 练习与复盘 | [面试协作](../.agents/skills/career-board/references/interview.md) | 真实回答反馈、重答、提示程度和迁移检验；模拟、事实与招聘方反馈分开 |

setup、git 继续负责安装、保存、同步；不为凑专家 Skill 数量增加评分表。intake 负责盘点、节奏与事实归属，领域方法由专门入口承接。保持八个用户 Skills，不另建重复数据。

## 不能再只说的几句话

- “用企查查看看公司”：说明要验证哪个判断，结果能支持什么、不能支持什么。
- “岗位很匹配，建议投递”：给实际任务、本人证据、条件及未知。调用模型 API 不能自动当算法训练经验。
- “回答不清晰，要用 STAR”：引用回答，指出缺个人责任、取舍、验证还是表达，再给具体重练。
- “把成果量化”：无统计不能补数字；用真实交付和使用场景表达价值。

[完整虚构案例](../.agents/skills/career-board/references/worked-example.md)串起公司研究、岗位评分和逐题面试，含复算输入及不该继续代答的断点。

## 来源与验证边界

来源和取舍见[方法参考](agent-method-references.md)。采用公开方法的思路，自行编写适合本项目的中文指引与案例；没有整份复制、全局安装外部 Skills，也没有增加外部服务连接。

评分刻度、阈值、覆盖门槛是 career v1 辅助政策，没有真实录用结果校准。脚本验证数学，不验证证据真伪或模型判断。面试量表服务训练，不冒充招聘公司的实际标准。

自动检查涵盖方法随包交付、链接、路线图和评分算术。2026-10-15 已执行首轮独立 subagent 受控模拟，核对实际追问、评分、保存和跨会话续接，见[运行报告](../evals/agent-guidance/runs/2026-10-15/report.md)。发现的续接顺序偏差已进入修正与定向复测；这不证明所有环节达到专家水平。[评估清单](skill-evaluation-cases.md)中未执行的场景仍保留待验证，不把少量组合场景等同于全量通过。
