# 采集结果进入 career 看板

先按 [career-board](../../career-board/SKILL.md) 读取当前现场和 [CLI 操作](../../career-board/references/cli.md)。以下命令在个人工作区执行；桌面工作区按 AGENTS.md 将 npm 前缀替换为 `.local/career` 或 `.local/career.cmd`。

```sh
npm run career -- board overview --json
npm run career -- opportunity schema --json
```

## 数据映射

| 采集数据 | career 用法 |
| --- | --- |
| 列表 title | title |
| 列表 boss_name／详情 company | company；boss_name 不是招聘者姓名 |
| location、salary | 同名字段，保持招聘页原始表述；缺失时省略或按 Schema 留空 |
| job_link | sources 中 platform 为 boss、url 为职位链接 |
| encrypt_job_id | sources.native_id；上游 job_id 是本地链接哈希，不冒充平台 ID |
| scraped_at | sources.captured_at；可确定时转换为带时区 ISO 时间，未知不要杜撰 |
| 详情 jd | job.md 的原文正文 |
| 学历／经验、技能、福利、公司规模／行业／融资、活跃状态 | job.md 的来源信息区，明确招聘页标注，不视为企业调查结论 |
| is_new | 本次采集比较结果；不修改岗位阶段、发布时间或用户星级 |

列表和详情以 job_id 或规范 job_link 对齐，不能按数组下标对齐。security_id、lid、浏览器登录数据属于本机采集上下文，不写进卡片、附件或 Git；不要把整个采集目录 attach 进去。

## 创建或补充

只保存用户选择或本轮已授权筛选入库的岗位。先比较 overview 中的来源 URL／native_id，发现同岗先读取 context，不因再次搜索就新建卡。同公司不同职位不自动合并。

在本轮 `.local` 临时目录生成符合实际 Schema 的输入 JSON，用结构化写文件工具保存，避免 shell 插值。body 记录已获取哪些信息、当前缺口和下一步；不要只有“已收集”而找不到原文。然后：

```sh
npm run career -- opportunity add --input .local/选定岗位.json --json
npm run career -- opportunity read --id <返回ID> --path job.md --json
npm run career -- opportunity write --id <返回ID> --path job.md --input .local/岗位原文.md --if-match <读取结果sha256> --json
npm run career -- board check --json
```

读取结果显示文件不存在时，首次 write 不传 `--if-match`；文件存在时必须使用实际读取摘要。job.md 保存来源链接、采集时间、招聘页基础信息及未改写的 JD；列表无详情则明确“详情尚未获取”，不能把列表标签拼成完整 JD。

已有卡片用 opportunity read／context 获取最新内容。原文变化时先以独立 Markdown 文件留存新的采集版本，再合并或更新 job.md；保留原有笔记和分析，不覆盖为新抓取的短摘要。更新 sources 需合并完整数组并带 card 摘要；遵循 CLI 的冲突处理。

完成后报告新增／更新数量、重复跳过和失败项、真实岗位 ID 与文档路径。后续由 career-board 编排 career-company 公司研究和 career-match 具体简历匹配，未关联简历先推荐并询问，原文与判断分开保存；不代用户设置五星、不声称已经投递。需要展示时运行 `board preview --open --json`，使用返回的真实 URL。
