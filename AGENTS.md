# career 开发仓库

此目录用于开发、测试和发布 `@heyjianhang/career`，不作为用户职业资料库。

先读取 [项目上下文](docs/context.md) 和 [开发说明](docs/development.md)，核对实际文件及未提交改动。实现只在用户授权范围内；保留已有代码和私人文件，用合成工作区验证。

对外入口在 README 与 CONTRIBUTING；当前资料见 [文档导航](docs/README.md)。[品牌定位](docs/brand.md)描述完整求职范围，[路线图](docs/roadmap.md)区分当前能力与后续模块。

- CLI 与展示：src；初始化和 v2 工具：scripts；可发现的方法：.agents/skills。
- 用户入口模板：templates/workspace/AGENTS.md。构建时 scripts/package-resources.mjs 生成完整安装资源，安装到用户自己的目录。
- 命令以 `npm run career -- --help --json` 为准。开发时先 npm run build，所有数据操作显式传 --workspace 指向独立的测试目录。
- 用户要求使用本工具整理履历时，在源码目录外执行 setup，再读取其返回的用户 AGENTS；不要把开发仓库转成个人数据仓库。
- 新增样式按 [模板开发](docs/resume-template-development.md)。新增数据规则同步 Schema、Skills 和合成测试，不修改真实经历或冻结版本。
- npm 包采用 files 白名单，禁止包含 workspace、构建示例、测试报告、参考截图或登录凭据。发布前从打包产物验证，不能仅以源码环境通过作为可发布证据。
- 改动 Skills 时使用明确任务路由、实际 CLI 命令和完整可安装的引用；检查安装后的链接，不只查源目录。
- GitHub 同步只面向用户自己的私人仓库：新会话检查资料更新，大节点按本轮授权或本机自动同步开关执行，未授权时询问上传。开发仓库不沿用个人 main 自动保存规则。
- 新版本准备、npm 发布、门户版本同步或主分支保护检查，先读 [career-release](.agents/skills/career-release/SKILL.md)；此维护者 Skill 不安装到个人工作区。
- 提交、推送和 npm 发布遵循本轮用户授权。账号登录不等于产物已经发布；只有成功回执和下载验证才报告发布完成。
