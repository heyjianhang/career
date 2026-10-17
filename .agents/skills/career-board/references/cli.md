# CLI 操作

以下从用户工作区执行；开发验证另传 `--workspace <合成目录>`。JSON 输出有 operation/status/data/warnings/errors；不能只看进程有输出。工作流的实际能力通过 `--help --json`、`opportunity schema --json` 发现。输入 JSON 临时放 `.local/`，正文由 Agent 写。

## 查看全局与接手

```sh
npm run career -- board overview --json
npm run career -- opportunity list --source boss --min-rating 4 --json
npm run career -- opportunity list --query "远山" --archived false --json
npm run career -- opportunity context --id <opp-id> --json
npm run career -- opportunity show --id <opp-id> --json
npm run career -- opportunity read --id <opp-id> --path job.md --json
```

overview 包括所有卡片、阶段计数、未完成任务（含归档标记）、到期项、重复来源候选、关系边和坏记录。overview 还列出未归档岗位的待进行面试；context 提供卡片正文、未完成任务、面试轮次正文、近期活动与 next_reads；正文总预算为 32,000 字符，truncated 表明需要继续读原文件。附件只列路径与大小。show 列完整文件目录和结构化关联；共用简历、关联岗位、任务依赖均可追溯。

## 打开看板

`npm run career -- board preview --open --json` 启动共享本机服务，可传 `--port <端口>`。JSON 返回 /board 入口，简历在同一服务的 /。进程持续运行，打开页面后不要结束它。更改岗位文件后可点刷新；页面每 15 秒以及窗口重新获得焦点时检查更新。

前三个 Tab 为 JD、公司分析、岗位匹配，读取 job.md、analysis/company.md、analysis/match.md；之后是面试、资料、简历。“资料”列出实际文件树，旧 card.md 正文也可在这里阅读，不自动转换为 JD。MD 支持目录、源文和本岗位文件链接，PDF 支持翻页／缩放，图片支持缩放。“面试”按列表→单轮详情阅读记录、准备和模拟；页面支持添加／编辑轮次。正文由 Agent 使用 write/update 或 interview save 维护。抽屉宽度在工作区 `.local/ui-preferences.json` 的 board.drawer_width 中保存，独立于岗位文件，不随 Git 同步。

## 创建岗位

先运行 `opportunity schema` 查看合法字段。示例 `.local/job.json`：

```json
{
  "company": "远山科技（虚构）",
  "title": "产品经理",
  "location": "杭州",
  "salary": "20–30K · 14薪（招聘页标注）",
  "sources": [{"platform":"boss","url":"https://example.com/job/123","native_id":"123","captured_at":"2026-10-13T09:00:00+08:00"}]
}
```

```sh
npm run career -- opportunity add --input .local/job.json --json
npm run career -- opportunity write --id <返回的id> --path job.md --input .local/jd.md --json
npm run career -- opportunity attach --id <id> --input /绝对路径/招聘截图.png --json
```

岗位 ID 由工具分配，改标题、移动阶段、归档不改目录。附件复制并保留原件，重名拒绝；单文件上限 24 MiB。Markdown 上限 2 MiB。不会自动抓取链接。若要增加来源，先读现有 sources，再提交合并后的完整数组。

## 更新阶段、偏好与下一步

update 输入为部分字段补丁，未提供字段保留；提供数组时替换整个数组。只有 body 字段明确提供时替换正文。示例：

```json
{"stage":"interviewing","next_action":{"title":"补充一次跨部门项目案例","owner":"user","due":"2026-10-16"}}
```

```sh
npm run career -- opportunity update --id <id> --input .local/patch.json --if-match <card的sha256> --json
npm run career -- opportunity rate --id <id> --stars 4 --if-match <最新card摘要> --json
```

rate 的 none 清空偏好；工具记 actor=user，必须来自用户决定。其他写入可用 `--actor <记录者标识>`，默认 agent，记录者标识不是认证证明。阶段只接受 inbox/preparing/applied/interviewing/offer/ended。结束示例：`{"stage":"ended","outcome":"rejected"}`；outcome 可为 rejected/withdrawn/closed/hired。归档使用 `{"archived":true}`，恢复使用 `{"archived":false}`，均不改变原阶段／结果或任务。将阶段改回非 ended 会清空当前 outcome，历史回执仍保留。旧 contacting 读取为 applied；旧 archived 读取为 ended + archived，结果未知则保留 null 与 legacy_stage 标记，读取不改原文件。显式更新时才按新契约保存。

