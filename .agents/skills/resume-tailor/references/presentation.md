# 统一简历包与成果页

新成品使用 `career-resume-package/v1`。一个包就是一张简历卡片：包含资料、章节、可选照片和链接。Agent 和网页共同编辑 `content`，CLI 从这一份内容确定性生成附件、通用资料和四个平台填写稿。不要再为新包手写四份 `reports`，不要从 HTML 反推内容。

## 最短操作

1. 读取工作区 AGENTS、state、母版索引及本轮需要的事实。缺什么补什么，不强制重做访谈。
2. `resume list --json` 查现有包。新建用 `resume create --title "方向 · 通用版" --json`；岗位专用版用 `resume create --title "公司 · 岗位" --from <原包ID> --json`。
3. `resume schema --json` 读取真实契约；`resume read --id <ID> --json` 获得完整 package、file、sha256。保留未知字段和已有手改，写候选文件。
4. 修改 `content`，用 `resume save --input <候选.json> --if-match <读取时摘要> --json` 保存。冲突时重新读取并合并；不要拿新摘要重放旧包。
5. `resume validate --input <返回file> --json`，核对警告与真实内容；`resume preview --json` 启动实时工作台并打开返回 URL。保持服务运行。

命令在个人工作区用 `npm run career --` 前缀，或显式 `--workspace`。完整运行与导出方法见 [CLI 操作](cli.md)。

## 写作字段

- `content.profile`：姓名、求职方向、contacts。联系方式 `{label,value,url?}` 支持可选个人网页，URL 为完整 HTTP(S)。
- `content.summary`：个人简介的纯文本，可分段。
- `content.sections`：有序章节。每项有稳定 id、kind、title、subtitle、start、end、current、company、qualification、description、responsibilities、achievements、links。
- kind 为 employment／project／education／other。title 是公司／项目／学校／自定义标题；subtitle 是职位／项目角色／专业／补充说明。学历写 qualification。职责与成果每行一条，描述按段落写。未知日期为空，current 只在确认为至今时为 true。
- `content.common.sections`：技能、语言、证书等通用字段，`{id,title,fields:[{label,value,url?}]}`；统一供用户复制，且自动加入附件。不要把同一组资料再复制到 other 章节。求职期望属于求职目标，不伪造平台字段。
- 项目链接放条目 links。没有链接使用空数组，不放占位网址；CLI 验证格式，不代表联网验证过访问性。
- `content.profile.photo` 为可选 `{path,sha256,alt,position?}`；path 相对工作区，照片为不超过 5 MiB 的 PNG/JPEG。提醒用户可提供一次，已有选择继续沿用，不用示例人像替代。
- `source` 保存实际来源 ID、路径和摘要。新版包可从空白草稿开始；有来源时如实登记。来源变更返回 SOURCE_CHANGED，不自动覆盖已编辑内容，也不能只更新摘要消除提示。

Agent 负责内容真实性、选材与表达；CLI 负责固定字段映射，不做语义推断。工作成果按平台规则拆分或合并；项目角色、公司等在无专用字段的平台并入正文；链接保留。超过长度保留全文并给 LENGTH_REVIEW，不自动截断。未覆盖字段在通用资料或附件保留，不宣称覆盖整个平台表单。

## 网页与 Agent 的更新关系

工作台首页是简历卡片列表，进入一张卡片后查看附件、通用资料和平台填写稿；“编辑内容”保存同一个 package.json。保存后所有生成视图更新。Agent 写回文件后，未编辑的页面自动刷新；有未保存修改时提示冲突并允许下载草稿，不覆盖编辑区。

网页中的事实修改不会自动回写履历事实库／母版。后续 Agent 接手先读最新包和来源；事实纠正按用户确认回到 facts/master，纯排版、篇幅调整留在当前包。不要用旧母版覆盖用户手改。

不同内容方向另存为新包，换排版不复制包。一份简历可供多个岗位引用，编辑共享包会影响这些岗位后续使用；需要独立措辞时先另存。岗位关联见 [career-board](../../career-board/SKILL.md)。

## 旧包与历史

`career-presentation/v1` 继续可读、校验和导出。`resume create --from <旧ID>` 新建可编辑副本，原包和原构建保持原样。转换以旧附件正文为准，只读取明确对应的结构化日期，不猜测职责／成果拆分；旧包完整保留在 `legacy.original`，不同平台的历史措辞需核对。

已有 v2 Markdown 岗位版本、platforms 文档和冻结清单保持不动；新包不要求先创建这些中间文档。用户明确需要原 v2 留存时仍用 resume freeze。`build` 与 CLI `export` 是不可变快照，`preview --build` 读取该快照；普通 preview 是实时工作台。离线 HTML 可查看／复制／打印，不能写工作区。

实际投递记录保存当时选定内容、排版和生成 HTML；关联、复制、编辑和导出都不等于已投递。投递前已确认的旧文件与当前内容不同时，保留实际文件并说明，不冒充当前快照就是当时发送的内容。
