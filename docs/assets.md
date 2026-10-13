# 第三方与演示素材

项目代码和 Skills 使用根目录的 [MIT 许可](../LICENSE)。下列字体、图标与运行依赖保留各自许可；最终使用的依赖版本以 package-lock.json 为准。

| 内容 | 来源与许可 | 使用方式 |
| --- | --- | --- |
| Noto Sans SC 可变字体 | `@fontsource-variable/noto-sans-sc` 5.3.1，SIL OFL-1.1 | 使用包内原始字体子集；字体许可随 HTML 内嵌。实现见 [fonts.ts](../src/presentation/fonts.ts) |
| Paged.js | `pagedjs` 0.4.3，MIT | 分页引擎及包内 LICENSE.md 内嵌到成果页。实现见 [pagination.ts](../src/presentation/pagination.ts) |
| Bootstrap Icons | 1.13.1，MIT | 使用 `record-circle-fill.svg`、`front.svg`，保留[原始许可](../src/presentation/templates/assets/bootstrap-icons/LICENSE) |
| 城市背景 | AI 生成的装饰图 `skyline.jpg` | 用于城市横幅样式；[来源记录](../src/presentation/templates/assets/README.md) |
| 示例头像 | AI 生成的虚构头像 `demo-portrait.jpg` | 仅用于演示和回归；[来源记录](../examples/presentation/assets/README.md) |

品牌横幅与真实产品截图见[README 素材](assets/README.md)，使用 AI 概念插图和合成演示，保留已选视觉风格。

参考站的截图与个人信息不作为发布素材打包。方法与版式参考见[来源说明](references.md)；新增样式需独立实现，并为新增素材注明来源与许可。示例头像不会默认写入用户简历，用户照片来自个人目录中的可选素材。

添加或替换依赖、字体、图标与图片时，同步更新这里及素材目录的说明，检查发布包和导出 HTML 是否保留必要的许可。用户应确认自己提供的照片、作品和项目链接可用于简历。
