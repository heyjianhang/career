# 日常保存、更新与同步

桌面工作区使用 `.local/career`（Windows 用 `.local/career.cmd`）；npm 工作区使用 `npm run career --`。以下子命令加 `--json`。正文仍先写文件并校验；Git 保存与同步由 CLI 执行，不每轮拼接 add／commit／pull／push。

## 开始工作

读取 `sync overview`，返回本机自动同步设置、最近执行结果及本地版本状态，不联网。

- 仅本机：继续用户任务，不登录 GitHub，也不因为 Git 缺失阻塞整理。
- 已连接：`sync update` 后再读最新上下文。它先保存已有修改，再获取、合并远端，**不会上传**。
- 工作台自动更新刚完成：结合 last_result 与时间，避免重复操作。WORKSPACE_BUSY 时等待已有保存，不删除锁。
- 网络不可用：说明远端暂未核对，保留本机版本，继续不依赖远端的任务。不能把缓存状态说成最新。

数据更新不会升级程序或 npm 依赖；工具版本仍遵循安装规则。

## 保存节点

一段经历、母版或成品简历完成时，维护正文与进度，`workspace check` 后用 `history save --message "资料：补充项目职责与成果"` 留下有意义的本地版本。无变化不产生空提交，标题不放联系方式等私人详情。

用户要求同步时执行 `sync run`：受管文件校验、自动暂存提交、获取远端、合并、上传由工具完成。无需用户命名提交。重要节点默认问一次是否上传；本轮已有授权直接执行。

## 自动同步

界面：侧栏「云同步」→ 自动同步。等价 CLI：

```sh
npm run career -- sync preferences --automatic on --interval 5 --json
npm run career -- sync preferences --automatic off --json
```

默认关闭，仅存于本机 `.local/sync.json`，恢复到其他设备仍默认关闭。开启表示用户授权此工作区在工作台服务运行期间定期保存并上传受管资料，不再逐次询问。仅一次同步不等于持续授权，Agent 不代替用户开启。

软件或预览服务运行时执行：初次先更新；文件稳定 30 秒再开始；后续按间隔同步。退出软件即停止，不是系统后台服务。断网至少间隔五分钟重试；冲突或异常资料暂停，界面提示原因。手动同步成功恢复自动执行。`sync local` 也会关闭本机自动同步。

## 异常与冲突

| 状态 | 行动 |
| --- | --- |
| GIT_IDENTITY_REQUIRED | 云同步中的「版本署名」补名字／邮箱，或 history init；不猜身份、不改全局 |
| SYNC_CONFLICT | 从 sync overview 的 last_result.details 读取冲突文件和两侧提交；本地版本与远端历史均保留，正文无冲突标记 |
| SYNC_HISTORY_MISMATCH | 历史不相容；核对是否连错库，不拼接无关历史 |
| COMMAND_FAILED / DEPENDENCY_MISSING | sync environment 检查 Git、gh 和登录，按实际失败重试，不索取令牌 |
| WORKSPACE_CHANGED / WORKSPACE_BUSY | 文件正在写入或操作未结束，等待稳定再试 |
| WORKSPACE_INVALID / REMOTE_CONTENT_REVIEW | 保留原件，按具体结构或异常文件错误修复 |
| PRIVATE_REPOSITORY_REQUIRED / REMOTE_CHANGED | 核对私人目标与权限，不自动换库 |
| FILE_TOO_LARGE | 单文件上限 25 MiB，确定缩小或另存，不擅自删除 |

不同文件的修改可自动合并；需要 Agent 解决冲突时才进入 Git 细节。先核对报错后的两侧提交未变，读取共同祖先及两版文件，保留双方新增信息，无法判断的事实问用户。在隔离目录形成合并提交并校验后带回 main，或在已保存且干净的工作区普通合并、逐文件处理。不能用 ours/theirs 全选、reset --hard、强推、删除历史消除冲突。解决后 `workspace check`、提交并 `sync run`。

恢复旧内容时先保留当前资料，按范围取回并追加提交。UI 不需要 Git diff；历史排查可用 history list。`saved:true` 表示新建本地版本，`synced:true` 才表示本次上传成功。
