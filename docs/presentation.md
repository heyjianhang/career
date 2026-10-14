# 简历成果页与本地 CLI

> 新版简历库、可编辑内容包、平台自动映射与岗位关联以 [统一简历包](resume-packages.md) 为准。以下 career-presentation/v1 结构保留为旧格式与渲染内部契约。

实现日期：2026-10-12。资料收集、事实和母版继续使用 v2 Markdown；本模块接收 Agent 写好的内容包，生成包含附件简历和平台填写稿的 HTML。CLI 不调用模型，不要求用户重新填表。

```text
对话收集 → facts → master / v2 岗位版本
                         ↓ Agent 选材、写作和核对
                    package.json
                         ↓ CLI 校验、构建
          HTML：选样式 / 平台填写稿 / 复制正文
                         ↓
                  A4 文字型 PDF
```

## 试用

在仓库根目录运行（Node.js 22+）：

```bash
npm ci --ignore-scripts
npx playwright install chromium
npm run demo
```

演示使用明确标注的虚构资料，工作区在 `.cache/demo-workspace`。演示将已有虚构资料分别展示为通用版和精简版，保留已存在的演示内容包。浏览器打开后点击右上角简历名称切换内容；顶部“更换样式”打开可搜索的平铺样式库，选择或放大预览后应用任一已注册样式，当前共 14 款，见 [样式目录](resume-templates.md)。还可以保存默认样式、下载 PDF、查看四个平台填写稿、点击字段复制纯文本，以及导出当前 HTML。终端按 Ctrl+C 关闭本地预览。

选择样式并设为默认时，使用上述命令启动的本地页面。默认保存在当前工作区 career.json 的 presentation.default_theme，供尚未单独选择样式的简历使用。实时工作台“应用样式”另存 presentation.resume_themes 中对应简历 ID 的选择，详情、卡片缩略图和后续构建沿用；显式 --theme 优先级最高。

单份 HTML 可离线打开；简历集合需要保留 index.html 与 resumes/ 下各份 HTML 的相对位置。离线时导出按钮使用浏览器“打印／存为 PDF”，离线导出页只提供当前样式选择，不显示写入工作区的默认按钮。浏览器打印建议选择 A4、关闭页眉页脚、启用背景图形。精确复用已保存构建的排版使用 CLI／本地页面 PDF 导出。

## 内容包

契约是 [presentation.v1.schema.json](../schemas/presentation.v1.schema.json)，完整合成案例见 [package.json](../examples/presentation/package.json)。Agent 操作方法见 [生成成果页](../.agents/skills/resume-tailor/references/presentation.md)。

| 字段 | 用途 |
| --- | --- |
| schema / id / title / generated_at | 固定 `career-presentation/v1`、内容包 ID、显示名称与生成时间 |
| synthetic | 仅合成示例设为 true；真实简历设为 false |
| source.resume_id / source.files | 本次母版或版本标识、相对工作区的实际来源路径与 SHA-256 |
| resume | 完整附件正文：姓名、方向、联系方式、简介、按显示顺序排列的章节和经历 |
| resume.photo（可选） | 相对工作区的 PNG/JPEG 素材路径、SHA-256、替代文字、可选裁切焦点；由 Agent 写入 |
| reports | Agent 分别写好的 boss、zhaopin、liepin、job51 填写稿；可缺少，页面明确提示待生成 |

`resume.sections[].items[]` 使用 `title`、可选 `subtitle/period`、`paragraphs` 与 `bullets`；顺序由 Agent 决定。所有正文是纯文本，HTML 转义后渲染，不能插入模板代码。报告的 `sections[].kind` 支持 summary、employment、project、education；每组需要 id/title/kind/fields，`fields` 是独立的 `{key,value}`。平台规则用 `<kind>.<key>` 查找，例如 `project.name` 在包中写为 `kind:"project"` 和 `key:"name"`，key 本身不含点号。`resume platforms` 返回 `input_contract` 和可用 section 示例。标签、控件形式与长度约束由对应平台规则提供。报告说明放 `notes`，不混入复制正文。

