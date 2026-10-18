# 桌面 0.3.0-alpha.15：Mac 签名与模型配置改进

2026-10-18 13:54:40（北京时间）已公开为 GitHub 预览版，支持 macOS 与 Windows 的 ARM64／x64。npm 保持 0.2.0。

- [公开版本与安装包](https://github.com/heyjianhang/career/releases/tag/desktop-v0.3.0-alpha.15)
- 安装包源码及标签：`794072399a85c9fbe7a0b25a2711231c80c16166`。
- [功能 PR #6](https://github.com/heyjianhang/career/pull/6) 与[原生验收等待修正 PR #7](https://github.com/heyjianhang/career/pull/7) 均已合并 main。

## 变化

- 统一所有设置页的外框尺寸与间距，切换模型设置时不再改变窗口宽度，支持窄窗分类导航。
- 模型配置按服务商管理，同一连接共用 Key 与 Endpoint；支持百炼 Qwen 3.8 Flash／Max、DeepSeek、火山引擎和自定义兼容服务，可添加模型并设置默认用途。
- 文本、视觉、实时语音三类用途分开。预置百炼 ASR 和豆包流式识别 2.0 小时版／并发版，火山语音 Key 独立加密保存，允许仅配置语音服务。
- 加密模型配置升级到 v2，迁移保留原有模型、默认选择与不同 Key；停用服务不能继续调用，Key 不返回页面、不进入资料同步。
- Mac 预览包补齐应用资源与内部组件的 ad-hoc 临时签名，保持 hardened runtime，构建时验证完整应用和最终 DMG 内的签名；失败即停止发布。
- 不修改用户工作区、履历或投递状态。

## 验证与来源

218 项基础测试、模型与工作区浏览器回归、文档与实际 tgz 安装验证通过。设置页覆盖 320–1280px 四个断点，工作区覆盖 320–1440px。仅使用合成资料与模拟模型服务，没有使用用户真实云端 Key。

- 修正后的候选通过三平台 CI：[push 检查](https://github.com/heyjianhang/career/actions/runs/39100740934)、[PR 检查](https://github.com/heyjianhang/career/actions/runs/39100743878)。
- [最终四架构构建与原生验收](https://github.com/heyjianhang/career/actions/runs/39101308543)：四份真实打包应用均通过 15 项功能检查及第二进程冷启动，Mac 两种架构的应用与最终 DMG 签名完整性校验通过。
- [草稿附件转存校验](https://github.com/heyjianhang/career/actions/runs/39102070239)与[公开后匿名完整下载](https://github.com/heyjianhang/career/actions/runs/39102175462)通过。四个公开附件均返回 HTTP 200，完整字节数与 SHA-256 一致。

首次四架构构建的 Intel Mac 原生测试发现测试脚本关闭弹窗后立即打开新弹窗，旧弹窗尚未移除，导致提交命中旧表单。PR #7 增加旧弹窗移除和新表单保存完成的等待；随后从修正提交重新构建全部四个架构。最终附件全部来自上述成功构建，没有混用首次构建或本机候选产物。

| 安装包 | 字节数 | SHA-256 |
| --- | ---: | --- |
| career-0.3.0-alpha.15-mac-arm64.dmg | 185126393 | `435a377f0d9b727918304e9769f92df94089ef3043e280345093a5126cf4d7d6` |
| career-0.3.0-alpha.15-mac-x64.dmg | 191764131 | `1ec67424beecd35939b434798b82e49ef198a712e75ebde1b82004a7af4f9864` |
| career-0.3.0-alpha.15-win-x64.exe | 169146316 | `bbecb1639e6ec144df790b534093a834d7b5c69b5ca5730c79994c1e90a3e153` |
| career-0.3.0-alpha.15-win-arm64.exe | 162960802 | `e5af0a440cd7c832d2e5d0022cf2804d46943da927edd2a8e010f44ecc9d5c6a` |

## 门户版本

2026-10-18 13:58:09，管理 CLI 发布成功，云端独立验证四个公开附件后返回 `ok:true` 与 `publicFeedConfirmed:true`。公开下载入口为 alpha.15，revision 为 `d36854380f034336a75e9842cadf0fe7`。本机匿名预检查曾遇到 GitHub 限流，不影响已通过的 CI 完整下载与云端独立校验。

静态回退清单同步为 alpha.15，随本记录提交；门户运行时版本已生效，静态部署状态需按[门户生产记录](../portal.md#生产部署记录)与实际部署回执核对，不能把 CLI 切换等同于静态部署完成。

## 验收边界

语音本次仅提供模型和凭据预配置，尚未接入录音、流式转写或真实语音连接测试。

Mac 仍未获得 Developer ID 签名及 Apple 公证；Windows 未配置代码签名。浏览器下载后的首次打开、用户手动允许和安装器交互未在本轮逐台复验；签名完整性与原生功能测试不代替这些人工验收。此前 Chrome 自动化下载本机测试包被拦，用户截图显示未配置企业策略，来源未确认；没有清除隔离标记、关闭安全设置或把直接运行包内程序当作首次打开验收。
