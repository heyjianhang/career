# 项目状态

更新：2026-10-13。用于开发续接；用户履历进度保存在各自个人目录的 context 和 resume 中。

## 项目定位

career 是与 Agent 协作的个人求职工作台，覆盖经历整理、简历准备、岗位分析、求职跟踪与复盘的产品方向。当前先完成经历与简历模块；品牌口径见[品牌定位](brand.md)，阶段划分见[路线图](roadmap.md)。

开源交付物是 Agent Skills 与 `@heyjianhang/career` npm CLI。用户把开始指令发给 Agent，在独立目录整理资料、维护母版和生成简历；开发仓库只维护程序、方法和合成示例。

`@heyjianhang/career@0.2.0` 已于 2026-10-13 正式发布到 npm，公开访问，latest 指向 0.2.0。已从官方 registry 使用空缓存执行 README 的 npx 初始化指令，验证独立目录、五个 Skills、14 款样式、doctor、工作区校验与 HTML 生成。发布归档完整性与本地检查产物一致，见[发布记录](releases/0.2.0.md)。开发源码仓库为公开的 [heyjianhang/career](https://github.com/heyjianhang/career)，三种系统的 Node 22 CI 已通过。

## 已实现

- 五个 Skills：career-setup、career-git、career-intake、resume-master、resume-tailor。安装后含完整参考和模板；开发 AGENTS 与用户 AGENTS 分开。
- 独立目录 setup、doctor、Skills 安装与修改保护；默认固定工具版本，按需安装 PDF 浏览器。重复 setup 尊重已选保存方式，已连接时返回检查同步，不再次询问。
- 对外开始指令只负责安装与初始化，工作区 AGENTS 衔接下一步；career-git 统一逐步建仓引导、首次提交与日常同步规范。
- 来源／事实／母版／待补问题／上下文采用 v2 Markdown；展示内容包采用 career-presentation/v1。来源摘要和冲突检查支持内容更新与旧版本保留。
- 14 款简历样式、本地简历集合、默认样式、分页预览、HTML／PDF、可选照片与可点击链接。
- BOSS、智联、猎聘、前程无忧的主要经历字段稿；技能、证书、语言等作为通用资料提供。求职期望属于求职目标，不阻塞简历生成。
- 本地 main 版本；可选私人仓库连接、状态检查、快进拉取、显式推送与换机恢复。大节点先本地保存，再按用户授权上传。

## 验证证据与限制

2026-10-13，[首次通过的 CI](https://github.com/heyjianhang/career/actions/runs/38360490634)在 macOS、Windows、Linux / Node 22 全部成功：每个平台均通过 60 项 Node 测试、文档检查、合成样例检查和真实安装包验证。合成 v2 样例 15 条记录、0 错误、2 个预期提示。真实 tgz 完成独立安装、重复初始化、HTML 生成与本地 Git 保存；五个 Skills 和 142 条安装资源引用通过检查，README／安装说明／指令复制页内容一致。此前还从安装包完成过 PDF 导出；本轮未修改排版，未重复浏览器或 PDF 矩阵。

README 按完整求职方向、当前能力、开始指令和开发入口组织。早期重复提案与逐轮记录移出源码目录；仍有效的规划合并到路线图，来源保留在 references。CI 检查文档与安装资源引用，不自动发布。

既有浏览器检查覆盖样式库、默认设置、版本切换、可选照片、可复制字段、离线页面和分页；模板矩阵覆盖有照片／无照片／长内容。验证方法见[验证说明](validation.md)。

首次 CI 暴露安装包测试强制离线导致全新缓存缺少 npm 元数据的问题，已修复并用本地空缓存和三平台 CI 验证。

尚待验证：真实 GitHub 私人仓库完整流程、不同 Agent 客户端的发现与独立访谈质量。Git 同步自动测试使用本地 bare 仓库，不能替代 GitHub 登录和建仓验收。

## 当前边界

CLI 不调用模型，不自动注册账号、创建 Agent 会话或合并分叉。不包含求职看板、招聘平台自动填表／投递、Word 导出、多方向母版或 JSON v3 迁移。四个平台没有宣称覆盖全部表单字段与提交校验。

私人资料、生成文件和本机验收附件不进入开源仓库或 npm 包。合成示例保留明确标记，数据和自然语言质量分别验证。

## 接手入口

先检查实际文件和未提交改动，再读[开发说明](development.md)与[架构](architecture.md)。执行接口看 CLI help；Skills 与数据规则按当前任务读取。后续方向读[路线图](roadmap.md)，来源读[参考](references.md)；规划不作为当前实现。