## 文档、任务与结果

可写 job.md、notes.md、analysis 下和 interviews 下的 Markdown（轮次 record.md 使用 interview save）。已存在的文档必须传 `opportunity read` 得到的 sha256；保留用户编辑后再写。

任务输入：

```json
{"title":"评估岗位匹配","status":"pending","owner":"agent","assigned_to":null,"due":null,"depends_on":[],"body":"依据 JD 和真实经历，记录优势、缺口及待核实问题。"}
```

```sh
npm run career -- task save --opportunity <id> --input .local/task.json --json
```

新任务无 id 时自动分配；更新在输入中保留 id，提供 `--if-match <任务文件摘要>`。status 可为 pending/in_progress/waiting_user/waiting_external/done/cancelled；owner 为 user/agent。depends_on 是同一岗位的任务 ID，不能自依赖或成环，依赖完成后才能开始／完成任务。

工作完成后先 `opportunity write --path analysis/match.md`，再保存任务的 outcome 和 links。例如：

```json
{"id":"task-返回的id","title":"评估岗位匹配","status":"done","owner":"agent","outcome":"已完成初步分析；还需用户确认出差接受度。","links":[{"kind":"document","target":"analysis/match.md","label":"匹配分析"}]}
```

链接三种类型：document 相对岗位目录；opportunity 指向另一个 opp-ID；resume 指向工作区内 `resume/versions/...` 或 `resume/presentations/...` 的具体文件。可选 sha256 固定当时内容，变更后校验报 STALE_LINK；只在核对新内容后更新摘要。投递版本优先引用冻结简历，不改写冻结文件。链接先保存再登记，避免指向尚不存在的文档。

## 面试轮次与可选练习

```sh
npm run career -- interview list --opportunity <opp-id> --json
npm run career -- interview context --opportunity <opp-id> --round <interview-id> --json
npm run career -- interview save --opportunity <opp-id> --input .local/round.json --json
```

新轮次输入示例：

```json
{"title":"技术一面","scheduled_at":"2026-10-16T14:00:00+08:00","status":"planned"}
```

日期可不填或为 null，允许 YYYY-MM-DD 与有时区的时间；状态 planned/completed/cancelled。只有真实安排／补记才建轮次。save 返回稳定 id、路径与 sha256；修改时输入含 id 和 title，加 `--if-match <轮次摘要>`。未提供的 body 和已有元数据保留；提供 body 时先合并旧正文。

```json
{"id":"interview-返回的ID","title":"技术一面","status":"completed","body":"这轮主要讨论了……\n\n招聘方的实际反馈是……"}
```

文件对应关系：

```text
interviews/<interview-id>/record.md                 # 必有：元数据 + 自由记录
interviews/<interview-id>/preparation.md            # 可选：准备
interviews/<interview-id>/simulations/练习-时间.md  # 可选：每次独立
interviews/general/preparation.md                  # 无真实轮次的通用准备
interviews/general/simulations/练习-时间.md        # 通用模拟
```

准备与模拟用 `opportunity write`；已有文件先 read 并提供摘要。通用练习不会出现在真实轮次列表，可在资料中阅读。旧 interviews 下文件仍保留在资料中，不自动编造所属轮次。正文没有固定提纲，问题、回答、反馈、复盘按实际需要组织。

save 不推进岗位阶段，也不把待办标为完成。真实面试是否已进行、岗位是否结束分别依据用户或招聘方明确消息。`interview context` 提供选中轮次、已有轮次与文档位置，并继承岗位的上下文预算；需要全文时按 next_reads 继续读。

## 记录事件、校验与恢复

`opportunity log --id <id> --input .local/event.json` 追加活动，输入包含 title、body、evidence_type，可有 occurred_at 与 links。evidence_type 为 user_report/employer_message/agent_analysis/mock_interview/real_interview。occurred_at 是事情发生时间，created_at 由工具记录本次写入时间；没有确切发生时间就不填写。

```sh
npm run career -- board check --json
npm run career -- workspace check --json
npm run career -- board recover --json
```

普通修改自动生成活动回执。中断写入留有事务记录，recover 核对每个目标的旧／新摘要后完成；外部改动导致摘要不符时拒绝覆盖。锁仍被占用时先确认对应进程结束，不能直接删除正在使用的锁。文件可人工阅读编辑，但后续执行 board check，工具写入使用摘要检测避免丢失更新。
