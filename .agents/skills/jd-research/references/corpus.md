# 可复算的样本统计

仅在批量研究需要统计或续接时使用。几份 JD 可以直接对照，不必填 JSON。脚本不联网、不识别语义、不读取用户简历、不修改 Career 数据；它校验已人工／Agent 审阅的标注并计数。运行需要 Node.js 22+；桌面客户端没有可用 Node 命令时用当前 Agent 的运行环境或手工汇总并核对，不假称已经执行。

```sh
node <skill目录>/scripts/summarize-corpus.mjs <corpus.json>
```

输出 JSON 到标准输出，按需要存到研究目录。无正文、排除项、待核实项分别列出，只有 `include + full` 的记录参与核心统计；即使正文完整也必须明确作纳入决定。分类、去重和原句性质须先审阅，不用 regex 关键词代替。

## 输入

最小合成例子（不是用户经历或真实招聘）：

```json
{
  "schema": "jd-research-corpus/v1",
  "scope": "虚构客户运营岗位示例，仅说明统计格式",
  "categories": [
    {"id":"analysis","label":"反馈分析","kind":"capability"},
    {"id":"degree","label":"本科学历","kind":"gate"}
  ],
  "jobs": [{
    "id":"jd-001",
    "sample_group":"sample-001",
    "group_reason":"独立岗位；同岗多来源或同公司相同模板才共用组号",
    "company":"示例公司（虚构）",
    "title":"客户运营",
    "family":"客户运营",
    "source":{"platform":"user","url":null,"native_id":null,"locator":"用户提供的合成文本第1段","captured_at":"2026-10-17T10:00:00+08:00"},
    "completeness":"full",
    "decision":{"status":"include","reason":"符合本次研究范围"},
    "text":"负责客户反馈分析。本科及以上学历。",
    "requirements":[
      {"category":"analysis","modality":"responsibility","quote":"负责客户反馈分析","locator":"职责第1句"},
      {"category":"degree","modality":"must","quote":"本科及以上学历","locator":"要求第1句"}
    ]
  }]
}
```

- `categories`：由研究问题与样本确定；`kind` 为 capability／gate／work_condition。稳定 ID 保留，重分类时记录原因并重算。
- `sample_group`：同一需求样本的标识。重复来源不删除，审阅后共用组号、写 `group_reason`；不同公司或岗位族不混组。主体名称不同但确认同一家时统一研究用 `company`，原名另记。统计不会自动猜测模板重复。
- `source`：platform、locator、captured_at 必填；时间为带时区 ISO 日期。url 与 native_id 可空；链接需去掉凭据和会话参数，但保留职位语义参数。公司未知用 null，不能填猜测名。
- `completeness`：full／partial／lead；`decision.status`：include／exclude／review，原因必填。排除原因、用工证据、冲突和页面状态可另附 `employment`、`conflicts`、`availability` 等字段，脚本不会据此代替判断。
- `text`：供原句核验的招聘原文，不包含其他岗位或公司广告。纯线索可为空；来源位置保留原始材料对应关系。
- `requirements`：category 使用已定义 ID；modality 为 must／preferred／responsibility／condition／negated／unclear。quote 必须能在 text 中找到（仅规范 Unicode 与空白），不能用改写后的总结充当引文；locator 必填。全文保存仅用于本地研究，公开汇报优先短引文和链接。

脚本在同一规范 URL 或同一平台 native_id 被拆到不同样本组时拒绝计数，要求先核对重复或复用链接的不同时间版本。同组冲突的条件仍会分别出现，不自动选宽松条件。不同发布时间且职责变化的复用链接应另作研究批次或先确定快照比较方式，不能直接混算。

## 输出含义

`counts` 同时显示原始记录、完整／部分正文、纯线索、纳入／排除／待核实、核心样本和核心记录。`overall` 与 `by_family` 对每个类别分别统计正向提及、各性质的样本数，并保留样本 ID。明确不要求与语义不清不计入正向需求，仍单列。

分母为该统计组的核心样本数。分母为零时比例为 null。各性质可重叠，总数不能简单相加；正向提及也不等于必须掌握。公司分布只是招聘页的公司标签，不证明用工主体。统计结果不包含原文、个人资料或登录参数。

校验通过不证明原文完整、分类正确或样本有代表性。交付前人工抽查分类、每个主要结论和去重组；保留不适合投递但用于市场参考的条件差异。