真实内容包必须引用来源文件。校验摘要只证明来源文件未变化，不证明简历语义、成果和平台稿正确；这些由 Agent 与用户核对。新事实仍先维护 facts。源文件变化时新构建会要求重新核对内容包，不能只刷新摘要消除提示。

建议保存：

```text
workspace/
├── career.json                         # presentation.default_theme
├── resume/presentations/<id>/package.json # 每份内容独立保存
└── build/<id>-<随机后缀>/
    ├── index.html                      # 可离线分享的成果页
    ├── .package.json / .rules.json      # 构建输入与规则快照
    ├── .print-<template-id>.html         # 每种已注册样式的打印快照
    └── build.json                      # 文件摘要
```

每次构建新目录，不覆盖旧产物。PDF 导出使用构建时保存的打印 HTML、规则和内嵌字体；后续样式或母版更新不会自动改写旧构建。默认样式影响下一次构建，当前打开的页按用户选择导出。取消默认仅删除 presentation.default_theme，保留其他配置；没有显式样式或简历独立选择时回到 classic，已打开的页和已有构建不改变。默认设置通过本地预览写入，离线 HTML 隐藏默认按钮。需要保存设置时交付 CLI preview 启动的本地地址，而不是仅交付 file:// 离线副本。公开分享只取确认过的 HTML／PDF；构建目录还含内部来源记录。

## 已实现命令

开发构建运行 `npm run build`；仓库内调用 `node dist/cli.js`，其命令入口声明为 `career`，当前未发布 npm 包。下列是展示相关命令；安装与同步见 [安装说明](installation.md) 和 [career-setup](../.agents/skills/career-setup/SKILL.md)，完整清单以 CLI help 为准。

```bash
node dist/cli.js --help --json
node dist/cli.js workspace init --workspace workspace --json
node dist/cli.js workspace status --workspace workspace --json
node dist/cli.js workspace check --workspace workspace --json
node dist/cli.js workspace hash --path resume/master-preview.md --workspace workspace --json
node dist/cli.js resume schema --json
node dist/cli.js resume platforms --platform liepin --json
node dist/cli.js resume save --input <Agent写好的候选.json> --workspace workspace --json
node dist/cli.js resume validate --input workspace/resume/presentations/general/package.json --workspace workspace --json
node dist/cli.js resume build --input workspace/resume/presentations/general/package.json --workspace workspace --platform all --json
node dist/cli.js resume preview --build <上一步的构建目录> --workspace workspace --open
node dist/cli.js resume export --build <构建目录> --format pdf --theme compact --out <新文件.pdf> --json
node dist/cli.js resume themes --json
node dist/cli.js resume preferences --workspace workspace --json
node dist/cli.js resume preferences --workspace workspace --theme compact --json
node dist/cli.js resume preferences --workspace workspace --clear --json
node dist/cli.js resume list --workspace workspace --json
node dist/cli.js resume build --collection --workspace workspace --json
node dist/cli.js resume preview --workspace workspace --open
```

`preferences` 不带修改参数只读，不创建工作区；返回 saved_theme（显式设置或 null）与 effective_theme（实际默认）。--theme 保存，--clear 清除，两者互斥；使用与页面相同的保留其他配置和原子写入机制。Agent 的端到端执行方法见 [CLI 操作](../.agents/skills/resume-tailor/references/cli.md)。

`preview --input <文件>` 可一次构建并打开单份；不指定 `--input` / `--build` 则读取工作区目录并生成简历集合。`preview --build <目录>` 同时支持单份构建和集合。`build --out <新目录>` 指定输出位置，`--theme <template-id>` 覆盖工作区偏好。`--platform all` 表示展示全部平台，不会补写缺失稿件。平台筛选参数尚未实现。所有输出路径相对于终端当前目录；默认从当前目录向上查找 career.json，开发时显式传 --workspace 指向独立测试目录。JSON 成功结果在 stdout，错误在 stderr 并返回非零状态。

