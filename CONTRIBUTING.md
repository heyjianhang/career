# 参与贡献

career 同时维护 Agent Skills 和 npm CLI。修改前先读 [AGENTS.md](AGENTS.md) 与[架构说明](docs/architecture.md)，使用合成资料验证。

## 本地开发

需要 Node.js 22+ 与 npm；同步测试还需要 Git。

```sh
npm ci --ignore-scripts
npm test
npm run check:docs
npm run check:example
npm run test:package
```

查看虚构简历演示：

```sh
npx playwright install chromium
npm run demo
```

命令会显示本地预览地址，结束时按 Ctrl+C。示例与构建在 `.cache/` 中，不使用个人资料。

## 按改动选择入口

| 改什么 | 位置与要求 |
| --- | --- |
| 访谈、引导、母版与选材 | `.agents/skills/`；修改相应 Skill 和按需引用，保持真实命令与来源约束 |
| 安装、CLI、同步 | `src/cli.ts`、`src/workspace/`；检查重复初始化、冲突与未保存修改的行为 |
| 简历页面与 PDF | `src/presentation/`；使用统一内容包与模板注册表 |
| 新排版样式 | 先读[模板开发](docs/resume-template-development.md)，验证有照片、无照片和长内容 |
| 字段或数据契约 | `schemas/`、[数据模型](docs/data-model.md)；同步校验、Skills 和合成示例 |
| 新用户入口 | `templates/workspace/`、[安装说明](docs/installation.md)、README 初始化指令 |

构建资源由 `scripts/package-resources.mjs` 生成，不直接修改 `dist/` 或 `resources/`。开发仓库的 AGENTS 管理源码协作；用户 AGENTS 模板管理个人资料协作。修改开始指令时同步 README、docs/installation.md 与 docs/get-started.html，`check:docs` 会检查三处一致。

## 提交前检查

说明解决的问题、最终行为、验证结果和已知限制。新增行为应有能发现实际回归的检查；纯文档改动核对命令、相对链接与发布状态即可。

- CLI、数据或安装流程：运行上面的测试与安装包验证。
- 页面／PDF：补跑 `npm run test:browser`、`npm run test:layout`；链接改动补跑 `npm run test:links`。
- 排版模板：补跑 `npm run test:templates`，查看实际 PDF，核对分页与内容完整性。
- Skills：核对 frontmatter、相对引用和安装后的完整资源。自动测试不能代替访谈行为评测。

Issue、PR、示例和截图使用虚构或已脱敏资料。不要提交用户简历、真实照片、登录凭据、工作区、生成文件或本机绝对路径。新增图片、字体和图标记录来源与许可。

CI 执行基础检查，不自动发布。npm 发布由维护者按 [career-release](.agents/skills/career-release/SKILL.md) 完成；该 Skill 只用于开发仓库，不随 npm 安装。更细的操作和验证范围见[开发说明](docs/development.md)与[验证说明](docs/validation.md)。
