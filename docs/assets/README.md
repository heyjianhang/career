# README 视觉素材

| 文件 | 来源与用途 |
| --- | --- |
| `career-hero.png` | 2026-10-13 使用内置 ImageGen 生成并按用户要求改成更扁的横幅，保留已选纸张与绿色风格；[生成记录与提示词](career-hero-generation.md)。纸张、卡片和连接线表达经历与下一步；不是产品界面截图。 |
| `workspace.jpg` | 从本仓库当前本地成果页截取，内容来自合成演示；只展示已实现的简历入口。 |
| `styles.jpg` | 同一合成演示中的真实样式库截图，展示 14 款样式选择。 |

产品截图均不使用用户私人资料。示例人物为 AI 生成的虚构头像，来源见[示例素材](../../examples/presentation/assets/README.md)。品牌定位见[brand.md](../brand.md)。

复现截图：先 `npm run build`，在不存在的测试目录运行 `scripts/prepare-template-demo.mjs`，再用 `career resume preview --workspace <测试目录>` 打开成果页。截图为 1440 × 1080 视口，经典样式，展开侧边栏；样式库通过“更换样式”打开。生成目录放在被忽略的 `.cache/` 中。

这些文件用于源码仓库的文档展示，不进入 npm 运行包。随包字体和图标按[素材说明](../assets.md)保留原许可。
