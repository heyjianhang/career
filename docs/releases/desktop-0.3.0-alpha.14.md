# career Desktop 0.3.0-alpha.14

2026-10-18 已公开为未签名预览版。四架构打包应用原生验收、远端附件与匿名完整下载 SHA-256 校验均通过。门户运行时下载入口已切换到 alpha.14。

## 本次更新

- 岗位详情统一为「职位描述、公司分析、岗位匹配、面试、资料、简历、打招呼」七个页签，窗口缩小时保持选中的页签可见。
- 岗位匹配页上方展示总体结论、匹配分与星形图示、证据覆盖和必要条件，下方保留完整分析。评分使用真实简历与 JD 的逐项依据，未知项不记为零分；与个人星标分开，不表示录用概率。
- 新增独立「打招呼」页及「招聘开场白」Skill，根据具体岗位和投递简历准备推荐稿、简短版，支持复制正文及查看选材依据。
- JD、关联简历或简历内容变化后，已有评分和打招呼稿会提示核对；旧纯文字分析继续阅读，不自动猜分或覆盖原稿。
- 十三个用户 Skills 随安装分发，更新了写作方法、评分保存协议和 Agent 交接指令。生成与复制消息不自动发送或改变投递阶段。

## 兼容性与边界

新工作区没有预置简历、岗位或演示资料。升级保留个人资料，受管指引有用户修改时保留并报告冲突。开始／更新匹配分析和打招呼稿仍通过工作区 Agent 完成。

继续为未签名预览版，macOS 未公证、Windows 无代码签名。语音面试辅助尚未实现。公开 npm 版本保持 0.2.0。

## 验证记录

本地已通过 211 项基础测试、匹配／打招呼专项浏览器检查、看板及路线图回归、Skill 格式与安装资源引用、实际 tgz 安装和重试。新增桌面安装验收覆盖打包后的评分、独立页签、正文复制和输入变化提醒。安装器交互与系统拦截提示未在本轮逐台手动复验；模型和企查查使用合成服务，真实供应商 Key／额度不在本次验收范围。

## 来源与公开验证

- 合并 PR：[#4](https://github.com/heyjianhang/career/pull/4)。安装包源码及标签均为 `7ce4b1e147715d3acabfc6b2a37cc0ae7c740efc`。
- [候选三平台 CI](https://github.com/heyjianhang/career/actions/runs/39057475206)与 [main 三平台 CI](https://github.com/heyjianhang/career/actions/runs/39058230768)通过。
- [四架构构建及原生验收](https://github.com/heyjianhang/career/actions/runs/39058242506)：每架构实际启动刚打包的应用，通过 211 项基础测试及桌面 smoke，独立冷启动通过；新工作区为空，十三个用户 Skills、内置 CLI、简历／PDF、模型设置／JD 导入、企查查桥接、更新入口、评分与打招呼均检查。
- [转存和远端 SHA-256](https://github.com/heyjianhang/career/actions/runs/39059024839)、[四个匿名完整下载](https://github.com/heyjianhang/career/actions/runs/39059168498)均通过。
- [GitHub Release](https://github.com/heyjianhang/career/releases/tag/desktop-v0.3.0-alpha.14)，公开时间 2026-10-18 02:40:54（北京时间）。附件含四个安装包及 SHA256SUMS.txt。

| 安装包 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `career-0.3.0-alpha.14-mac-arm64.dmg` | 184144085 | `ce3dc3e91fb5f13cd2e30e92c7aa54cd551686b21a71e7ae8816c4efdafa497f` |
| `career-0.3.0-alpha.14-mac-x64.dmg` | 188724346 | `92f60c1685eb7e5c7055795408f4d2895dd40e5623a732111ebc37567d800e36` |
| `career-0.3.0-alpha.14-win-x64.exe` | 169128501 | `396636abd7e11338890188c7420f9a3cb550cf8c695f0e62079bf3a1ac1aa2a0` |
| `career-0.3.0-alpha.14-win-arm64.exe` | 162942714 | `1b046327b5b866ba0dad2c4ef4aff43c339502947497618ee1f8dcf1028ab481` |

## 门户

2026-10-18 02:44:47（北京时间），管理 CLI 发布成功，公开入口回查 `publicFeedConfirmed:true`。草稿 `811774f075804632954c19256a94dd62`，当前 revision `1801bf02f21540868b76b011a0972844`。本机 CLI 的额外匿名预检查遇到限流，CI 四个匿名完整下载已通过；云端发布时独立校验四个公开附件并成功切换。静态回退清单已更新，待合并部署。
