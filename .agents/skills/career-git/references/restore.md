# 换电脑或恢复已有资料库

用户已有私人资料仓库时恢复已有内容，不创建另一份空库覆盖它。

1. 核对用户给出的仓库地址、当前 GitHub 账号和可写权限，准备 Node.js/npm、Git、gh。登录按[首次连接](first-sync.md)处理，已有可用登录不重复要求注册。
2. 确定一个不存在的个人目录，用已核实来源的 career 工具执行 `workspace restore --repository "<owner/repo>" --workspace "<新目录的绝对路径>" --json`。CLI 只恢复 main，不执行仓库中的安装脚本。
3. 读取恢复出的 package.json 和 package-lock.json，核对工具来源、固定版本和依赖。确认匹配预期后，在该目录 `npm ci --ignore-scripts`；不自动改成 latest。缺锁文件时按已记录精确版本安装。
4. 读恢复结果的 next_reads 与 AGENTS.md，运行 `npm run career -- doctor --json` 和 workspace status。依赖、受管资源不完整时由 [career-setup](../../career-setup/SKILL.md) 修复；保留用户自定义 AGENTS 和 Skill 修改。
5. 按[日常规则](daily-sync.md)检查同步，读取 context/state 和用户当前任务。PDF 运行时单独准备，不因此重新访谈。

已有本地目录不会被自动清空；先选择新目录，保留旧资料再按事实合并。仅本机素材或排除的大文件可能不在仓库中，需要时提醒补齐具体缺项。工作区配置中的本机安装包路径不可在新机器直接复用，要先核对可用的正式依赖来源。

恢复成功表示资料已下载，不表示本轮新增内容已保存或上传。恢复后继续用户任务；有新变化按本地提交与远程同步分别处理。
