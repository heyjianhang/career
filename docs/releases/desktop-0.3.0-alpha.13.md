# career Desktop 0.3.0-alpha.13

发布日期：2026-10-18（北京时间）。[GitHub 预发布](https://github.com/heyjianhang/career/releases/tag/desktop-v0.3.0-alpha.13)已公开，四架构验收与匿名完整下载校验均通过；[门户](https://career.heyjianhang.top/)运行时与静态下载入口均已更新。

## 本次更新

- 新增模型与服务设置，提供阿里云百炼及兼容接口配置，支持文字／视觉模型按用途选择；Key 在本机加密保存。
- 从 JD 文字或图片提取信息，经用户核对后创建看板卡片，保留来源和原文，并防止重复导入。需要用户自己的模型服务与 Key。
- 岗位卡片按 JD、公司分析、岗位匹配、面试、资料、简历组织；公司研究与简历匹配拆分为独立 Skills，由看板 Skill 编排。
- 随包十二个用户 Skills，增加 BOSS 采集、JD 研究、独立公司分析和岗位匹配；首次完整简历引导包含岗位研究、逐项经历深挖和持续资料跟踪。
- 简历生成隐藏空白技能／荣誉等章节；编辑保留原始字段，改进模板排版、真实内容缩略图与卡片布局。
- 应用内更新提示支持预览渠道、限流等待、重启后保留重试时间及官网版本回退；升级仍由用户下载安装包完成。
- 改进桌面启动恢复、工作区引导、系统图标与模型下拉组件；维护者另有门户管理 CLI，通过现有后台登录、管理草稿、核对下载与发布。

新工作区为空，不预置个人简历、岗位、演示数据或服务 Key。升级不替换私人资料；受管指引中有用户修改时保留并报告冲突。

## 发布边界

本次继续作为**未签名预览版**，macOS 未公证，Windows 无代码签名。系统可能提示无法验证开发者。四架构自动验收运行刚打包出的应用，不等同于所有设备上的安装向导人工验收。

模型／企查查测试使用合成服务，不代表用户的真实 Key 或额度已通过；BOSS 采集需另行准备 Python 和本人浏览器登录。语音面试辅助仍为设计方案，未包含实现。浏览器岗位收藏扩展独立分发，不自动安装。公开 npm 仍保持 0.2.0。

## 验证与下载

源码：`09a84300eb21a4159c39d67403a4448597aadef1`，通过 [PR #3](https://github.com/heyjianhang/career/pull/3) 合并。

- [候选三平台 CI](https://github.com/heyjianhang/career/actions/runs/39051560895)和[合并后的 main CI](https://github.com/heyjianhang/career/actions/runs/39052126505)均通过，包含 202 项基础测试、文档检查、合成资料和实际 npm 归档安装。
- 本机 Mac ARM64 的打包应用与独立冷启动验收通过；模型／JD、看板、个人资料、简历库浏览器回归，以及 14 款模板的空章节 HTML／PDF 检查通过。
- [四架构原生构建与应用验收](https://github.com/heyjianhang/career/actions/runs/39052133701)全部通过：macOS ARM64／x64、Windows ARM64／x64 均运行刚打包的应用，验证空资料库、十二个 Skills、内置 CLI／企查查、加密模型配置／JD 导入、简历 PDF、更新检查及独立冷启动。四份报告均为 alpha.13、ok:true。[上传校验](https://github.com/heyjianhang/career/actions/runs/39053064855)与[四架构匿名完整下载](https://github.com/heyjianhang/career/actions/runs/39053230622)通过，文件均返回 HTTP 200 且哈希／字节数一致。

门户 CLI 发布成功并回查公开入口，revision 为 `b0758180c2d8411cb510c17046c14adc`；发布时间 2026-10-18 01:21。生产部署 `dps8ogxhdgui` 成功，源码 `67f1b79e83e2014976bcbd663ca4f9acb44c1e87`，构建用时 125 秒。线上 HTML 与本地 build/site/index.html 逐字节一致，首页和后台均显示 alpha.13，四个架构菜单链接正确。

## 安装包校验值

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| career-0.3.0-alpha.13-mac-arm64.dmg | 184117981 | `1a9e688ef4297a45fbf442fa13261d09151618a66d6b5b559b066132f17c628b` |
| career-0.3.0-alpha.13-mac-x64.dmg | 188695217 | `98172933576c840b597894c23565440f596758e367fc24047e00b38e05bd719f` |
| career-0.3.0-alpha.13-win-x64.exe | 169097029 | `a3f55cc6227b3ff05a70583d2d2aecaef3353329e252c8f4d65aed1b2c134989` |
| career-0.3.0-alpha.13-win-arm64.exe | 162911551 | `3f9afd9fa0e8755b64832c5f63d150c14c054967b51c85a302779a986a22f320` |
