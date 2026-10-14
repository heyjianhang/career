# CLI 操作与成果页交付

在个人工作区使用 `npm run career --` 调用固定版本；命令以 `--help --json` 为准。首次环境准备见 [career-setup](../../career-setup/SKILL.md)。开发源码仓库先按开发说明构建，普通用户无需构建源码。

缺 PDF 浏览器时运行 `npm run career -- runtime install --component pdf --json`。各命令使用同一工作区；显式 --workspace 优先，否则从当前目录向上寻找 career.json。写作见 [生成成果页](presentation.md)，结构通过 resume schema 读取。

## 常用命令

| 意图 | 命令 |
| --- | --- |
| 新建／复制简历包 | `npm run career -- resume create --title "方向 · 通用版" [--from <ID>] --json` |
| 读取待编辑包 | `npm run career -- resume read --id <ID> --json` |
| 查看关联岗位与投递记录 | `npm run career -- resume relations --id <ID> --json` |
| 看实际能力 | `npm run career -- --help --json`；`npm run career -- resume save --help --json` 看单条 |
| 工作区盘点 | `npm run career -- workspace status --workspace "<工作区>" --json` |
| 初始化或补缺 | `npm run career -- workspace init --workspace "<工作区>" --json` |
| 校验事实、母版、v2 版本 | `npm run career -- workspace check --workspace "<工作区>" --json` |
| 来源／照片／已有内容包摘要 | `npm run career -- workspace hash --path "<工作区内相对路径>" --workspace "<工作区>" --json` |
| 内容格式与示例位置 | `npm run career -- resume schema --json` |
| 平台字段 key、限制和核对范围 | `npm run career -- resume platforms --platform <平台ID> --json`；省略 platform 返回四平台 |
| 保存 Agent 写好的候选 | `npm run career -- resume save --input "<候选.json>" --workspace "<工作区>" --json` |
| 更新已保存内容包 | 上条加 `--if-match <写候选前读取的原包SHA-256>` |
| 样式 ID、版本和照片支持 | `npm run career -- resume themes --json` |
| 检查内容与来源摘要 | `npm run career -- resume validate --input "<内容包>" --workspace "<工作区>" --json` |
| 列出可用内容包和问题 | `npm run career -- resume list --workspace "<工作区>" --json` |
| 查看默认样式 | `npm run career -- resume preferences --workspace "<工作区>" --json` |
| 设置默认样式 | `npm run career -- resume preferences --workspace "<工作区>" --theme <样式ID> --json` |
| 取消默认 | `npm run career -- resume preferences --workspace "<工作区>" --clear --json` |
| 生成全部内容包的 HTML 集合 | `npm run career -- resume build --collection --workspace "<工作区>" --json` |
| 只构建当前内容包 | `npm run career -- resume build --input "<内容包>" --workspace "<工作区>" --json` |
| 生成并启动本地工作台 | `npm run career -- resume preview --workspace "<工作区>" --json` |
| 精确打开已有构建 | `npm run career -- resume preview --build "<构建目录>" --workspace "<工作区>" --json` |
| 单份 PDF | `npm run career -- resume export --build "<单份构建目录>" --format pdf --out "<新文件.pdf>" --json` |

`--open` 可加在 preview 上，让 CLI 调用系统浏览器；如果 Agent 客户端有打开页面工具，使用返回 URL 在客户端打开即可，不同时打开多个浏览器。`preview --input "<内容包>"` 可先交付单份，适用于其他内容包尚待修正的情况。

命令参数放在子命令之后，使用 `--key value`，不使用尚未实现的全局参数或 `--key=value`。`--json` 返回 `{schema_version:"career-cli/v1", operation, status, data, warnings, errors}`；成功 JSON 在 stdout，失败 JSON 在 stderr，退出码分别为 0／1。读实际 data，不要从提示文字猜目录。所有命令不交互；资料提问由 Agent 完成。旧 scripts 命令仍输出原格式，不按统一 JSON 解析。

- `workspace status` 不创建文件，initialized:false 时按范围运行 init；initialized:true 时继续看 validation.valid、next_reads、missing_files 与 presentations。状态查询成功不等于校验或语义完成。
- `workspace check` 验证 v2 记录和引用，错误时 data 仍带 valid:false 与计数；不校验展示包，展示包用 resume validate。status/check 的 warnings 是旧校验器的文字，展示命令 warnings 是带 code/message/path 的对象；均需读取，不能默认同一类型。
- `schema.data.json_schema` 是实际使用的 Schema，legacy_schema 用于旧展示包兼容，新建使用 career-resume-package/v1；`platforms.data.platforms` 是字段规则，coverage/evidence 只声明已观察范围，不代表全部平台功能。`data.input_contract` 仅说明旧展示包如何写入 reports，新包不写 reports；它并提供可用 section 结构：规则地址 `project.name` 对应 section.kind 为 `project`、field.key 为 `name`；key 不带前缀，每组还需 id/title。不要直接把规则地址复制成字段 key。
- `hash.data.sha256` 基于文件字节；--path 相对工作区，其他文件／目录参数相对当前终端目录。目录、越界和符号链接不能作为来源文件。
- `save.data` 返回 id、file、sha256、changed、backup；已有包内容不同需要 --if-match，备份保存在同级 .history。保存不会改事实、母版或旧构建。实时工作台读取新包并重新映射；离线交付需另建快照。

- `list.data.entries` 是通过结构检查的内容清单，warnings 可能含无效包；新构建仍会核对来源是否变化。
- `build.data.directory` 和 `build.data.html` 是实际新产物位置；构建不覆盖原目录。
- `preview.data.url` 和 `preview.data.directory` 是本次服务与构建。preview 是持续运行的进程，输出成功 JSON 后仍需保持会话运行。
- `preferences.data.saved_theme` 为显式默认或 null；`effective_theme` 是无命令覆盖时采用的样式。设置只在用户要求时执行，不把“试试看”保存成长期默认。

