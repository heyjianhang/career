# 我的资料

开发源码的本地工作台增加 `/profile`。侧栏按“求职看板 → 简历 → 我的资料”排列。资料页直接读取个人工作区中的现有文件，不建立第二份用户档案；不再单列简历母版入口，具体简历仍在简历库管理。

## 阅读入口

| 分类 | 原始资料 |
| --- | --- |
| 基本资料 | `resume/facts/profile.md` |
| 求职偏好 | `context/goals.md` |
| 工作、项目、教育 | `resume/facts/employment/`、`projects/`、`education/` |
| 技能、证书、语言 | `resume/facts/skills/`、`certificates/`、`languages/` |
| 协作记录 | `context/` 中除 goals 外的记录及会话交接 |
| 待补信息 | `resume/questions.md` |
| 全部资料 | 上述文件、`resume/sources/`、`resume/master/`、maintenance 与 master-preview |

分类目录可以展开具体经历，正文保留自由 Markdown；已有 YAML 字段以可读标签展示，未知字段仍完整保留在原文。空模板标题在预览中收起，不改写原文。来源 ID、关联经历和正文中的相对链接都可继续阅读。全部资料提供文件树，Markdown 支持目录／预览／原文／复制／下载，PDF 支持翻页与缩放，图片支持缩放，其他格式提供下载。

首版只读。用户通过“让 Agent 更新”复制当前文件和任务指令，Agent 继续使用已有文件维护方法。网页每四秒核对可见文件变化，切回窗口也刷新；阅读位置尽量保留，慢请求不覆盖后来选择的文档。页面不是自动运行 Agent 的入口。

## 文件边界

读取只允许上表目录及文件，不公开整个工作区。配置、隐藏文件、Git、登录信息、构建产物、简历冻结版本和符号链接不属于资料阅读范围。Markdown 不执行 HTML，不加载远端图片；本地图片和链接仍经过同一文件边界。文本预览限 2 MiB，附件限 24 MiB；目录最多 1500 个文件、深度 12 层。

## 开发验证

业务层在 `src/profile/store.ts`，本机只读路由在 `api.ts`，页面和阅读交互在同目录。复用共享侧栏、Markdown 渲染器和 PDF.js 资源。

```sh
npm run build
node --test tests/profile.test.mjs
npm run test:profile
```

测试使用独立合成工作区，覆盖字段、来源链接、文件边界、原文保留、Agent 更新、PDF／图片、目录、窄屏和共享导航。`scripts/prepare-profile-demo.mjs` 仅供合成演示，不能用于个人资料；演示不代表真实用户偏好。