## Agent 命令的实际契约

以 `--help --json` 为机器能力清单，支持 `workspace --help`／`resume save --help` 按范围查询。运行形式为 `node dist/cli.js <领域> <动作> [参数]`，参数放在动作后，使用 `--key value`。全局环境变量定位、--no-input、--timeout 和历史提案里的平台操作尚未实现；现有命令本身无交互，不会要求登录。

所有已实现动作支持 `--json`，统一返回 `{schema_version:"career-cli/v1", operation, status, data, warnings, errors}`。成功输出 stdout、退出码 0；失败输出 stderr、退出码 1，errors 包含 code/message，冲突可含 details。workspace check 错误时保留 data 中的 valid:false 和计数，其余异常通常 data:null。workspace.status 返回盘点结果，需另看 data.validation.valid；completion:not_assessed 表示不替 Agent 判断资料完整度。旧 v2 校验的 warnings 为字符串，展示模块 warnings 为 Issue 对象，保留原格式。旧 scripts 命令不承诺此 JSON 外壳。

- `workspace init/status/check/hash` 复用既有 v2 工具与文件规则。init 只补缺，status 只读，check 校验来源／事实／母版／v2 版本，hash 返回相对路径、字节数和 SHA-256；不自动生成或改写事实。v2 工具仍要求 resume_dir 为 resume；展示目录可以单独使用安全的自定义 resume_dir，不宣称 v2 已迁移。
- `resume schema` 返回 json_schema 与 example_path；`resume platforms` 返回 platforms 数组，可按单个平台查询。都读取实际运行所用文件，不维护另一份手写规范。
- `resume save` 先校验来源、照片、平台字段与 Schema，再把 Agent 写的候选保存到配置目录下 `<id>/package.json`，返回 id/file/sha256/changed/backup。不改变 source.files 的摘要，不回写母版，不更新旧构建；最大 16 MiB，与目录读取限制一致。
- 新包不需要 --if-match；相同规范化内容为 changed:false。更改已存在包时需要 `--if-match <原文件SHA-256>`，摘要必须来自 Agent 开始本轮合并前读到的原文件。原文件发生变化返回 PACKAGE_CONFLICT，无摘要则 PACKAGE_EXISTS；先重新读取和合并，不能用新摘要直接覆盖。
- 更新通过独占锁和临时文件替换，精确旧字节保存在同级 `.history/<唯一ID>.json`；并发写入返回 PACKAGE_BUSY。备份不进入集合，不作为 v2 冻结记录；中断残留锁需确认没有所属写入进程后处理。

命令故障代码与交付步骤见 [Agent CLI 指南](../.agents/skills/resume-tailor/references/cli.md)。结构、摘要和文件数量都不能证明文案真实完整，Agent 必须对照资料核对并记录取舍。

## 实现边界

- Node.js + TypeScript；Ajv 校验 JSON；纯 HTML/CSS/浏览器脚本，无前端运行时框架、数据库或账号服务。
- 14 种内置主题，共用统一渲染接口与模板注册表。样式库、CLI 清单、HTML 和 PDF 构建均从注册表生成。不提供页面任意代码上传、拖拽编辑或多方向母版管理。
- Playwright Chromium 生成 A4 PDF。Noto Sans SC 开源字体按所需字符对应的原始子集内嵌，OFL 许可保存在 HTML 样式注释中；生成与查看不请求远端字体。
- 本地预览只监听 `127.0.0.1`，只提供成果页、简历集合元数据、PDF 和默认偏好接口；不暴露工作区文件目录。默认偏好写入保留 career.json 其他字段。
- 四平台规则在 [Skill 的 render 模板目录](../.agents/skills/resume-tailor/templates/platforms/render/)，仅覆盖当前观察到的主要正文与基础经历字段。控件枚举、必填校验、所有身份分支和上传尚未完整验证。`evidence` 文件名对应 Skill 的 `references/platforms/`。
- 字数是 Unicode 码点参考计数；提示超长但不截断内容。不将未知上限变成硬限制，不声称自动填表或平台提交成功。
- 构建不是旧 v2 冻结记录。需要纳入岗位版本留存时，Agent 将确认的产物复制到该版本允许的附件位置，再执行既有留存流程；原构建与母版保持原样。

