# 接入 Career

仅在当前环境确有 Career 工作区时使用本页。独立复制本 Skill 不需要其余 Career 文件；下面提及的路径是运行时探测项，不是假定已经安装的依赖。

## 职责划分与读取

- 本 Skill：跨岗位需求研究、方向与补足计划、要求到经历的证据映射。
- `career-board`：岗位卡片、公司与机会评价、资料和面试跟进。
- `resume-tailor`：把已选表达保存为简历内容包、生成不同格式。
- `career-project`／`career-employment`：已有经历相关但本人行动、角色或结果不清楚时，按本轮范围深入访谈并先保存事实。材料未知不直接安排补课。
- `boss-zhipin-scraper`：可选的 BOSS 采集入口；公开网页和用户提供的材料同样可用。

先读用户工作区的 `AGENTS.md`、`career.json`、`context/INDEX.md`、`context/progress.md`、`context/state.md`，沿当前进度读取目标、已有研究、岗位和相关事实。开发仓库不是用户资料库；测试使用独立合成目录，所有命令显式传 `--workspace`。

在用户工作区运行 `npm run career -- --help --json` 确认当前版本。桌面工作区按 AGENTS 指引替换为 `./.local/career`，Windows 为 `.local\career.cmd`；不因运行方式不同重建用户资料。

```sh
npm run career -- board overview --json
npm run career -- opportunity context --id <岗位ID> --json
npm run career -- opportunity read --id <岗位ID> --path job.md --json
npm run career -- resume list --json
npm run career -- resume read --id <简历ID> --json
```

按实际读取结果继续打开 `resume/facts/` 和母版的相关部分，不预设用户姓名、项目或技术方向。旧版本缺少岗位命令时用现有文件分析，说明无法写入看板，不强制升级。

单岗位与具体简历的匹配交给 [career-match](../../career-match/SKILL.md)，公司研究交给 [career-company](../../career-company/SKILL.md)。需要比较机会价值时沿用共享评分、证据覆盖及未知处理；本 Skill 的样本频次用于说明目标方向的要求分布，不转换成个人匹配分、公司分或录用概率。

## 保存位置

单岗位原文保存在 `job.md`；已绑定版本的匹配由 career-match 写到 `analysis/match.md`，未绑定的候选对比单独保存，不覆盖当前版本分析。跨岗位研究放在用户工作区 `research/jd/<日期-主题>/`，按 [跟踪方法](tracking.md) 保存报告、主样本台账、原文、计划与简历使用记录。它是可在“我的资料 → 岗位调研”阅读、纳入受管版本保存的普通研究目录，不是新增 Career Schema 或自动入库的投递清单。来源凭据、Cookie、会话参数不进入研究文件；私有原文按用户保存／同步选择处理。

没有用户资料库时在用户指定目录交付，不为一份分析自动创建 Career 工作区。也不把全部搜索线索自动加入求职看板；只有用户选定或本轮授权筛选入库的机会，才按现有 `career-board` 方法保存。

更新已有分析前先读取完整正文及 sha256，保留用户手改，再提交合并后的内容：

```sh
npm run career -- opportunity read --id <岗位ID> --path analysis/match.md --json
npm run career -- opportunity write --id <岗位ID> --path analysis/match.md --input <本轮合并后的Markdown文件> --if-match <读取的sha256> --json
npm run career -- board check --json
```

首次创建文档不传 `--if-match`；已有文档必用本轮摘要。发生冲突重读并合并，不重试旧正文。岗位的星级、阶段和投递记录不由研究分析自动改变。

跨岗位报告在 `context/state.md` 留文件位置和下一步，按工作区规则保留已有状态。不要把相同大报告复制到每个岗位；各岗位只保留相关结论与出处。

需要分多轮推进时，在报告里保留研究范围、已读样本、当前结论、待核对问题和下一步；用 `context/progress.md` 记录本轮约定的阶段与范围。只有实际完成的分析标为完成，提出了练习计划不代表能力已补齐。后续补样本或收到面试反馈时更新原报告并注明结论变化，不能把未回复擅自判为能力不足。

## 进入简历修改

用户要修改时先读当前包和真实 Schema。为新方向可使用 `resume create --from <原ID> --title <方向名称> --json` 创建副本，交给已安装的 `resume-tailor` 按最新 CLI 保存、校验和导出。不要直接替换整个母版，也不复用旧摘要覆盖网页手改。研究期间新增的确凿经历先按 Career 事实维护流程补充，JD 本身不能写成个人事实。

此接入只增加 Agent 方法与文件协作；不会在桌面后台自动启动模型研究、投递或联系招聘方。发布安装包、上传私人资料仍按用户本轮范围与已有同步设置执行。
