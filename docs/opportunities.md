# 岗位工作区与看板

开发中的岗位模块以文件为数据源，CLI、career-board Skill 与本地看板共用一份岗位资料，已接入现有简历服务。本模块未随 npm 0.2.0 发布。

## 一张卡片，一个目录

```text
career-workspace/
├── context/                    # 用户目标、跨岗位进度
├── resume/                     # 原有事实、母版及版本
└── opportunities/
    └── opp-<稳定ID>/
        ├── card.md             # 少量元数据 + 当前判断、决定、信息缺口
        ├── job.md              # 招聘正文、采集来源与时间
        ├── notes.md            # 用户笔记
        ├── tasks/task-<id>.md  # 协作待办、依赖、结果
        ├── analysis/           # 匹配、公司等分析，按需创建
        ├── interviews/
        │   ├── interview-<id>/ # 每轮独立目录
        │   │   ├── record.md   # 轮次元数据 + 自由记录
        │   │   ├── preparation.md  # 按需创建
        │   │   └── simulations/    # 每次模拟独立 Markdown
        │   └── general/        # 无真实轮次的通用准备／模拟
        ├── activity/           # 变更回执及带证据类别的事件
        └── attachments/        # PDF、图片等原件副本
```

只创建用到的文档。目录 ID 不随职位名称或阶段改变，不按看板列移动目录。同公司不同职位分卡，同一职位的跨平台来源可合并到 sources；新一轮申请另建卡并关联上一轮。CLI 提示相同 URL／平台 ID 的候选重复，不自动判断或合并。

## 数据与所有权

机器契约在 [opportunity.v1.schema.json](../schemas/opportunity.v1.schema.json)；运行 `opportunity schema --json` 返回同一 Schema、枚举与输入示例。card/task/interview/activity 使用各自 v1 YAML frontmatter，正文自由 Markdown；这是岗位子域格式，原简历 v2 无迁移。未知元数据在更新时保留，自定义补丁放 extensions。

- 公司、职位必需；城市、薪资可空，薪资保留币种、周期及来源口径，暂不生成误导性的归一化数字。
- sources 支持 boss/liepin/job51/zhaopin/website/referral/other；网址与平台 ID 可选，其他来源可加 label。captured_at 为采集时间，不能冒充发布时间。
- stage：inbox 待评估、preparing 准备投递、applied 已投递、interviewing 面试中、offer、ended 已结束。允许跳阶段；ended 的 outcome 为 rejected 未通过、withdrawn 主动放弃、closed 岗位关闭或 hired 已入职。
- archived 为独立布尔值。归档／恢复不改变阶段与结果，不取消未完成任务。详细原因留在 Markdown；旧 archived_reason 保留。
- 旧 contacting 读取为 applied；旧 archived 读取为 ended + archived，保留 legacy_stage，未知结果显示待确认。读取不改原文件，显式更新才保存新字段；新建或补丁不再接受旧阶段。
- user_rating 为用户偏好 1–5 星或 null，只能通过专用 rate 命令更新；Agent recommendation 另存评级、理由、证据和评估时间。
- next_action 包含标题、责任方 user/agent/employer、可选到期日期；日期按 career.json 时区展示，没有时间的日期不推断具体小时。
- links 关联岗位内部文档、简历文件和其他岗位；任务另有同岗位 depends_on。CLI 检查存在性、循环依赖、可选内容摘要，冻结版本保持原样。
- task 区分待处理、执行中、等待用户、等待外部、完成、取消；完成有 outcome，产物链接使接手者知道结果在哪里。assigned_to 是协作标识，不是自动排程或认证锁。
- 活动区分用户陈述、招聘方消息、Agent 分析、模拟面试、真实面试。模拟练习不改变求职阶段，不自动写入个人经历事实。

## 给所有 Agent 的统一视图

| 命令 | 回答的问题 |
| --- | --- |
| board overview | 全部岗位在哪里、处于什么阶段、有哪些待办和衔接关系？ |
| opportunity list | 某来源、阶段、评分或关键词的机会有哪些？ |
| opportunity show | 单个岗位的卡片、全部文件、任务、关联和近期动态是什么？ |
| opportunity context | 新会话应先读什么，未完成什么，下一步是谁做？ |
| interview list / context / save | 有哪些真实轮次、某轮如何接手、怎样保存记录？ |
| opportunity read | 某份 Markdown 的完整内容与更新摘要是什么？ |
| board check | 有没有坏记录、缺失关系、陈旧摘要或循环依赖？ |

初次上下文正文有总预算，截断明确标记，文件仍可逐个读取；PDF 与图片只列目录，Agent 按需使用自己的读取工具。全局关系包含卡片／任务／活动的显式链接、任务依赖、文件归属。多个岗位可关联同一简历文件，从关系列表即可定位。

