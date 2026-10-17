# 共享数据契约：简历 v2

本文件是当前骨架的权威格式。数据在 `workspace/resume/`；公共模板、规范和示例不参与个人数据扫描。v2 不兼容旧 career-vault 的 v1 路径和全部字段，旧数据应明确迁移，不能只改 schema。

## 归属与资源入口

本文件维护跨 Skill 和工具共用的记录格式、更新关系与校验约定；具体访谈、表达和选材方法由对应 Skill 维护。

- 来源、事实和待补充模板：[career-intake](../.agents/skills/career-intake/SKILL.md)。
- 母版模板与写作方法：[resume-master](../.agents/skills/resume-master/SKILL.md)。
- 版本、平台模板与输出方法：[resume-tailor](../.agents/skills/resume-tailor/SKILL.md)。
- 私人目标和进度：`workspace/context/`，按 [上下文协议](context-protocol.md) 维护，只引用事实 ID。

当前阶段补充维护清单和可读母版预览；既有个人记录路径、稳定 ID、v2 元数据及冻结清单格式保持兼容。JSON v3 迁移尚未实现，不能据此覆盖已有文件。

## 岗位工作区

岗位记录位于个人目录 `opportunities/`，使用独立的 [岗位契约](opportunities.md)。每个稳定 ID 对应一个卡片目录，关联原有简历版本；不改变本文件的简历 v2 或冻结格式。workspace check 与本地 Git 保存同时校验岗位记录和关联。

单岗位的总体匹配数据与详细正文共存于 `analysis/match.md`，元数据遵循 [career-match/v1](../schemas/match.v1.schema.json)。元数据包含所用 JD／简历摘要、逐项证据与权重、必要条件和总体结论；网页按共享锚点评价计算总分与证据覆盖，不写回个人星级。旧纯文字报告仍可阅读，输入变化时标明历史结果。详细约定见 [匹配结果保存方法](../.agents/skills/career-match/references/storage.md)。

首次联系招聘方的派生草稿保存在 `opportunities/<岗位ID>/analysis/outreach.md`，使用 [career-outreach/v1 元数据](../schemas/outreach.v1.schema.json)。它引用所用简历 ID、简历与 JD 的 SHA-256，不复制或反写事实层。岗位「打招呼」页只提取约定标题下的消息正文；更换绑定、输入变更或读取失败时提示核对，保留原稿。生成和复制不改变投递阶段；用户报告已发送的文本另行留存，具体约定见 [打招呼稿保存方法](../.agents/skills/career-outreach/references/storage.md)。

## 展示内容包

新成品使用 `career-resume-package/v1`，Agent 与网页修改同一个 content，平台稿由固定规则生成；见 [统一简历包](resume-packages.md)。事实库和母版继续独立维护，不从 HTML 反解析。

旧 `career-presentation/v1` 是 Agent 从现有 v2 母版／岗位版本生成的派生内容，不替代这三层。包保存在 `resume/presentations/<id>/package.json`，输出在工作区 `build/`。约定见 [成果页契约](presentation.md)，机器结构见 [Schema](../schemas/presentation.v1.schema.json)。真实包引用实际来源路径和摘要；源内容变化后需重新核对并构建。CLI 不反向修改事实与母版，也不将源文件未变等同于内容准确。

内容包、成果页构建和默认样式不参与原 v2 实体扫描／冻结；已冻结版本保持原样。`career.json` 可增加 `presentation.default_theme`（用 `resume themes --json` 查询注册表中的有效样式 ID），其他配置保留。

## 三层所有权


1. `facts/` 保存完整、有依据的事实。新事实和纠正先进入这里，来源在 `sources/`。
2. `master/` 保存成熟表达，引用事实 ID。姓名、公司、学历、日期等默认读取事实层，不能在母版中悄悄改写。
3. `versions/` 保存具体 JD 下的独立完整正文与平台字段稿。版本选择和取舍在内部 `notes.md`，不得混入复制区。

`questions.md` 集中记录未确定信息。回答后先更新事实及来源，再解决问题。没有依据的日期、角色、技能、量化结果不能出现在输出中。个人贡献、团队成果和背景分别表达。

## 维护边界

- 一段经历使用稳定 ID；先查已有记录，避免同一次补充产生重复条目。改标题不改 ID。
- 母版来源变化后做实质核对，保留已打磨文字；不要为了清除提示直接更新 based_on。
- 只润色目标版本不改事实。发现新事实先保存到事实层，再处理关联表达。
- 平台输出与完整简历同属一个版本，改变正文后检查相关字段稿；核对状态不能高于所用模板。
- 已冻结版本保持原样。修订时建立新的版本、JD 与平台稿 ID，并调整引用；`derived_from` 指向原版本。复制旧清单不是新版本冻结。
- 原始材料、内部来源与待确认、编辑评论不直接输出。展示或复制前按明确字段选择内容。