## 验证

`npm test` 包含目录发现、重复 ID、集合快照、逐份访问与导出边界，以及照片路径与摘要、模板快照、来源变化、字段错误、输出转义、构建保护、偏好保留和本地服务边界；`npm run check:example` 检查旧 v2 案例。`npm run test:browser` 需要 Chromium，实际检查样式、四平台切换、剪贴板、下载、离线页、移动端和长文导出，产物在 `.cache/browser-review`。每次检查用新目录，避免混淆历史截图。

`npm run test:templates` 另覆盖首批 12 款的有照片、无照片和长文 PDF、任意章节、转义、裁切、默认设置与移动端布局，产物在 `.cache/template-review`（可用 `npm run test:templates -- <新目录>` 指定位置）。页面/PDF 检查不代替 Agent 访谈、选材、事实与语义一致性评估。

## 照片输入接口

照片由资料收集阶段保存到工作区，Agent 在衍生内容包中选择本次使用的素材。所有旧内容包继续有效，photo 整体可省略。

```json
{
  "photo": {
    "path": "resume/assets/profile/portrait.png",
    "sha256": "原文件的 64 位 SHA-256 十六进制摘要",
    "alt": "简历照片",
    "position": {"x": 50, "y": 50}
  }
}
```

上例说明的是 `resume.photo` 子对象；摘要需由真实文件计算，不直接使用占位文字。支持 PNG/JPEG，最大 5 MiB；path 相对工作区，不能是远程 URL、越界路径或符号链接。校验素材摘要和文件头，PDF 导出还会等待所有图片实际解码完成；损坏图片会导致导出失败。x/y 是 `object-position` 百分比，范围 0–100。

构建时解析为 `ResolvedAssets.photo`（data URL、alt、x/y），模板接收解析后的素材，不读取工作区。HTML 与打印快照内嵌图片，因此源图更新或移走不影响旧成果。当前 14 种样式均为可选照片，缺图时不占照片位置；页面不新增上传表单。照片用于附件简历，并可在“通用资料”下载原图供上传，不推定各平台的头像上传规则。

## 模板扩展接口

唯一注册入口：[templates/registry.ts](../src/presentation/templates/registry.ts)。每个 `ResumeTemplate` 定义：

| 属性 | 契约 |
| --- | --- |
| id / version | 稳定、安全、唯一 ID；版式改变时递增版本 |
| name / description / tags | 样式库和 CLI 共同展示的元数据 |
| photo | `optional` 或 `none`；不支持照片的模板接收不含 photo 的 assets |
| css | 模板样式，必须限定在 `.resume-paper[data-template="<id>"]` 内，不修改工作台 UI |
| render(input) | 接收 `{resume, assets, synthetic}`；返回 article 内部的 HTML；转义全部用户正文 |

按用户截图新增时，先读 [模板开发流程](resume-template-development.md)。新增样式的步骤：

1. 在 `src/presentation/templates/` 添加自己的渲染器／样式，通过注册表注册一次。可复用现有结构，也可实现新结构。CSS 文件会随构建复制。
2. 不按模板复制内容包；同一 `ResumeContent` 的章节、段落和要点顺序由 Agent 决定，渲染器只负责排版。保留全部内容，纯文本不能作为 HTML 直接拼接。
3. 缩略图、样式库大预览、主预览和 PDF 使用相同渲染器。新增模板不修改浏览器按钮分支、CLI 样式列表或平台稿件。
4. 增加含长中文、长链接、无照片／有照片的版式样例与 PDF 视觉检查；PDF 统一 A4、14mm 页边距，模板内避免固定高度截断正文。发布前测试打印与屏幕排版。