原 `workspace status/check` 包含岗位校验；原 `history save` 把岗位文件纳入本地 Git 留存与校验。整体上下文仅引用岗位 ID 和下一步，不复制所有岗位内容。Skill 的操作方法见 [career-board](../.agents/skills/career-board/SKILL.md)。

## 写入与恢复

更新现有卡片、任务和文档必须传 SHA-256。CLI 使用工作区操作锁，与 Git 保存、同步互斥；目标文件通过临时文件替换。普通变更与活动回执之间用可恢复事务衔接，进程中断时停止普通读取／写入，`board recover` 核对旧／新摘要后继续。遇到不同摘要保留现场，不覆盖外部修改。工作区锁遗留必须先确认原进程结束；工具不会强行抢锁。

用户或其他程序绕过 CLI 直接改文件时，仍需重新读取和 board check；文件系统操作不是对所有外部编辑器的数据库级事务。附件不执行、不自动上传；恢复、同步仍遵循既有 Git 规则。文档 2 MiB，附件 24 MiB；大媒体应另存并记录位置。

## 看板与文档阅读

个人工作区运行 `npm run career -- board preview --open --json`。本机服务的 /board 为看板，/ 为简历；没有简历仍可使用看板。左侧导航可折叠，生成的离线简历不显示本机看板链接。

阶段列展示卡片，支持关键词、来源、最低星级和归档筛选。卡片保留公司、职位、城市／薪资、我的星级、来源与下一步。卡片统一高度，已关联简历标记放在标题右侧。桌面支持将卡片拖到另一阶段列，目标列高亮、边缘自动滚动；仅保存成功后移动，失败或摘要冲突时读取最新状态。拖到“已结束”时选择结果，取消不更改阶段；已归档卡片不能拖动，同列拖动不重排。移动端与键盘用户仍可通过详情的阶段菜单操作。选择卡片打开右侧抽屉，可展开阅读，拖动左边缘或用方向键调宽，保存到 `.local/ui-preferences.json` 的 board.drawer_width。窄屏自动全宽，放大／缩小窗口不覆盖桌面偏好；该设置不参与 Git 同步。Esc 或关闭按钮逐层返回：退出展开 → 面试详情返回轮次列表 → 关闭抽屉。

| Tab | 数据来源 | 展示方式 |
| --- | --- | --- |
| 岗位概况 | card.md 正文 | 当前判断、信息缺口、决定与下一步，直接阅读 Markdown |
| 公司分析 | analysis/company.md | 按需撰写的公司分析，直接阅读 Markdown |
| 岗位匹配 | analysis/match.md | 结合真实经历的匹配分析，直接阅读 Markdown |
| 面试 | interviews/interview-<id>/ | 先显示轮次列表，进入一轮后阅读记录、准备材料、模拟记录 |
| 资料 | 整个岗位目录 | 文件树 + 阅读器，包括上述同一文件及额外笔记、面试与附件 |

主要 Tab 不展示文件树或大量任务表单；分析正文没有固定提纲，用户与 Agent 可按需要组织。责任、依赖明确的工作仍可使用 CLI 任务；普通分析与协作以连贯文档为主。缺失的主要文档显示“复制整理指令”，交给 Agent 完成，页面不伪造分析结果。

Markdown 支持标题目录、预览／源文、表格、本岗位相对文件链接与下载；源文保留 frontmatter。资料中的 PDF 使用随包 PDF.js 阅读，支持翻页、缩放、适应宽度；图片支持缩放，其他格式可下载。不会执行原始 HTML 或加载外部图片。所有预览资源本地提供，不上传岗位资料。

页面写星级与阶段时检查当前文件摘要，复用 CLI 锁与变更回执；冲突重新读取；归档只收纳，选择已结束时选择实际结果。页面可以添加／编辑面试轮次的名称、日期与状态，正文由用户或 Agent 维护。每 15 秒、窗口返回及手动刷新时检查资料，未变化的文档保留阅读位置。“复制协作指令”携带工作区与岗位 ID，调用同一 context 命令，供其他 Agent 接手。

面试元数据为稳定 ID、自由名称、可选日期与 planned/completed/cancelled 状态，记录在 record.md；准备和模拟均按需创建，模拟可多次分别留存。没有邀请也可在 interviews/general 下练习，不创建真实轮次。轮次保存不自动推进岗位阶段。CLI 接手视图包含轮次、文件和待进行面试，具体命令见 [操作说明](../.agents/skills/career-board/references/cli.md)。

招聘平台导入、专用模拟面试 Skill、跨岗位复盘和自动评分仍后续独立扩展。当前看板不是招聘平台自动投递工具。
