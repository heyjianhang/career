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

## 侧栏图标

侧栏采用 [Lucide](https://github.com/lucide-icons/lucide) 的 panel-left-close、panel-left-open、columns-3、file-text、user-round 和 settings-2 SVG，2026-10-14 取得。统一为 20px、1.7 单位描边，内联于 shell-icons.ts。ISC／派生 MIT 声明位于 src/presentation/SHELL-ICONS-LICENSE，构建时原样进入 dist/presentation；无需运行时网络访问。看板正文仍沿用既有 Bootstrap Icons。

## 桌面安装资源

桌面使用 Electron（MIT）及其 Chromium／Node 运行环境，保留发行包自带的第三方许可和 notices；运行依赖随包保留各自 LICENSE。`desktop/assets/icon.*` 为本项目 career「c.」品牌字标的栅格图标，不包含字体文件；桌面代码遵循根目录 MIT。字标按实际字形边界整体居中，`scripts/desktop/icons.cjs` 同时生成 Mac ICNS、Windows 多尺寸 ICO、彩色托盘 ICO 与透明单色 trayTemplate（含 @2x）；Mac 菜单栏由系统着色。
