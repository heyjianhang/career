# 内置简历排版样式

2026-10-13：原有 `classic`（经典）、`compact`（紧凑）保留，新增下列 12 款用户已选定的排版，共 14 款，初版均为 1。2026-10-16 当前源码将这 12 款更新为版本 2；`classic`、`compact` 仍为版本 1，旧构建快照保持原样。

| 稳定 ID | 名称 | 用户选定参考 | 可选照片 |
| --- | --- | --- | --- |
| `mono-line` | 黑白细线 | [JLB00116](https://www.jianliben.com/muban/detail/116) | 矩形、右侧 |
| `blue-tab` | 蓝色标签 | [JLB00101](https://www.jianliben.com/muban/detail/101) | 矩形、右侧 |
| `teal-dot` | 青绿圆点 | [JLB00109](https://www.jianliben.com/muban/detail/109) | 圆形、右侧 |
| `blue-rule` | 蓝色横线 | [JLB00114](https://www.jianliben.com/muban/detail/114) | 矩形、右侧 |
| `navy-tag` | 深蓝标签 | [JLB00107](https://www.jianliben.com/muban/detail/107) | 矩形、右侧 |
| `slate-header` | 浅灰页头 | [JLB00115](https://www.jianliben.com/muban/detail/115) | 圆形、左侧 |
| `taupe-band` | 暖灰分区 | [JLB00130](https://www.jianliben.com/muban/detail/130) | 矩形、右侧 |
| `skyline` | 城市横幅 | [JLB00108](https://www.jianliben.com/muban/detail/108) | 圆形、居中 |
| `graphite-bar` | 灰色条带 | [JLB00128](https://www.jianliben.com/muban/detail/128) | 矩形、右侧 |
| `blue-ribbon` | 蓝色缎带 | [JLB00102](https://www.jianliben.com/muban/detail/102) | 矩形、右侧 |
| `taupe-ring` | 暖灰圆环 | [JLB00113](https://www.jianliben.com/muban/detail/113) | 圆形、左侧 |
| `navy-rule` | 深蓝短线 | [JLB00131](https://www.jianliben.com/muban/detail/131) | 矩形、右侧 |

## 使用

运行 `node dist/cli.js resume themes --json` 获取实际注册清单；在工作台点击“更换样式”，选择缩略图或右上角放大图标，再“应用样式”。“设为默认”保存到当前工作区，后续生成沿用；显式 `--theme <ID>` 优先。已保存的旧构建不增加样式，重新运行 preview/build 生成新集合。

所有样式使用同一 `career-presentation/v1` 内容包，章节顺序与文字完全由 Agent 输入决定。模板不按参考图硬编码教育、项目或工作条目，不把缺失资料补为参考站示例。照片可省略；有照片时复用 `resume.photo` 的工作区路径、摘要、alt 和裁切焦点，无照片时不插入默认头像。

## 视觉与素材

参考来自用户在简历本预览图选择页确认的 12 项，仅用于理解排版；源站正文、头像及网页代码未带入模板。上表保留对应版式的原始参考链接。

- 中文使用已内嵌的 Noto Sans SC；文字可选择，正文由 HTML 排版，不是整张简历截图。
- 遵循现有 A4、14mm 打印边距；横幅保留在打印安全范围，和参考中的出血色带有意不同。内容多少决定高度和页数，长文自然续页。
- 版本 2 将简短的“标题＋说明”章节排为紧凑行，日期类说明或已有 period 排为“名称＋右侧时间”；技能、荣誉、证书等无需把每个短字段拆成两行。按输入结构选择布局，不依赖章节名称，也不改写内容包。带副标题、链接、列表、多段或长正文的条目保留纵向结构；短小章节尽量整组分页，长列表逐条续页。
- 黑白细线进一步收紧页头、段落与条目间距，保留 9pt 正文字号，并增加细分隔线。不会为凑一页缩小整份简历、截断文本或删除内容；长履历仍正常分页。
- 城市横幅是独立生成的装饰素材，已内嵌以支持离线；来源说明在 `src/presentation/templates/assets/README.md`。
- 圆点与叠方块来自 Bootstrap Icons 1.13.1（MIT），许可与原文件同目录保存。
- `examples/presentation/assets/demo-portrait.jpg` 是虚构插画头像，只供显式运行模板演示／测试使用，不是用户照片，不自动用于真实简历。

## 实现与验收

注册入口仍是 `src/presentation/templates/registry.ts`；本批共用 `selected.ts` 的内容渲染器、`selected.css` 和 `variants.css`。CLI、缩略图、大预览、附件页和打印快照从同一注册表读取。新增样式不需要扩展 Agent 内容格式；开发步骤见 [模板开发](resume-template-development.md)。

`npm test` 46 项通过；原有浏览器回归和新增 `npm run test:templates` 通过。新增矩阵实导出 36 份 PDF（每款有照片、无照片、长文），共 72 页；短例各 1 页、长例各 4 页，项目和末段完整。已检查 1440／768／390 像素布局、照片裁切、无照片状态、长链接、任意新增章节、默认保存和取消、预览逐层返回。可重复的验证方法见[验证范围](validation.md)。这只描述合成样例的验证结果，不承诺任意用户内容都为一页。
