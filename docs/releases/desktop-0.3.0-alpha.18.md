# Desktop 0.3.0-alpha.18

2026-10-19 已公开四架构桌面预览版；npm CLI 保持 0.2.0。

## 变化

- 简约研发模板使用全篇固定的章节、项目、段落和要点间距，取消分页后拉伸间距，避免相同经历在不同页面忽宽忽窄。
- 按原文顺序自然排满，标题跟随开头正文，长段落／要点正常续页；不为均衡末页提前推走项目。
- 去除项目之间的横线，以标题字重和留白区分，保留章节分隔线。
- 预览、离线 HTML 与 PDF 使用同一分页实现，保留手动分页与用户密度设置。

## 兼容性

保留已有工作区、简历正文、项目顺序和照片。历史构建及 PDF 不自动改写，重新打开简历并导出即可使用新模板。桌面仍采用下载安装包后覆盖升级，不包含自动安装重启。Mac 使用完整 ad-hoc 临时签名，尚无 Developer ID 签名与公证；Windows 未配置代码签名。

## 验证与发布状态

- 本地 242 项 Node 回归、文档与合成资料检查通过。
- 10 份生产 PDF 专项覆盖长短内容、照片、工作经历、手动分页、紧凑密度及自定义字号；验证追加后续内容不改变前面完整页面，同样工作要点在有无后续手动分页时保持相同间距。
- 实际四页预览与 PDF 逐页文字指纹一致，正文顺序与源包不变，无越界和页脚重叠；私人资料不进入仓库与测试。
- 真实 tgz 安装检查通过，涵盖首次及重复 setup、随包资源、HTML 和本地历史；npm 包保持 0.2.0，未发布 npm。
- [候选三平台 CI](https://github.com/heyjianhang/career/actions/runs/39150790460)、[四架构构建及打包应用原生验收](https://github.com/heyjianhang/career/actions/runs/39151515013)、[草稿附件校验](https://github.com/heyjianhang/career/actions/runs/39153657171)和[四架构匿名完整下载 SHA-256](https://github.com/heyjianhang/career/actions/runs/39153921407)均通过。
- Windows ARM64 首次原生验收等待编辑器保存状态超时；保留失败报告，同一源码不修改检查重跑后通过。本机同源 Mac 构建首次等待设置控件超时，完整重跑通过；没有据此更改运行逻辑或放宽验收条件。
- 本机 Mac ARM64 已从发布源码构建并覆盖安装 alpha.18，完整原生运行检查及严格签名验证通过，旧应用保留备份。四架构公开安装包均来自上述 CI 构建，不使用本机产物替代。
- 浏览器首次下载后的 Gatekeeper 允许流程和 Windows 安装器交互未逐台人工复验；原生验收指实际打包应用的功能检查。

## 发布来源与下载

源码及标签：`f19ba6e6ad7e0d6a297452d9971d83cf02d4513f`，`desktop-v0.3.0-alpha.18`。代码经 [PR #14](https://github.com/heyjianhang/career/pull/14) 合并。

[GitHub Release](https://github.com/heyjianhang/career/releases/tag/desktop-v0.3.0-alpha.18) · [官网下载](https://career.heyjianhang.top/)。

门户 CLI 于 2026-10-19 02:27:06（北京时间）成功切换 alpha.18，返回 `ok:true`、`publicFeedConfirmed:true`，revision `194640e79ee34796ace4cd087fd45e6d`。静态回退清单同步为 alpha.18，随本记录提交部署；此回执证明运行时切换，不单独证明静态部署完成。

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| career-0.3.0-alpha.18-mac-arm64.dmg | 185164174 | `184be54f347a18bf683ab9a10fdcb053cbbac4710494b5b10afa762d881f7bf4` |
| career-0.3.0-alpha.18-mac-x64.dmg | 191813539 | `e03cbaecec9f29fe5658a3f8d73860d9720a8c2e7e37163342bb221cedad8f45` |
| career-0.3.0-alpha.18-win-x64.exe | 169194535 | `ca8aa551f99cd44f9057f9e1c8ee544710f66ac83131059873c0773f63fb3ed5` |
| career-0.3.0-alpha.18-win-arm64.exe | 163009185 | `364d9c82a63cabb9dc0c1dfa3ecbc0a56cf72c57cde27880b1759652c475c61d` |
