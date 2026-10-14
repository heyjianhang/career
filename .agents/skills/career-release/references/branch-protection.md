# 开发仓库主分支保护

这是开源开发仓库的规则。个人资料仓库仍由 career-git 指导用户在 main 保存，两者不要混用。

## 先查实际状态

```sh
gh api repos/heyjianhang/career/branches/main
gh api 'repos/heyjianhang/career/rulesets?includes_parents=true'
gh api repos/heyjianhang/career/rules/branches/main
gh api repos/heyjianhang/career/commits/main/check-runs
```

结合 branch.protected、传统 protection 与 rulesets／分支生效规则判断。查询权限不足、网络失败或 API 不可用时报告“未能确认”，不要把错误当成没有保护。只看到 Actions 成功不能证明合并必须经过 CI。

2026-10-13 查询记录：main 的 protected=false，规则集和生效规则都是空数组。当日的三个 Node 22 检查成功。此记录是快照，后续回答“现在开了吗”必须重新查询。

## 推荐的起步配置

在 GitHub Settings → Rules → Rulesets 创建针对 `refs/heads/main` 的 Active 分支规则集。已有传统保护或规则集时先读其内容再调整，避免重复叠加造成无法合并。

| 规则 | 建议 |
| --- | --- |
| Require a pull request before merging | 开启；功能和发布都通过 PR 合并 |
| Required approvals | 0；当前独立维护者不能审批自己的 PR，暂不要求第二个人 |
| Require status checks to pass | 开启，选择下面三个真实检查，来源 GitHub Actions |
| Require branches to be up to date | 开启；发布前在最新 main 基线上验证，若 main 变化需重新核对 |
| Block force pushes / Restrict deletions | 开启，保护主分支历史 |
| Require conversation resolution | 开启；解决 PR 中未处理的讨论 |
| Require linear history | 暂不开启；发布默认 merge commit 保留候选源码提交 |
| Bypass list | 默认不添加日常绕过；不为了 Agent 方便给管理员或机器人放行 |

当前工作流名称为 `Package and workspace checks`，实际必须选择的是 **job 的检查名**：

- `Node 22 / macos-latest`
- `Node 22 / windows-latest`
- `Node 22 / ubuntu-latest`

设置前从最近提交 check-runs 再核对，改过 workflow job 名时同步规则，否则会等待永远不会出现的检查。对 main 生效即可，release 分支正常推送以运行 CI。暂不增加签名、部署环境、合并队列等本项目未使用的强制要求。

用户明确要求开启或调整时才应用；使用当前 API／官方设置页，对规则做最小修改。保存后重新读取规则，核对 enforcement=active、main 匹配、检查名及合并方式；用后续正常 PR 检查必需项，不为测试而强推或删除 main。记录实际结果，不能只说“设置页已打开”。

依据：[GitHub 可用规则](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)、[受保护分支](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)。规则套餐与权限以当前仓库实际支持为准。
