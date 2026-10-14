# 方法与设计参考

这些项目帮助形成方法与交互取舍，不代表其能力或服务已集成进 career。早期逐轮调研已收敛到当前文档；下面保留采用范围和来源。

| 参考 | 借鉴与采用范围 |
| --- | --- |
| [Agent Skills 规范](https://agentskills.io/specification) | 主文件路由、按需读取参考资料、随包资源 |
| [career-ops](https://github.com/career-ops-hq/career-ops/tree/f4840b7d4810b905ad2c61cd40a3f1f203bc2e42) | 材料优先、渐进访谈、缺失检测与增量补充；参考持久待办、面试准备／练习／复盘的分层，独立实现岗位文件与乐观更新；按 career 的 v2 契约重新编写中文指引，未复制其实现或整段模板 |
| [ResumeSkills](https://github.com/Paramchoudhary/ResumeSkills) | 写作、岗位选材和版本维护的分工；本项目允许有依据的定性结果，不要求虚构数字 |
| [RenderCV Skill](https://github.com/rendercv/rendercv-skill) | 工具字段契约和可执行验证；未引入其渲染后端 |
| [Reactive Resume](https://rxresu.me/) | 同一内容切换样式的预览方式；未复制网站代码、模板资产或示例资料 |
| [简历本](https://www.jianliben.com/template) | 用户选定的版式参考，逐款来源见[样式目录](resume-templates.md)；独立编写渲染器，未打包参考站截图、头像或正文 |
| [Pake 中文 README](https://github.com/tw93/Pake/blob/main/README_CN.md)、[OpenSpec](https://github.com/Fission-AI/OpenSpec) | 中文产品介绍、开始指令与使用/开发入口的组织 |

方法参考不继承第三方 Skill 的执行指令或审批规则；效果需在本项目独立验证。今后直接复用代码、模板或素材时，逐项核对授权并保留适用许可。实际随包素材及依赖声明见[素材说明](assets.md)。
