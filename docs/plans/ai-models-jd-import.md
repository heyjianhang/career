# 模型与服务、JD 导入

2026-10-18 更新。本轮完成服务商统一配置、文本／视觉／实时语音三类默认用途，以及单岗位导入的兼容更新。实时语音只预配置模型与地址；音频采集、流式转写、持续对话、自主研究和自动投递尚未接入。

## 使用路径

- 桌面应用：设置 → 模型与服务。上方选择文本、视觉、实时语音默认模型；下方提供阿里云百炼、DeepSeek、火山引擎与自定义兼容服务。每个服务弹窗集中管理连接、启用状态和多个模型；火山在同一卡片内分别保存方舟与语音 Key，附官方获取 Key 与接入指南。
- 文字整理与图片识别可选不同模型，也可共用一个多模态模型；图片模型需显式声明支持图片。
- 保存与测试分开。测试文字实际执行合成 JD 字段提取；测试图片发送随机红／蓝色块并核验返回值，同时检查结构化输出。通过测试不是所有真实 JD 都能正确识别的保证。
- 看板 → 添加岗位 → 粘贴文字／粘贴或上传 1–4 张截图 → 识别 JD → 核对／修改 → 创建岗位卡片。图片可删除和调整顺序；每张 4 MiB、合计 12 MiB，仅 PNG/JPEG/WebP，文字最多 5 万字。
- 未配置模型时可以手动填写，也可以复制指令交给外部 Agent。普通浏览器不接收或保存 API Key。
- 默认加入待评估；从具体列发起会保留该列阶段，已结束阶段必须指定结果。AI 不决定评分、投递状态或分析结论。

## 界面与扩展

- 服务商品牌、官方链接、模型预设和默认用途集中在 `src/presentation/model-catalog.ts`；模型列表和服务卡片按元数据渲染。百炼使用官方原色标识并随包保存，不依赖远程图片。新增协议仍需实现主进程适配与校验，不靠界面配置假装兼容。
- 模型配置与 JD 核对使用共享下拉组件，支持键盘选择、搜索定位、Esc、焦点恢复与窄屏定位，原始 select 保留表单契约。
- 同一服务中的文本／视觉模型引用同一份 Key；百炼语音共用该 Key，火山语音使用独立的 speechKey。更换文本／视觉 Key 会清除该服务的旧测试记录；只更换火山语音 Key 不影响文本／视觉连接。多模态模型可同时用于文本和视觉；语音模型只能分配到语音用途。
- 百炼默认展示 Qwen 3.8 Flash、Qwen 3.8 Max、Qwen3 ASR Flash Realtime；更多预设和自定义 ID 在“添加模型”中选择，已有模型保留。DeepSeek 与火山方舟使用官方 Chat Completions 兼容接口；整理任务关闭思考模式，自定义接口保留服务端默认行为。
- 百炼语音单独保存 WebSocket 地址，允许稍后填写；以控制台对应工作空间和地域的地址为准。暂不发送音频、申请录音权限或声称转写测试通过。火山预置豆包流式语音识别 2.0 小时版（volc.seedasr.sauc.duration）与并发版（volc.seedasr.sauc.concurrent），模型字段保存资源 ID；默认 WebSocket 为 wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async。目前配置新版控制台 X-Api-Key 鉴权，不包含旧版 AppID + AccessToken 鉴权。火山方舟 Key 不被当作豆包语音服务的 Key，可单独配置语音，不必开通文本模型。DeepSeek 公开文档暂未确认实时 ASR 接口，因此不提供语音预设，可与百炼／火山转写组合用于后续问答。
- 保存后立即清空输入框里的 Key，页面只显示“已安全保存”。“保存并测试”先保存再用一个文本模型测试；视觉能力逐个单独验证。未保存的连接变更会禁用模型操作，避免丢失修改。

## 数据边界

- `desktop/ai.cjs` 管理本机连接及默认用途，凭据与配置由 Electron safeStorage 整体加密，位于用户数据目录 integrations/models.json。工作区、Git、返回给页面的状态中不包含密钥。
- 加密文件升级为 career-models/v2，services 保存凭据，models 只引用 serviceId。火山服务新增可选 speechKey，仅存在于加密存储；公开状态只有 hasSpeechKey 和模型 credentialReady 标记。缺对应 Key 的模型可见但不能选为默认或调用，禁止把另一用途的 Key 兜底使用。v1 首次成功写入时迁移，只有服务类型、地址与 Key 全部相同才合并；保留模型 ID、默认选择和不同 Key 的独立连接。只读查询不改文件。
- 更换 Base URL 或语音地址必须重新输入该地址对应的已存 Key，避免把旧供应商凭据发送到新地址；拒绝 URL 内凭据、参数及非本机 HTTP。请求不跟随重定向，不回显上游原始错误。
- `src/ai/client.ts` 使用 LangChain ChatOpenAI 和 withStructuredOutput；JSON、JSON Schema、工具调用可选，本机 AJV 再校验。请求无自动重试，60 秒超时，可取消；最多两个并发请求。
- 每次只发送本次输入资料，不自动读取简历、个人资料或历史岗位。不启用 LangSmith 上传，即使宿主环境开启追踪，也为这些调用建立关闭追踪的执行上下文。
- 文本输入的原文始终使用用户粘贴内容，不让模型改写。截图输出标注为识别结果，模糊处和缺失信息留空／标记待核对；不把推断写成已证实事实。

