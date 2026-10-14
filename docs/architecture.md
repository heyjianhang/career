# 当前架构

career 定位为与 Agent 协作的个人求职工作台。开发源码由八个用户 Agent Skills 和一个 npm CLI 组成；已发布 npm 0.2.0 不包含新的 career-board。Skills 提供协作方法，CLI 执行文件校验、版本保存、页面生成、导出和可选同步。模型能力来自用户选择的 Agent 客户端，CLI 不包含模型服务。

## 从源码到个人工作区

```mermaid
flowchart TD
    Source[开发仓库：Skills / TypeScript / 模板] --> Build[npm run build]
    Build --> Package[npm 包：运行代码 + 协作资源]
    Package --> Setup[career setup]
    Setup --> User[独立个人目录]
    User --> Agent[Agent 读取 AGENTS 与 Skills]
    Agent --> Facts[来源 / 事实 / 母版 / 进度]
    Agent --> Content[统一简历内容包]
    Editor[网页编辑] --> Content
    Content --> CLI[career CLI]
    CLI --> Preview[附件 / HTML / PDF / 平台填写稿]
    Facts --> Git[本地 main 历史]
    Content --> Git
    Git -. 用户选择同步 .-> Private[个人 GitHub 私人仓库]
```

`setup` 初始化资料骨架，安装固定版本依赖和工作区指引，返回 `next_reads` 与 `next_action`。Agent 继续处理同步选择与资料收集。重复执行保留用户内容和自定义指引；不同工具版本不会被静默覆盖。

## 源码职责

| 路径 | 职责 |
| --- | --- |
| `.agents/skills/` | 八个用户 Skills 及其参考和模板；另有不随包安装的维护者 Skill |
| `src/cli.ts` | 真实命令、参数解析和 JSON 结果 |
| `src/workspace/` | 安装、环境检查、受管指引、本地历史与 GitHub 同步 |
| `src/agent-api.ts` | 工作区盘点、摘要、内容包校验保存与冲突保护 |
| `src/resumes/` | 统一简历包、字段映射、卡片库、网页编辑与岗位关联 |
| `src/presentation/` | 内容契约消费、模板渲染、分页、集合、本地服务与 PDF |
| `scripts/` | v2 资料工具、构建资源和合成演示 |
| `templates/workspace/` | 用户 AGENTS、Git 忽略规则等起步文件 |
| `templates/context/` | 个人协作上下文起步模板 |
| `schemas/` | 展示内容包的机器契约 |
| `examples/`、`tests/` | 合成资料与可重复检查 |

`npm run build` 生成 `dist/` 和 `resources/workspace/`。发布包采用 `package.json.files` 白名单，安装资源来自这个包，不依赖运行时克隆开发仓库。`.gitignore` 以 `gitignore.template` 打包，初始化时还原文件名。

## 两种协作入口

开发仓库根目录的 `AGENTS.md` 指向项目状态与开发规范；`templates/workspace/AGENTS.md` 安装到用户目录，指向安装、Git 版本与同步、访谈、母版和成品流程。两者不共享个人进度。

用户目录保留来源、事实、母版、候选与冻结版本、内容包和上下文。资料使用 [v2 Markdown 契约](data-model.md)，新成品使用 [统一简历包](resume-packages.md)，旧 career-presentation/v1 保留兼容。Agent 负责从事实选材和写作，CLI 不凭字段缺失生成经历。

## 页面与导出

模板注册表供 CLI、样式选择器和打印快照共同使用。同一内容包可切换样式；照片和链接可选。主预览和打印使用同一分页引擎，构建保存规则、内容与文件摘要，旧构建不随源码改动重写。

预览服务仅监听本机；普通 preview 读取当前简历包，preview --build 提供已有快照。HTML 可单独导出；PDF 通过当前安装版本的 Playwright 浏览器生成。平台稿是可复制内容，不接管招聘网站账号或自动填表。

## 资料版本与同步

本地版本使用独立 `main` 仓库。远程连接限用户可写的 GitHub 私人仓库，使用 GitHub CLI 的登录状态。「更新」先保存本地版本，再获取并安全合并远端；「同步」在更新后上传。合并先在临时副本中校验，冲突时保留双方提交与本地正文，暂停同步。自动同步是默认关闭的本机设置；旧 `sync pull` 命令仍只允许快进。新会话核对资料版本，不自动升级 npm 工具。

完整命令以 `npm run career -- --help --json` 为准。岗位协作 CLI 与 Skill 已在源码实现，见[岗位工作区](opportunities.md)。本地看板通过 src/board 接入共享预览服务，复用岗位文件业务层；Markdown、PDF 和图片在本机阅读。平台登录／投递、Word 导出和 JSON v3 迁移尚未实现。后续范围见[路线图](roadmap.md)。