## 最短生成顺序

1. status → 读已有进度和实际正文；缺起步文件时 init。事实与母版写入后 workspace check。
2. schema / platforms / themes → 读取真实契约与能力；读取相关来源和照片，再通过 hash 获取摘要。
3. Agent 写候选 JSON，核对附件与平台覆盖。新内容 save；更新前先记录原包摘要，以候选 + --if-match 保存。
4. 用返回的 file 验证／构建，或 preview 工作区中的全部包；检查返回地址，交付工作台。

原包摘要是合并基准，不是用户确认。使用原包写候选之后，若任何人改过原包，重新读取并合并再保存，不绕过冲突。普通成品更新不新建一份同内容版本；冻结与明确要求对照时保留原包并新建 ID。

## 启动服务必须完成的交付

1. 校验当前包并检查列表；修正本轮错误，保留有依据的缺口说明。不能为消除来源变化错误只更新摘要。
2. 在可保留的终端／执行会话中运行 preview，默认随机本机端口；记录返回 URL、构建目录与所属进程会话。普通 preview 是实时工作台；preview --build 是明确查看历史快照，不能用它验证最新改动。
3. 请求返回 URL，确认首页可访问；需要默认设置时还核对 `/api/resumes` 正常响应。能用浏览器检查时，再打开样式库确认默认按钮可用。没有浏览器工具时如实区分 HTTP 检查与交互检查。
4. 用客户端打开页面工具展示这个 **http://127.0.0.1 地址**，并在回复给可点击链接。给用户选样式／保存默认时，不能只交付 file:// 副本。离线 HTML 可复制和打印，但不能写工作区默认配置。
5. 记录工作区 context/state：本次内容包、来源版本、照片选择引用、实际构建目录、URL、如何重启和下一步。运行中的进程状态只记最近观察，不把上轮 URL 视为永远有效。当前会话无法常驻时，说明限制并提供带正确工作区的重启命令，不声称服务仍在线。

停止服务用所属终端 Ctrl+C／进程会话终止；不关闭其他任务的 Node 进程。后续“打开上次的工作台”先检查记录的地址和 `/api/resumes` 的简历 ID 是否相符，不符或已停止就重新运行 preview。共享整个构建目录前先区分公开 HTML 与内部来源快照；通常交付 HTML／PDF 即可。

## 默认、导出与更新

默认只影响同一工作区后续的新构建：显式 `build --theme <ID>` 优先，其次工作区默认，再其次内置默认。样式 ID 从 themes 读取。页面“应用样式”只影响当前查看／导出；“设为默认”是独立动作。取消默认保留其他配置。旧构建与已导出文件不改写。

CLI export 不指定 theme 时沿用该构建的样式；导出刚刚在页面选的样式时，传 `--theme <ID>` 或用页面导出按钮。集合不能直接传给 export，使用 `build目录/resumes/<内容包ID>`。确认文件存在并查看中文、图片、完整正文和分页后，才能说 PDF 已交付。

| 用户变更 | Agent 要做的事 |
| --- | --- |
| 换排版、设默认 | 使用现有样式或 preferences，不重新收集经历 |
| 换照片 | 按 intake 保存新素材与选择；更新引用它的内容包和摘要，再构建 |
| 新项目、事实纠正 | 先 sources/facts → 相关 master → 受影响的统一内容包 → 核对生成稿 |
| 只调整成品篇幅 | 更新当前内容包，记录取舍；用户明确要新版本时才新建 ID |
| 要增加截图中的新样式 | 进入仓库模板开发流程，不往内容包塞 CSS／HTML |

## 常见失败的恢复

- INVALID_ARGUMENT：用对应子命令 --help 核对参数，不按历史提案补猜参数。
- WORKSPACE_INVALID：根据 errors 修复本轮事实／引用；结构未修复前不记为检查通过。WORKSPACE_ERROR 检查实际路径、配置和依赖，不能覆盖重建。
- PACKAGE_EXISTS／PACKAGE_CONFLICT：读旧包与最新来源，保留其他修改后合并候选；重新记录合并基准。不要只拿错误返回的 sha256 直接重试。
- PACKAGE_BUSY：其他写入持有锁，稍后重新读取再试；中断留下的锁先确认所属写入进程已结束，不自动删除未知锁。
- PACKAGE_TOO_LARGE：包超过 16 MiB，无法进入目录列表；核对是否误把原材料或图片字节塞入正文，修正输入后再保存，不截断经历。
- PRESENTATION_ERROR：根据 message 核对结构、来源、图片或构建；属于通用内容错误，不视为可忽略提示。
- 内容包或照片来源已变：读取新材料，核对并更新实际内容后重算 SHA-256，保留旧构建。
- 无效包阻塞集合：先修正，或按用户当前范围只 preview --input 当前有效包；不删除其他包。
- 照片格式／路径不支持：保留原件，明确所需转换或路径修复；未完成转换前可交付不带照片的版本，但说明该差异，不伪称含照片。
- Chromium 缺失：安装运行时后重试 PDF；安装受阻仍可交付实际 HTML，不能捏造 PDF 下载链接。
- LENGTH_REVIEW 需复核并压缩对应字段；PARTIAL_PLATFORM 表示部分覆盖，MISSING_PLATFORM 表示未生成。按真实范围说明，不用填充无依据内容消除提示。
- 预览服务已退出／端口占用：重启所属服务，使用新返回地址；不复用未知服务、不终止其他应用。
