# Desktop 0.3.0-alpha.16

2026-10-18 已公开为 GitHub 预览版，macOS／Windows 均提供 ARM64 与 x64。npm CLI 保持 0.2.0。

[下载与发布说明](https://github.com/heyjianhang/career/releases/tag/desktop-v0.3.0-alpha.16)；[功能 PR #9](https://github.com/heyjianhang/career/pull/9) 与[原生验收修正 PR #10](https://github.com/heyjianhang/career/pull/10) 已合并。

## 用户可见变化

- 新增“简约研发”简历模板，支持英文名、独立技术栈、照片取景、字号与行距设置。
- 简历编辑与分页预览并排展示；所有内容模块可直接改名、上移下移，个人简介也可调整位置。Agent 与网页共用稳定 ID 和统一内容包，平台字段映射保持原意。
- 优化项目分页：标题跟随正文，长段落和长要点自然续页，短尾项按实测高度处理，跨页补充项目名称；修复窄窗口隐藏预览时分页失败。
- 新增“发现公司”入口与第十四个用户 Skill，支持根据实际经历研究目标企业，在资料页保留公司池、来源和实际岗位链接，再接续岗位匹配与简历流程。
- 公司研究资料加入已有私人同步范围，保留用户备注及手改；不会自动投递或后台搜索。

## 兼容性与边界

现有内容包和用户选择继续可用，新增排版字段均可选。历史构建与投递快照不改写，个人照片和履历不随软件分发。目标公司搜索由工作区 Agent 执行，界面负责资料阅读与交接；录音与实时转写仍未接入。

Mac 继续使用完整 ad-hoc 临时签名，尚无 Apple Developer ID 签名／公证；Windows 未配置代码签名。自动化运行验收不替代安装器交互及浏览器下载后首次打开的人工验收。

## 验证与发布证据

- 安装包源码与标签：`b244ec84b73f0bcfc99e062edd534b9a56c26735`。
- 228 项基础测试、文档与资源链接、实际 tgz 新目录安装通过，包内包含 14 个用户 Skills；个人资料与测试产物未进入包。
- [功能 PR 三平台 CI](https://github.com/heyjianhang/career/actions/runs/39115505668)、[修正 PR CI](https://github.com/heyjianhang/career/actions/runs/39116656594)与[修正 push CI](https://github.com/heyjianhang/career/actions/runs/39116631085)通过。
- [四架构构建及真实应用验收](https://github.com/heyjianhang/career/actions/runs/39117268907)全部通过，每个架构检查 17 项功能及冷启动，包含模块改名、排序、窄窗隐藏预览分页、PDF 导出和公司发现入口。Mac 应用与最终 DMG 签名完整性检查通过。
- [草稿附件校验](https://github.com/heyjianhang/career/actions/runs/39118052087)及[匿名完整下载](https://github.com/heyjianhang/career/actions/runs/39118230332)通过，四个附件均返回 HTTP 200，字节数和 SHA-256 一致。
- 既有分页专项覆盖短简历、长项目与手动分页，确认 PDF 文本完整；不把自动化打包应用测试等同于安装器交互和浏览器首次打开人工验收。

| 安装包 | 字节数 | SHA-256 |
| --- | ---: | --- |
| career-0.3.0-alpha.16-mac-arm64.dmg | 185170320 | `f586442242219b0b189df7d77dc8a7154d54e4356fd253bcd59ee59822268ad5` |
| career-0.3.0-alpha.16-mac-x64.dmg | 191830846 | `4c476dc6cae1cb9fa6b322430e59c70f00f3670d088d10839865483697f3669a` |
| career-0.3.0-alpha.16-win-x64.exe | 169180312 | `fecb5189ffbe5f6f7e16c1d9ddf93c30ae5d09587122e4ea74a060554140f966` |
| career-0.3.0-alpha.16-win-arm64.exe | 162994405 | `b024144d246584b52a256f9c678d5fe6633953cf44152b499107e418576da782` |

首次构建的 Windows x64 测试在改写合成资料时触发旧预览页自动刷新，与编辑页导航竞争。PR #10 在改写前退出旧页面，保留全部断言；发布附件全部取自修正后成功的同一轮四架构构建。

## 门户下载

2026-10-18 18:14:12（北京时间），门户 CLI 发布 alpha.16 成功，云端独立验证四个公开附件，返回 `ok:true` 与 `publicFeedConfirmed:true`；当前 revision 为 `370293c87210400e83969178fbd498be`。本机额外匿名预检查遇到 GitHub 限流，CI 完整下载及云端校验均已通过。 静态回退清单同步为本版本；部署结果以生产控制台与公开页面回查为准。
