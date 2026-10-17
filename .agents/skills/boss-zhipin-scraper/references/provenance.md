# 来源与维护范围

上游：[eatmoreduck/boss-zhipin-scraper](https://github.com/eatmoreduck/boss-zhipin-scraper)，作者 eatmoreduck，MIT。许可全文随包保留在 [LICENSE](../LICENSE)。

2026-10-17 从本机已安装的 2.3.1 Skill 取固定快照；未取得可验证的上游提交 SHA，不声称与某个 Git 标签一致。五个上游文件及各自 SHA-256 记录在 [upstream.json](../upstream.json)：两个 Python 脚本、城市码表、requirements.txt 和 LICENSE。它们保持原样；不随用户初始化联网拉取上游最新代码。

career 维护 SKILL.md 和 references：修正旧说明的路径定位、采集架构与页大小表述，增加跨平台依赖准备、小批量执行、错误判断和看板入库。没有更改上游抓取算法，不把上游已知限制标为已修复。

分发只包含上述运行资源和 career 引导，不包含上游开发指令、测试、浏览器资料、历史结果或 Python 虚拟环境。首次使用在用户工作区 `.local` 创建独立依赖环境；BOSS 专用登录目录留在用户主目录。

以后更新先审查上游改动，更新固定文件与哈希，执行合成分发测试和离线脚本检查，再单独记录真实浏览器验收结果。不要使用运行时自动下载 master 的方式升级。
