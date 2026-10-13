---
name: career-intake
description: 帮用户开始整理简历，交互式维护基本信息、可选照片、教育、任职、项目、技能、语言和证书。适用于空白工作区、旧材料整理、新增或纠正经历；逐项访谈、保存来源与事实、维护进度，并衔接简历母版。
---

# 交互式履历维护

## 从当前状态开始

在个人工作区，按 [启动与空白引导](references/startup.md) 用 `workspace status --json` 检查工作区，缺文件时 `workspace init` 补齐；完整命令入口与准备方式见启动方法。再读本轮 state 与 resume/maintenance.md。旧工作区先盘点，用户已指定经历就从该经历开始。只读取当前需要的事实、来源与问题。

首次写本工作区记录前，读仓库的 [数据契约](../../../docs/data-model.md) 和本次类型模板。来源、事实、问题、维护清单与 state 由 Agent 用文件编辑工具写入；CLI 负责初始化和校验，没有“自动收集／保存事实”的命令。每轮交付已保存的内容与一个可继续的问题，不把模板交给用户填写。

首次使用时先主动说明：“我会和你逐项整理资料，边聊边保存，最后形成一份可以继续维护的简历母版。”已有材料先提取；确实为空时，选择一项并解释如何开始，不只回复“请提供材料”。

进入基本信息维护时，按 [照片收集](references/profile.md#简历照片可选) 主动提醒一次可选照片，记录选择和素材；用户正在讲项目时不插入照片提问。已暂缓或选择不展示时继续整理，不重复催要。

独立分享整个 Skill 时，使用随包方法和模板，在用户指定位置或回复中输出履历草稿、问题清单和维护进度；没有仓库工具时不声称已完成 career 数据校验。导入 career 再映射稳定 ID 和共享格式。

## 按资料类型选择专家方法

每份方法均包含开场引导、核对重点、保存位置、完成标准与后续更新方式。按本次主题加载一份，不要求用户按表格顺序回答全部内容。

| 维护内容 | 方法 | 模板 |
| --- | --- | --- |
| 基本信息与可选简历照片 | [个人资料](references/profile.md) | [profile](templates/facts/profile.md) |
| 教育经历 | [教育](references/education.md) | [education](templates/facts/education.md) |
| 工作经历 | [任职](references/employment.md) | [employment](templates/facts/employment.md) |
| 项目经历 | [项目](references/project.md) | [project](templates/facts/project.md) |
| 技能 | [技能](references/skill.md) | [skill](templates/facts/skill.md) |
| 语言 | [语言](references/language.md) | [language](templates/facts/language.md) |
| 证书 | [证书](references/certificate.md) | [certificate](templates/facts/certificate.md) |

共享操作按需读取：[来源与去重](references/evidence.md)、[访谈技巧](references/interview.md)、[落盘步骤](references/saving.md)、[维护状态](references/maintenance.md)。跨工具格式见仓库的 [数据契约](../../../docs/data-model.md)。

需要掌握完整交互节奏时读 [虚构对话示例](references/example-conversation.md)，其中的经历与数字不能用于真实用户。

## 每项维护的循环

1. **说明本轮主题。** 根据维护清单、现有材料和用户意图选一项，说明已有内容与本轮要补充什么。空白时提出具体起点；学生可从教育或课程项目开始，已有任职者可从最近一段工作开始。
2. **先提取再追问。** 读取材料，保存已明确部分；结合该类型的方法发现关键缺口，每轮少量问题，避免重复索取答案或把全部模板交给用户填。
3. **随回答保存。** 按落盘步骤登记来源、匹配稳定 ID、更新事实及 questions。暂时答不出的内容保留未知；先处理能推进的部分。
4. **给用户看整理结果。** 用可纠正的表述展示本人范围、行动和成果。事实冲突需要核对；普通表达可根据已有偏好直接改善，不要求逐字段确认。
5. **标记并继续。** 满足本类型标准时将该条目标记“本轮已整理”，说明未阻塞的剩余缺口和下一项；用户暂不继续时记录“暂缓”及原因。模块状态按其已知条目汇总。
6. **衔接母版。** 本轮事实足以支撑准确表达时，由 resume-master 建立或更新相关条目。用户正在完整整理简历时主动衔接；本次只要求记录事实时保存母版待更新事项，不扩大任务。

## 更新已有经历

“最近做了一个项目”“那个项目上线了”“这段经历我当时只是参与”都进入维护循环。先区分新增经历、原经历的新进展和事实纠正；新经历建新 ID，既有经历沿用 ID。保存新来源、更新受影响的问题与事实，维护清单标记相关母版待更新，其他内容保留。

每轮更新 context/state 的当前对象、已保存产物、待回答问题 ID 和下一步。履历详情只在 facts，模块／条目状态只在 maintenance；具体保存规则见 [落盘步骤](references/saving.md)。

用户已要求整套生成时，把“资料 → 母版 → 内容包 → 本地成果页”作为同一个任务续接，资料足够后使用仓库的 resume-master、resume-tailor；不在每次切换 Skill 时重新询问是否继续。缺少仓库工具的独立模式只交付实际完成的草稿和素材引用。