## 保存契约

`src/opportunities/import.ts` 是本机 HTTP 与未来其他入口可复用的业务函数；复用现有岗位 Schema、工作区锁、路径校验和可恢复写入事务：

- `card.md`：公司／职位／地点／薪资／来源／阶段和少量元数据，个人星级与推荐为空；正文链接到 JD。
- `job.md`：用户核对的正文，含采集来源说明。
- `attachments/source.txt`：逐字保存用户粘贴的输入（有文字时）。
- `attachments/jd-N.png|jpg|webp`：原始图片字节，按输入顺序安全命名。
- `extensions.jd_import`：源内容指纹、采集方式、核对时间、原始文件路径、识别疑点。
- 一次事务涵盖上述文件及一条 activity。中途失败保留恢复日志，由 `career board recover` 完成，读取时不会把残缺数据当作完整导入。
- 同一请求 ID、相同原始内容指纹或完全相同来源 URL 返回已有卡片，不重写旧资料。URL 去掉追踪参数后的语义去重、多岗位批量拆分尚未实现。

本版没有新增 CLI 子命令；外部 Agent 继续使用 `opportunity add`、`doc write`、`attach` 等现有命令，和内置导入共享文件契约。

## 验证

- `tests/ai-import.test.mjs`：真实 LangChain HTTP 请求、文字原文保真、图片消息、非法字段／来源、取消、错误脱敏、禁止追踪上传、连接加密／重载／默认模型、重复导入、批量事务恢复。
- `tests/ai-browser.mjs`：合成模型桥接、服务卡片／弹窗、模型预设、自定义模型、服务级 Key、三类默认用途、火山只配置语音／补充方舟 Key／独立可用状态、下拉鼠标／键盘／Esc／窄屏定位，以及识别核对、手动录入、截图、取消、重复来源、来源校验和 320–1280px 布局。
- `desktop/ai-smoke.cjs`：打包 Electron 中的真实表单、IPC、系统加密、包内模型库、本机合成 HTTP 服务、核对后落盘；desktop:test 的第二进程检查模型配置与默认用途恢复。
- 本轮未用个人 Key 对真实百炼／DeepSeek／火山引擎做正向调用验收；本机合成 HTTP 检查请求协议与参数，不能替代实际账号的权限、余额和模型验收。跨平台音频采集、实时转写、完整内置 Agent 另行实施。

2026-10-17 界面改版验收：159 项基础测试、浏览器交互与 320–1280px 布局、实际 Electron IPC／系统加密／重启恢复及既有桌面回归通过。更换百炼图标后重新构建并通过界面回归。当前是本地源码与开发预览，alpha.11 安装包尚未包含本次界面改版。

## 参考

- [LangChain 模型](https://docs.langchain.com/oss/javascript/langchain/models)
- [LangChain 结构化输出](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- [百炼获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key)
- [百炼 Base URL 与地域](https://help.aliyun.com/zh/model-studio/base-url)
- [Qwen 3.8 Flash](https://help.aliyun.com/zh/model-studio/qwen3-8-flash)、[Qwen 3.8 Max](https://help.aliyun.com/zh/model-studio/qwen3-8-max)：文字、图片输入与结构化输出。
- [百炼思考模式](https://help.aliyun.com/en/model-studio/deep-thinking)：整理任务使用 enable_thinking=false。
- [Qwen 实时转写](https://help.aliyun.com/en/model-studio/real-time-speech-recognition-user-guide)：qwen3-asr-flash-realtime、WebSocket 与服务端 VAD。
- [DeepSeek 模型列表](https://api-docs.deepseek.com/api/list-models/)与[思考模式](https://api-docs.deepseek.com/guides/thinking_mode/)：deepseek-flash 支持图片，deepseek-v4-pro 为文本，thinking.type=disabled。
- [火山方舟接入](https://docs.volcengine.com/docs/ark/integrate-third-party-tools?lang=zh)、[思考模式](https://docs.volcengine.com/docs/ark/deep-thinking?lang=en)：方舟 API Key、模型 ID 或接入点 ID，与语音服务独立。

### 设置外框一致性（2026-10-18）

设置共用 1100px 宽、最高 820px 的外框，并受视口宽高限制；700px 以下统一使用窄窗布局。模型页不单独覆盖外框尺寸或内容边距。六个栏目切换时检查外框、标题、导航与内容区几何不变，内容仅在内部滚动。

- [豆包流式语音识别 API](https://docs.volcengine.com/docs/DoubaoVoice/LargemodelstreamingautomaticspeechrecognitionAPI?lang=zh)：2.0 资源 ID、双向流式优化版地址与新版 API Key 鉴权。
- [豆包语音 API Key](https://docs.volcengine.com/docs/DoubaoVoice/APIKeyUsage?lang=zh)：语音控制台凭据说明；与方舟连接独立。
