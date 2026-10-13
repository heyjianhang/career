# 验证范围

先用 Node.js 22+ 安装锁定依赖：`npm ci --ignore-scripts`。测试均使用临时目录或合成示例，不扫描个人资料。项目当前状态见 [context](context.md)。

## 自动检查入口

| 命令 | 验证范围 |
| --- | --- |
| `npm test` | 构建、工作区初始化、v2 引用与冻结、展示内容包、CLI 子进程、安装指引、本地 Git 和同步保护 |
| `npm run check:example` | 合成 v2 资料在当前规则下的有效性，包含既有预期提示 |
| `npm run check:docs` | 源码文档、五个 Skills、构建后的安装资源引用，以及初始化指令的一致性；先运行 build 或 npm test |
| `npm run test:package` | 真正打包为 tgz，独立安装后执行初始化／重试、Skills 资源检查、HTML 构建和本地版本保存 |
| `npm run test:browser` | 成果页、样式选择、平台切换、复制、下载、离线页面与长文导出 |
| `npm run test:layout` | 空状态、侧栏折叠、固定控制区、移动端与预览分页 |
| `npm run test:templates` | 各样式的有照片、无照片、长内容 PDF 及内容保留 |
| `npm run test:links` | 14 款样式的 PDF 链接、通用资料复制和照片下载 |

浏览器检查先运行 `npx playwright install chromium`，产物在忽略的 `.cache/` 内。`test:package` 从 npm 缓存离线安装，需先 npm ci；它不注册账号、不访问 GitHub、不发布 npm。

[CI](../.github/workflows/check.yml) 在三种系统上运行构建／Node 测试、文档检查、合成资料检查和安装包检查。浏览器／PDF 与模型行为不在该基础矩阵内。

## 已有证据及边界

2026-10-13 的 macOS / Node 26 本地验证覆盖 60 项 Node 测试；合成 v2 示例为 15 条记录、0 错误、2 个预期提示。本轮实际 tgz 通过安装、初始化／重试、五个 Skills 的 142 条引用、HTML 生成与本地版本保存。此前还完成过包内 PDF 导出，本轮初始化与 Git Skill 调整未重复浏览器矩阵。历史浏览器与模板记录只代表使用的合成样例，不承诺任意内容都能一页排完。

Git 自动测试使用本地 bare 仓库模拟双设备，验证快进、未保存修改和分叉保护。GitHub 私人仓库的权限拒绝逻辑有测试；注册、登录、建仓、推送与换机恢复的真实远程流程尚未整体验收。Windows／Linux 与 Node 22 的远程 CI 首次运行也尚待验证。

五个 Skills 的 frontmatter 和引用能自动检查。[Skill 行为场景](skill-evaluation-cases.md)尚未运行独立模型评测；没有把预写合成资料当作 Agent 自主访谈和写作效果的证据。不同客户端的 Skills 自动发现也需实际验证。

## 自动检查不能证明什么

来源摘要用于发现文件变化，不能证明自然语言真实、个人贡献归属或正文完整。照片与链接校验不判断素材授权或网页内容。平台规则覆盖主要经历字段，通用资料由用户匹配控件；未验证各平台全部必填、枚举与提交行为。

context 和维护清单是普通 Markdown，工具不推断其语义完成状态；Agent 仍须对照材料更新。冻结摘要可检测外部修改，不能阻止编辑器改写文件；中断或冲突后先核对实际内容，不重建摘要来掩盖差异。

页面和结构测试、模型行为评测、真实平台验收分别报告。只把实际执行成功的检查写进交接。