`build.json.templates` 保存每个模板 ID 和版本，文件摘要覆盖对应 `.print-<id>.html`。旧版没有 templates 的构建按最初 classic/compact 两份快照读取。导出以当前构建中已有的快照为准，不从新的模板代码重渲染旧成果。

平台报告另由 `reports` 和平台字段规则渲染，不跟随视觉模板重写内容。字段是可键盘聚焦的复制按钮，外观为普通文本；剪贴板只有 value，不包含字段名、计数或填写说明。无法直接访问剪贴板时选择正文，提示用户手动复制。

交互取舍与来源见[方法与设计参考](references.md)。首批 12 款新增样式及素材来源见 [样式目录](resume-templates.md)。

## 简历集合与样式库

两类数据独立维护：

- 简历内容：`workspace/<resume_dir>/presentations/<id>/package.json`。一份包包括附件正文及对应平台稿，使用稳定的唯一 ID。默认 `resume_dir` 是 `resume`，尊重工作区 `career.json` 的配置。
- 排版样式：`src/presentation/templates/registry.ts` 注册的模板。换样式复用当前内容包，新增简历无需复制模板代码。

`resume list` 只扫描 presentations 的直接子目录，校验 package.json 后返回 ID、名称、生成时间与文件路径。无效包、重复 ID 和符号链接产生明确提示；不扫描原始材料、事实或母版来猜测展示内容。`build --collection` 遇到这些问题时要求先修正，来源已变化也会阻止新构建；可用 `--input` 单独打开已确认的一份。空目录可正常构建和启动：集合 entries 为空，页面展示“还没有生成简历”，引导整理资料 → 建立母版 → 生成简历，提供可复制给 Agent 的开始指令；没有虚构简历或不可用的导出按钮。无效内容仍报错，不伪装成空目录。

集合构建结构：

```text
build/collection-<随机后缀>/
├── index.html                       # 默认打开第一份（生成时间倒序，同时间按 ID）
├── collection.json                  # 集合索引与首页摘要，内部构建文件
└── resumes/<id>/
    ├── index.html                   # 本份附件、平台稿与样式
    ├── build.json                   # 本份快照摘要
    ├── .package.json / .rules.json
    └── .print-<template-id>.html
```

右上角切换器只显示当前简历名称，不显示简历数量或演示状态；支持按名称搜索。切换后附件、平台稿、标题和导出对象整体更新，保留当前查看的平台与样式；未选择新样式时仍使用当前样式。顶部样式弹窗支持搜索、卡片选择、放大预览、返回列表、取消和应用。弹窗标题为“排版样式”；卡片仅显示缩略图与名称，右上角图标进入放大预览。底部按“取消 → 设为默认 → 应用样式”排列；可将当前选中的候选样式设为默认；已是默认时按钮变为“取消默认”，清除该偏好。设置默认不会应用或关闭当前弹窗，应用样式单独操作。放大预览占用整个弹窗主体，隐藏列表页说明与底部栏；此时 Esc、右上角关闭或返回按钮都回到样式列表，保留搜索与选择。在列表层关闭才退出弹窗。预览候选样式不会提前修改主页面。当前注册 14 种样式，未来注册更多模板后自动进入网格。

这是生成时的集合快照，没有后台目录监听。Agent 新建或修改内容包后，重新运行 `resume preview --workspace workspace --open`；旧集合保持原样。“导出 HTML”只保存当前简历，不带其他简历的名称和链接。分享整个集合时仅复制顶层 index.html 和 `resumes/<id>/index.html`，保持目录结构，并先确认这些简历都可以分享。

本地服务的 `GET /api/resumes` 返回 `{schema: "career-library/v1", entries:[{id,title,generated_at,href}]}`，不返回工作区文件路径。会话通过 `GET /api/session?resume=<id>` 获取；会话额外返回 savedDefaultTheme（未设置为 null）。PDF 和默认样式请求使用 `{theme,resumeId}`，默认样式接口接受 theme:null 表示清除；PDF 仍必须提供具体样式。沿用同源与会话令牌校验。服务按请求中的 ID 选择构建快照，不存储全局“当前简历”，多个标签页不会相互改变导出对象。

