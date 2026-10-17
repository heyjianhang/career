# 文件格式与保存

关联岗位的主稿为 `opportunities/<岗位ID>/analysis/outreach.md`。元数据契约见 [outreach.v1.schema.json](../../../../schemas/outreach.v1.schema.json)。使用现有文档命令，无须新建数据库或复制简历正文。下面代码是结构示意，占位值必须换为本轮读取到的真实值，不能原样保存。

```markdown
---
schema: career-outreach/v1
opportunity_id: <岗位ID>
resume_id: <所用简历ID>
resume_sha256: <resume read 返回的 sha256>
jd_sha256: <opportunity read job.md 返回的 sha256>
generated_at: <带时区的 ISO 时间>
channel: BOSS 直聘
---
# 打招呼草稿

## 推荐稿

这里仅放可直接复制的消息正文。

## 简短版

这里仅放更短的消息正文。

## 选材依据

- JD 的具体任务与简历中的段落、本人职责、实际交付如何对应。
- 版本名称、重要未知与用户语气偏好；需要澄清的内容不放进消息里。
```

两个可复制区只用普通文本段落，不包代码块、列表、引用、链接语法或内部说明；裸网址可保留。`## 推荐稿` 必需，`## 简短版` 可选，各出现一次，下一标题结束正文。单稿上限 6,000 字符仅为本地阅读保护，不是平台限制。邮件主题在单独 `## 邮件主题` 下保存，正文仍用推荐稿，用户按邮件客户端分别填写。后面的解释标题和内容自由组织。

网页会比对 `opportunity_id`、当前绑定简历、简历及 JD 的实际摘要。版本改变提示核对，保留原稿；输入读不到显示未能核对，不能标为最新。元数据或正文格式不完整时仍可在「资料」读原件，快捷复制不会把整篇分析兜底当作消息。独立文档没有这些 ID 时不杜撰，也不套用岗位内格式。

## 通过已有 CLI 保存

先读取原件与摘要。将完整新稿写入 `.local/outreach-candidate.md`，再保存；路径、ID 和摘要均替换为真实结果：

```sh
npm run career -- opportunity read --id <岗位ID> --path analysis/outreach.md --json
npm run career -- opportunity write --id <岗位ID> --path analysis/outreach.md --input .local/outreach-candidate.md --if-match <原文档sha256> --json
npm run career -- board check --json
```

新建文件省略 `--if-match`，不能把其他读取错误都当作文件不存在。命令 JSON status 为 success 才报告保存。写回前再核对输入版本；保留用户改稿与未知元数据。用户指定尚未绑定的另一版本时存 `analysis/outreach-candidates/<简历ID>.md`，不替换当前主稿。

## 用户报告实际发送后

确认实际发送文本、渠道、时间；不知道准确时间就保留未知。把用户提供的最终文本、当时版本依据和来源说明写成 `analysis/outreach-history/<唯一标识>.md`，已有文件不可覆盖。沿用 `opportunity write`，不能为了显示最新状态篡改旧稿版本。然后用 `opportunity log` 追加 evidence_type 为 `user_report` 的真实事件，links 指向保存后的历史文件；发生时间明确时才填 occurred_at。命令字段见 [career-board CLI](../../career-board/references/cli.md)。

发送问候不自动意味着正式投递，简历投递快照与阶段仍按用户实际报告处理。未知发送结果不能假定失败并重发。这个 Skill 不实现平台发送。
