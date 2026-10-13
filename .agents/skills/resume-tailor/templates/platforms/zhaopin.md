---
schema: career-resume/v2
type: platform-template
id: template-zhaopin
updated: 2026-10-12
platform: zhaopin
revision: 2
verification_status: draft
verified_at: null
sources: []
fields:
  - key: summary
    label: 个人优势
    order: 1
    form: plain-text
    required: null
    limit: null
    limit_source: null
  - key: employment
    label: 工作经历
    order: 2
    form: repeat-fields
    required: null
    limit: null
    limit_source: null
  - key: projects
    label: 项目经历
    order: 3
    form: repeat-fields
    required: null
    limit: null
    limit_source: null
  - key: education
    label: 教育经历
    order: 4
    form: repeat-fields
    required: null
    limit: null
    limit_source: null
---

# 智联候选字段模板（待核实）

尚未核实当前求职者编辑页，不保证字段齐全、顺序或必填规则与平台一致。借鉴通用履历结构，先用于准备稿。

## 输出约定

个人优势输出纯文本。工作经历按公司名称、职位名称、开始时间、结束时间、工作内容分组；项目经历按项目名称、项目角色、开始时间、结束时间、项目描述、项目职责、项目成果分组；教育经历按学校、专业、学历、学位、起止时间分组。具体字段缺失或不被平台支持时记录到版本 notes.md，不自动编造或静默丢失。

一个输入框对应一个 text 围栏代码块，字段名称放在块外标题，块内只有可粘贴的纯文本，不使用 Markdown 排版。多条内容按自然段换行，缺失字段不输出空块；提示、缺口和建议放 notes.md。具体格式见 [复制约定](../../references/platform-templates.md#复制格式)。

## 核对记录

模板整理日期：2026-10-12。平台核对日期和限制来源尚无证据，元数据保留 null。后续核实需记录页面或官方说明、日期、字段和限制计数方式；只提高实际核实的覆盖范围。