写入后运行对应工作区的校验，报告事实缺口与未核实的平台限制。初始化工具只建立起步记录，不导入旧仓库或生成真实简历。

## 通用格式

`context/progress.md` 是普通 Markdown 大阶段总账，记录本轮范围、阶段、依据与历史；不参与 v2 实体扫描、来源摘要或冻结清单。初始化为旧工作区只补缺失文件，阶段先待核对。`workspace status` 提供读取入口，不返回语义完成判断。项目／任职的详细职业资产仍使用以下事实契约与核心章节，写法见 [职业资产方法](career-assets.md)。

`resume/maintenance.md` 是跨 intake／master 使用的普通 Markdown 维护清单；模块状态、具体经历的进度与母版同步关系、初期完成日期与范围保存在此处。`context/state.md` 只引用当前对象与下一步，`questions.md` 保留具体问题，事实正文不复制到状态文件。

清单模板和操作标准由 [intake 维护方法](../.agents/skills/career-intake/references/maintenance.md) 提供，初期母版完成标准由 [母版保存方法](../.agents/skills/resume-master/references/saving.md) 提供。已有工作区缺清单时初始化只补新文件，所有模块以“未盘点”开始；缺清单不使旧 v2 数据失效。

`resume/master-preview.md` 是按事实与母版索引组合的可读派生产物，在生成母版时由 Agent 写入；不作为第二个事实源。保留并处理用户对预览的直接修改，再更新其来源内容。维护清单和预览均不参与现有实体扫描与自动语义校验，也不计入版本冻结清单；完成状态、引用语义与预览一致性由 Agent 核对。

UTF-8 Markdown，文件头为 YAML。每条记录有 schema、type、唯一稳定 id、updated（YYYY-MM-DD 字符串）。ID 为小写字母起始的字母数字与短横线组合。模板的 `__TODAY__` 和 `*-new` 在使用时必须替换；初始化会替换起步文件日期。仅年份的日期须加引号，例如 "2024"，避免被解析为数字。

null 表示未知，空数组表示尚未录入。经历日期允许 YYYY 或 YYYY-MM，必须是字符串；结束未知不表示至今，只有 is_current: true 表示仍在进行。`updated` 不是锁，也不代表记录已核实。

未知字段与正文保留。基础校验只检查已定义的关键字段，不将未知内容删除。正文核心章节按模板写，额外三级标题或补充段落可保留；当前没有通用 Markdown 前端解析器。

## 第一层 facts

schema 为 career/v2，source_ids 指向 sources 下的 source 记录。每段经历独立文件，名称变化不改 ID。

| type / 目录 | 固定字段（可为 null） | 核心正文 |
| --- | --- | --- |
| profile / facts/profile.md | name、headline、city、phone、email、career_status、links | 个人介绍、补充说明、来源与待确认 |
| education / facts/education/ | school、major、qualification、degree、start、end、is_current | 学习经历、在校成果、来源与待确认 |
| employment / facts/employment/ | company、department、title、employment_type、city、start、end、is_current | 工作职责、工作业绩、补充说明、来源与待确认 |
| project / facts/projects/ | name、employment_id、organization、role、start、end、is_current、links | 项目描述、项目职责、项目过程、项目成果、补充材料、来源与待确认 |
| skill / facts/skills/ | name、category、proficiency、related_ids | 使用经历、相关成果、来源与待确认 |
| language / facts/languages/ | name、proficiency | 使用情况、考试与证明、来源与待确认 |
| certificate / facts/certificates/ | name、issuer、obtained、expires、links | 证书说明、来源与待确认 |

links 为 label/url 对象数组；related_ids 指向事实。学历 qualification 与学位 degree 分开。项目 start/end 为本人参与时间，可另加 project_start/project_end。关联 employment_id 时所属单位默认取任职记录；organization 为没有任职关联的机构名称，两者矛盾需人工核对。

不使用必填技术栈。事实支持详细专业内容，但不由岗位要求或代码存在推定个人能力。

来源为 `sources/<id>/source.md`，schema 为 career-source/v2、type 为 source，有 kind 和 created_at。原件可放同目录；只扫描 source.md，不把原件中的 Markdown 当成数据记录。数字和争议陈述应在正文给出具体来源定位。

questions.md 的 schema 为 career/v2、type 为 questions。正文集中记录问题 ID、关联条目、缺口和状态；不作为对外履历输出。

