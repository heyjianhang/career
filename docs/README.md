# 文档导航

## 使用 career

- [开始使用](../README.md#开始使用把这段发给-agent)：可直接发送给 Agent 的初始化指令。
- [Agent 安装指南](../install.md)：确认位置、安装验证和工作区新对话交接。
- [llms.txt](../llms.txt)：独立于门户的 Agent 文档导航。
- [本机工作区与设置](workspaces.md)：命名、创建、打开、切换与独立文件夹。
- [安装说明](installation.md)：环境、安装命令、同步和换机入口。
- [指令复制页](get-started.html)：下载后用浏览器打开；GitHub 文件页显示源码。
- [Skills](../README.md#skills-与-cli-怎么配合)：安装、Git 版本与同步、收集、母版、成品的分工。

## 产品与方向

- [品牌定位](brand.md)：目标用户、产品范围与统一表达。
- [产品路线图](roadmap.md)：经历与简历、岗位分析、求职跟踪与复盘。

## Agent 引导与方法

- [可视化协作路线图](agent-roadmap.md)：从 Agent 接手到资料整理、简历、岗位与面试，点击阅读真实 Skills。
- [引导与推进规则](agent-workflow.md)：当前工作单元、转段条件、快速草稿和断点续接；随包安装到用户工作区。
- [阶段进度模板](../templates/context/progress.md)：本轮范围、六个大阶段、依据与转段历史，初始化时写入个人目录。
- [职业资产写作](career-assets.md)：详细事实、关键事件、复盘、来源与简历表达的分层。
- [任职资产 Skill](../.agents/skills/career-employment/SKILL.md)、[项目资产 Skill](../.agents/skills/career-project/SKILL.md)：分别负责深挖与落盘。
- [方法参考与取舍](agent-method-references.md)：已阅读的公开 Skills、采用方式及尚待行为验证的部分。
- [Agent 多轮模拟套件](../evals/agent-guidance/README.md)：隐藏用户背景、隔离工作区、逐轮输入与文件证据；[首轮运行报告](../evals/agent-guidance/runs/2026-10-15/report.md)。

## 开发和贡献

- [贡献指南](../CONTRIBUTING.md)：本地开发与提交前检查。
- [架构](architecture.md)：Skills、CLI、用户目录和构建的实际关系。
- [桌面版与安装包构建](desktop.md)：随包 CLI／Skills、Agent 交接、四种安装包与签名。
- [开发说明](development.md)：运行命令、CI 和打包维护。
- [版本发布 Skill](../.agents/skills/career-release/SKILL.md)：版本同步、Git／npm 发布、安装验证及主分支保护。
- [门户与托管](portal.md)：官网首页、访问／下载统计、版本管理后台、腾讯托管和域名接入。
- [项目状态](context.md)：当前实现与尚未验证的部分。
- [验证范围](validation.md)、[Skill 行为场景](skill-evaluation-cases.md)。

## 数据与排版契约

- [岗位工作区、CLI 与看板设计](opportunities.md)、[career-board Skill](../.agents/skills/career-board/SKILL.md)。

- [我的资料页面](personal-materials.md)：个人经历、求职偏好和协作记录的直接阅读入口。
- [资料与母版数据模型](data-model.md)、[持续协作上下文](context-protocol.md)。
- [简历内容包、页面与 CLI](presentation.md)、[JSON Schema](../schemas/presentation.v1.schema.json)。
- [样式目录](resume-templates.md)、[新增排版模板](resume-template-development.md)。
- [第三方与演示素材](assets.md)。

[资源归属决定](decisions/001-resource-ownership.md)说明 Skill 与开发文档的边界；[方法与设计参考](references.md)保留来源与采用范围。当前命令始终以实际 CLI 为准。

- [统一简历包与岗位关联](resume-packages.md)：网页／Agent 共用正文，平台映射、实时编辑和投递快照。

- [Skill 专业方法审阅](expert-methods.md)：公司研究、岗位评分、面试考核与写作的具体判断依据。