集合中的单份 CLI 导出：`resume export --build <集合目录>/resumes/<id> --format pdf --theme classic --out <新文件.pdf>`。不向 export 直接传集合根目录。简历集合属于展示层，未改变现有 v2 母版和版本管理结构。

平台报告的字段名与正文同字号，字段名加粗、加深；主标题上方不重复简历名称，不显示操作提示与核对日期横栏。规则核对证据仍保留在平台规则文件中。

演示精简版保留与通用版相同的工作、项目、教育等模块，仅减少段落和要点；不代表平台所有字段都已支持。主要正文分组仍只有 summary / employment / project / education，其他字段接入需要继续完善规则与内容契约。


## 工作台布局与分页预览

- 全局侧边栏仅显示已经实现的“简历”页面；底部按钮展开／收起，图标模式保留名称提示与键盘操作。浏览器记住选择；小窗口默认收起，展开为覆盖抽屉，可点遮罩或 Esc 收起。以后工作台等页面与“简历”平级。
- 简历页顶部依次为页面名与简历切换器、附件／四平台标签、操作栏。更换样式在左，右侧“导出 HTML”为次按钮，紧邻主按钮“导出 PDF”左侧。控制区固定，只有文档区域滚动。
- 附件主预览与样式放大预览使用 Paged.js 0.4.3，固定 A4、14mm 页边距分页；屏幕缩放整张纸，收起侧栏或改变窗口宽度不会重新改变换行与页数。页间保留灰色间隔，不显示“A4 · 简历预览”或分页免责声明。平台稿仍为普通阅读／复制页面。
- `pagination.ts` 统一生成预览 iframe 文档与打印快照，内嵌分页引擎、MIT 许可、字体与素材。打印等待字体、图片和分页成功，失败不导出未完成页面。旧构建继续使用自身快照；导出 HTML 可离线重新分页、切换样式并打印当前简历。
- 缩略图用于快速选款；主预览与放大预览展示实际分页。`npm run test:layout` 覆盖空状态、折叠、固定控制区、移动端和长文页数；模板矩阵解析 PDF 检查导出页数等于预览页数。

## 通用资料与可点击链接

新增可选 `common: {sections:[{id,title,fields:[{label,value,url?}]}]}`，统一呈现技能、资格证书、语言等，各平台用户自行匹配标签／下拉项；不为四平台重复写同一资料。求职期望留在求职目标范围。“通用资料”同时复用 resume 的联系方式、网页、项目链接与照片；字段点击复制、链接打开、照片下载，无照片不显示该分组。该区域不自动进入 PDF；附件需要的技能等仍由 Agent 在 resume.sections 写作。

`resume.contacts[]` 可加 `url`，如 `{label:"个人主页",value:"portfolio.example.com",url:"https://portfolio.example.com/"}`。每条经历可加 `links:[{label:"项目演示",url:"https://example.com/demo"}]`。所有 14 款样式在基本信息或经历下显示真实锚点，分页预览、打印快照和 PDF 保留可点击目标。只接受完整 HTTP(S) 地址，校验格式但不主动请求外站。没有链接就省略可选字段／传空 links；没有空链接、提示文案或占位行。旧包无需迁移，未提供 url 的普通文本保持原样。

`npm run test:links` 检查全部样式的 PDF 链接注释、正文长分页中的项目链接、通用资料复制／打开／照片下载、离线 HTML 与缺省兼容。

## 同一工作区的求职看板

本地服务还提供 /board，与简历页面共用可折叠侧栏。career board preview 直接打开看板，没有简历也可运行。离线 HTML 隐藏本机看板链接；岗位数据与阅读器规则见[岗位工作区](opportunities.md)。
