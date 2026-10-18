# Desktop 0.3.0-alpha.17

2026-10-18 已公开四架构桌面预览版。npm CLI 保持 0.2.0。

## 本次变化

- 修复更新检查长期失败：优先查询官网公开下载记录，仓库清单回退，GitHub 限流不再阻断官网检查；区分旧缓存、网络与存储失败，自动失败按退避时间重试。
- 十五款简历模板统一自然分页与标题衔接；优化页底留白、长经历续页及缩放居中，编辑预览与附件预览共用缩放定位。
- 公司分析与岗位匹配明确交付内容：先呈现结论、证据、差距与行动建议；内部路径和摘要留在元数据。补齐 Agent 交接提示和只读 match-check 校验。

## 兼容性

保留已有工作区、经历、照片及投递快照；旧导出成品不自动重写。更新缓存兼容迁移。报告规范更新不自动改写历史报告，不保证 Agent 内容已经经过语义验证。

仍使用手动下载安装包、退出后覆盖安装；不含自动安装重启。Mac 使用完整 ad-hoc 临时签名，尚无 Developer ID 签名与公证；Windows 未配置代码签名。

## 验证与发布状态

- 候选 241 项 Node 回归、文档检查、合成工作区与门户构建通过，包含 19 项更新检查专项。实际 tgz 新目录安装通过（548 文件、14 个用户 Skills），检查了资源、简历 HTML 与本地历史。
- 十五模板、五组合成内容的 PDF 回归已验证；更新功能在隔离 Electron 中验证真实官网版本与精确架构链接。
- [三平台 CI](https://github.com/heyjianhang/career/actions/runs/39127780830)、[四架构构建与打包应用原生验收](https://github.com/heyjianhang/career/actions/runs/39128544357)、[草稿附件校验](https://github.com/heyjianhang/career/actions/runs/39129564397)及[匿名完整下载](https://github.com/heyjianhang/career/actions/runs/39129779339)均通过。
- 浏览器首次下载后的 Gatekeeper 允许流程和 Windows 安装器交互未逐台人工复验；原生验收指实际打包应用的功能检查。

## 发布来源与下载

源码及标签：`c13d29063a99718f227e62af8c4b377260e1dbde`，`desktop-v0.3.0-alpha.17`。

[GitHub Release](https://github.com/heyjianhang/career/releases/tag/desktop-v0.3.0-alpha.17) · [官网下载](https://career.heyjianhang.top/)。

门户 CLI 于 2026-10-18 21:04:18（北京时间）成功切换 alpha.17，返回 `ok:true`、`publicFeedConfirmed:true`，revision `63c6ee3520154444a71392150e5b4f37`。静态回退清单同步为 alpha.17，随本记录提交部署；此回执证明运行时切换，不单独证明静态部署完成。

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| career-0.3.0-alpha.17-mac-arm64.dmg | 185162860 | `1e05275b0d073171fe3a1170c1bfeaccf5991365cae3a8d0526748e0e53bacd8` |
| career-0.3.0-alpha.17-mac-x64.dmg | 191812065 | `0c51f2d1395a81f21b77831eb04fe31d6747b6c9ae4492c49b84604e116f9921` |
| career-0.3.0-alpha.17-win-x64.exe | 169194458 | `862959ed3321334392e7bcf268c00126292ff9cb657a2dba1192d240687dac07` |
| career-0.3.0-alpha.17-win-arm64.exe | 163009014 | `584bbaa6bab9e9b33471bf399cb92586e88b2e30aabc5d6b6088e33ac3ee042e` |