## 第二层 master

schema 为 career-resume/v2。

`index.md`：type: master-index，包含 profile_id、language 和 sections。sections 每项为 kind/ids，数组顺序即展示顺序；summary、employment、project 指向对应 kind 的 master-entry，education、skill、language、certificate 直接指向对应事实。

`summary.md`、employment/、projects/ 中的条目：type: master-entry；kind 为 summary、employment 或 project；source_ids 指向事实；readiness 为 incomplete/reviewable；based_on 为事实 ID 到文件 SHA-256 的映射。reviewable 必须有来源和真实摘要；摘要不同给出来源变化提示，需要实质核对。

摘要由 `node scripts/hash.mjs <文件>` 计算。初版按整份事实文件追溯；不强迫每个 bullet 创建独立 ID。组合案例须保留全部关联，不自动合并日期或将团队成绩改为个人独立成果。

## 第三层 versions

每个版本目录包含 resume.md、target.md、notes.md，以及按需创建的平台稿和附件目录。

| 文件 | 元数据 |
| --- | --- |
| resume.md | type: resume-version；source_master_id、target_id、target_job_id、generated_at、language、state、readiness、platforms、derived_from |
| target.md | type: resume-target；company、title、source_url、captured_at |
| platforms/*.md | type: platform-output；resume_id、template_id、template_revision、generated_at、verification_status |
| notes.md | 内部普通 Markdown，不参与实体扫描和对外输出 |

旧 v2 岗位版本的平台填写稿保存为 `resume/versions/<版本 ID>/platforms/<平台 ID>.md`，一平台一文件。YAML 元数据和字段标题留在代码块外；一个输入框对应一个 `text` 围栏代码块，块内只含可粘贴的纯文本，不使用 Markdown 排版、字段标签、占位符或 Agent 说明。多段经历独立分组，缺失字段和映射损失记录在 notes.md，不生成空复制块。具体方法与示例见 [平台填写约定](../.agents/skills/resume-tailor/references/platform-templates.md)。此格式用于新建和明确更新的草稿，已有冻结版本保持原样。

以上有元数据的文件均为 career-resume/v2，并有稳定 ID 与 updated。generated_at、captured_at、created_at 等使用带时区的时间戳；生成的岗位版本必须记录 generated_at。target_id 必须指向本目录的 JD 记录；未来岗位系统引用使用 target_job_id，当前可以为 null。

state 为 draft/frozen；readiness 为 incomplete/reviewable。两者独立，留存不表示已完成或已投递。所有版本、JD 和平台稿的 ID 在工作区内唯一。

resume.md 正文展开当次所有内容，不只有外部引用。platforms 保存 template 平台标识数组，例如 generic、zhaopin；每个已登记平台必须有对应填写稿。平台稿的核对状态与模板一致，draft 不能自称 verified。

## 留存

`freeze.mjs` 明确将已有草稿留存，写入 frozen_at 与 manifest.json；会保留原正文并冻结元信息。清单包含版本内文件摘要、当时母版／事实／来源摘要和模板修订信息，不包含自己。当前实现记录主母版完整依赖作为上下文，不声称其中每个条目都被该目标版本采用；具体选材见 notes.md。

再次留存已冻结且有效的版本不改写。正文、字段稿或附件变化会导致校验失败；上游事实后续变化不改写冻结版本。人工编辑仍能改变文件，工具提供检测而非文件系统写保护。

冻结工具使用锁文件与单文件原子替换，但不是跨文件数据库事务。异常断电留下锁、草稿清单或不一致文件时，先人工核对和恢复，不直接删除证据或重新计算清单掩盖差异。留存前由 Agent 将本地输出依赖复制到版本目录；外部网站内容不在冻结范围。

## 基础校验覆盖

检查 YAML、版本、ID、关键字段类型、日期、文件位置、引用类型、母版基线、平台稿关系和冻结文件摘要。未覆盖：履历真实性、全部自然语言中的字段一致性、平台真实字数规则、附件语义以及模型访谈质量。章节与内容取舍由 Skill 和人工复核；未来增加解析器时再补充相应测试。

### 展示包的通用资料与网页链接

事实层原有 profile/project 的 `links: [{label,url}]` 继续使用，不迁移 v2。用户选择对外展示的个人链接进入 `resume.contacts[].url`，项目链接进入 `resume.sections[].items[].links`；未选定展示的核对材料保留在来源层。展示包新增可选 `common.sections[].fields`（label/value/url?）供四平台共用，技能、证书与语言按事实写作；求职期望不纳入这一适配范围。完整字段以 presentation.v1.schema.json 为准。
